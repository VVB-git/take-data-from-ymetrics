/**
 * Клиент API Яндекс.Метрики: отчёты, цели, фильтры, ретраи.
 */

var YM_API = 'https://api-metrika.yandex.net';
var YM_MAX_RETRIES = 4;

function escapeFilterValue_(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildFilters_(settings, extraFilter) {
  var parts = [];
  if (!settings.includeRobots) {
    parts.push("ym:s:isRobot=='No'");
  }
  if (extraFilter) {
    parts.push(extraFilter);
  }
  return parts.join(' AND ');
}

function utmEqualsFilter_(utm) {
  return "ym:s:UTMSource=='" + escapeFilterValue_(utm) + "'";
}

function utmNotEqualsFilter_(utm) {
  return "ym:s:UTMSource!='" + escapeFilterValue_(utm) + "'";
}

function utmUserFilter_(utm) {
  return "USER(" + utmEqualsFilter_(utm) + ")";
}

function encodeQuery_(params) {
  var keys = Object.keys(params);
  var chunks = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = params[key];
    if (value === '' || value === null || typeof value === 'undefined') {
      continue;
    }
    chunks.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  }
  return chunks.join('&');
}

function parseMetrikaError_(code, body) {
  var message = '';
  try {
    var json = JSON.parse(body);
    if (json.message) {
      message = json.message;
    }
    if (json.errors && json.errors.length) {
      message = json.errors.map(function(err) {
        return err.message || err.error_type || '';
      }).filter(Boolean).join('; ');
    }
  } catch (e) {
    if (body) {
      message = String(body).substring(0, 240);
    }
  }
  if (code === 401) {
    return 'Токен неверный или истёк. Вставьте новый OAuth-токен в поле на листе «Настройки».';
  }
  if (code === 403) {
    return 'Нет доступа к этому счётчику. Проверьте номер счётчика и права токена (нужно metrika:read).';
  }
  if (code === 404) {
    return 'Счётчик не найден. Проверьте номер.';
  }
  if (code === 429) {
    return 'Метрика временно ограничила запросы. Подождите минуту и нажмите ещё раз.';
  }
  return message ? ('Метрика: ' + message) : ('Ошибка Метрики, код ' + code);
}

function metrikaFetch_(pathAndQuery, token) {
  var url = YM_API + pathAndQuery;
  var lastError = 'Не удалось связаться с Метрикой.';
  for (var attempt = 1; attempt <= YM_MAX_RETRIES; attempt++) {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        Authorization: 'OAuth ' + token,
        Accept: 'application/json'
      },
      muteHttpExceptions: true,
      followRedirects: true
    });
    var code = response.getResponseCode();
    var body = response.getContentText();
    if (code >= 200 && code < 300) {
      try {
        return JSON.parse(body);
      } catch (e) {
        throw new Error('Метрика вернула ответ, который не получилось прочитать.');
      }
    }
    lastError = parseMetrikaError_(code, body);
    var retryable = code === 429 || code >= 500;
    if (!retryable || attempt === YM_MAX_RETRIES) {
      var error = new Error(lastError);
      error.httpCode = code;
      error.body = body;
      throw error;
    }
    Utilities.sleep(1500 * attempt);
  }
  throw new Error(lastError);
}

function metrikaStat_(token, params) {
  var query = encodeQuery_(params);
  var json = metrikaFetch_('/stat/v1/data?' + query, token);
  Utilities.sleep(200);
  return json;
}

function fetchGoals_(settings) {
  var json = metrikaFetch_('/management/v1/counter/' + settings.counterId + '/goals', settings.token);
  var goals = json.goals || [];
  return goals.map(function(g) {
    return { id: g.id, name: g.name || '' };
  }).filter(function(g) {
    return g.id && g.name;
  });
}

function normalizeGoalName_(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchGoals_(requestedNames, goals) {
  var byNorm = {};
  for (var i = 0; i < goals.length; i++) {
    byNorm[normalizeGoalName_(goals[i].name)] = goals[i];
  }
  var matched = [];
  var missing = [];
  for (var j = 0; j < requestedNames.length; j++) {
    var name = requestedNames[j];
    var found = byNorm[normalizeGoalName_(name)];
    if (found) {
      matched.push({ requested: name, id: found.id, name: found.name });
    } else {
      missing.push(name);
    }
  }
  if (missing.length) {
    var available = goals.map(function(g) { return g.name; }).join(', ');
    throw new Error(
      'Не найдены цели: ' + missing.join(', ') + '.\n\n' +
      'В счётчике есть: ' + (available || 'нет целей') + '.\n\n' +
      'Скопируйте название один в один: меню «Отчёт Метрики» → «Показать цели счётчика».'
    );
  }
  return matched;
}

function fetchReportTotals_(settings, extraFilter, metrics) {
  var params = {
    ids: settings.counterId,
    metrics: metrics.join(','),
    date1: settings.date1,
    date2: settings.date2,
    accuracy: 'full',
    lang: 'ru',
    attribution: 'last',
    limit: 100
  };
  var filters = buildFilters_(settings, extraFilter);
  if (filters) {
    params.filters = filters;
  }
  var json = metrikaStat_(settings.token, params);
  return {
    totals: json.totals || [],
    sampled: !!json.sampled,
    containsSensitive: !!json.contains_sensitive_data,
    data: json.data || []
  };
}

function fetchBreakdown_(settings, extraFilter, dimension, metric) {
  var params = {
    ids: settings.counterId,
    metrics: metric,
    dimensions: dimension,
    date1: settings.date1,
    date2: settings.date2,
    accuracy: 'full',
    lang: 'ru',
    attribution: 'last',
    limit: 100
  };
  var filters = buildFilters_(settings, extraFilter);
  if (filters) {
    params.filters = filters;
  }
  var json = metrikaStat_(settings.token, params);
  return {
    totals: json.totals || [],
    sampled: !!json.sampled,
    containsSensitive: !!json.contains_sensitive_data,
    data: json.data || []
  };
}

function num_(value) {
  var n = Number(value);
  return isNaN(n) ? 0 : n;
}

function round1_(value) {
  return Math.round(num_(value) * 10) / 10;
}

function round2_(value) {
  return Math.round(num_(value) * 100) / 100;
}

function primaryFilter_(settings) {
  return settings.utm ? utmEqualsFilter_(settings.utm) : '';
}

function fetchBehavior_(settings, mode) {
  var extra = '';
  if (mode === 'except' && settings.utm) {
    extra = utmNotEqualsFilter_(settings.utm);
  } else if (mode !== 'except') {
    extra = primaryFilter_(settings);
  }
  var result = fetchReportTotals_(settings, extra, [
    'ym:s:visits',
    'ym:s:pageDepth',
    'ym:s:bounceRate',
    'ym:s:avgVisitDurationSeconds'
  ]);
  return {
    visits: Math.round(num_(result.totals[0])),
    pageDepth: round2_(result.totals[1]),
    bounceRate: round1_(result.totals[2]),
    avgDuration: round1_(result.totals[3]),
    sampled: result.sampled
  };
}

function isUnknownDimension_(name) {
  var n = String(name || '').trim().toLowerCase();
  return !n || n === 'null' || n === 'undefined' || n === 'не определено' || n === 'unknown' || n === '-';
}

function percentsFromRows_(rows, totalKnown) {
  if (!totalKnown) {
    return { insufficient: true, values: {} };
  }
  var values = {};
  for (var key in rows) {
    if (Object.prototype.hasOwnProperty.call(rows, key)) {
      values[key] = round1_(rows[key] * 100 / totalKnown);
    }
  }
  return { insufficient: false, values: values };
}

function matchAgeBucket_(name, id) {
  var n = String(name || '').toLowerCase();
  if (/младше\s*18|<18|under\s*18/.test(n)) {
    return 'under18';
  }
  if (/18\s*[-–]\s*24/.test(n)) {
    return '18_24';
  }
  if (/25\s*[-–]\s*34/.test(n)) {
    return '25_34';
  }
  if (/35\s*[-–]\s*44/.test(n)) {
    return '35_44';
  }
  if (/45\s*[-–]\s*54/.test(n)) {
    return '45_54';
  }
  if (/55/.test(n) || /и\s*старше/.test(n)) {
    return '55plus';
  }
  var sid = String(id == null ? '' : id);
  var byId = {
    '1': 'under18',
    '17': 'under18',
    '2': '18_24',
    '18': '18_24',
    '3': '25_34',
    '25': '25_34',
    '4': '35_44',
    '35': '35_44',
    '5': '45_54',
    '45': '45_54',
    '6': '55plus',
    '55': '55plus'
  };
  return byId[sid] || null;
}

function fetchAge_(settings) {
  var result = fetchBreakdown_(settings, primaryFilter_(settings), 'ym:s:ageInterval', 'ym:s:users');
  if (result.containsSensitive && (!result.data || !result.data.length)) {
    return { insufficient: true, values: {} };
  }
  var counts = { under18: 0, '18_24': 0, '25_34': 0, '35_44': 0, '45_54': 0, '55plus': 0 };
  var known = 0;
  for (var i = 0; i < result.data.length; i++) {
    var dim = result.data[i].dimensions && result.data[i].dimensions[0]
      ? result.data[i].dimensions[0]
      : {};
    var name = dim.name || '';
    if (isUnknownDimension_(name) && dim.id == null) {
      continue;
    }
    var key = matchAgeBucket_(name, dim.id);
    var users = num_(result.data[i].metrics && result.data[i].metrics[0]);
    if (!key || !users) {
      continue;
    }
    counts[key] += users;
    known += users;
  }
  if (known < 10) {
    return { insufficient: true, values: {} };
  }
  return percentsFromRows_(counts, known);
}

function matchGenderKey_(name, id) {
  var n = String(name || '').toLowerCase();
  var sid = String(id == null ? '' : id).toLowerCase();
  if (n === 'female' || sid === 'female' || /жен/.test(n) || /woman/.test(n) || /female/.test(n)) {
    return 'female';
  }
  if (n === 'male' || sid === 'male' || /муж/.test(n) || /male/.test(n)) {
    return 'male';
  }
  return null;
}

function fetchGender_(settings) {
  var result = fetchBreakdown_(settings, primaryFilter_(settings), 'ym:s:gender', 'ym:s:users');
  if (result.containsSensitive && (!result.data || !result.data.length)) {
    return { insufficient: true, values: {} };
  }
  var counts = { female: 0, male: 0 };
  var known = 0;
  for (var i = 0; i < result.data.length; i++) {
    var dim = result.data[i].dimensions && result.data[i].dimensions[0]
      ? result.data[i].dimensions[0]
      : {};
    var name = dim.name || '';
    if (isUnknownDimension_(name) && !dim.id) {
      continue;
    }
    var key = matchGenderKey_(name, dim.id);
    var users = num_(result.data[i].metrics && result.data[i].metrics[0]);
    if (!key || !users) {
      continue;
    }
    counts[key] += users;
    known += users;
  }
  if (known < 10) {
    return { insufficient: true, values: {} };
  }
  return percentsFromRows_(counts, known);
}

function matchDeviceKey_(name, id) {
  var n = String(name || '').toLowerCase();
  var sid = String(id == null ? '' : id).toLowerCase();
  if (sid === '1' || sid === 'desktop' || /desktop|компьютер/.test(n)) {
    return 'desktop';
  }
  if (sid === '3' || sid === 'tablet' || /tablet|планшет/.test(n)) {
    return 'tablet';
  }
  if (sid === '4' || sid === 'tv' || /(^|[^a-zа-я])tv([^a-zа-я]|$)|тв|телевиз/.test(n)) {
    return 'tv';
  }
  if (sid === '2' || sid === 'mobile' || /mobile|smart|телефон|смартфон/.test(n)) {
    return 'mobile';
  }
  return null;
}

function fetchDevices_(settings) {
  var result = fetchBreakdown_(settings, primaryFilter_(settings), 'ym:s:deviceCategory', 'ym:s:visits');
  var counts = { desktop: 0, mobile: 0, tablet: 0 };
  var total = 0;
  for (var i = 0; i < result.data.length; i++) {
    var dim = result.data[i].dimensions && result.data[i].dimensions[0]
      ? result.data[i].dimensions[0]
      : {};
    var name = dim.name || '';
    var visits = num_(result.data[i].metrics && result.data[i].metrics[0]);
    var key = matchDeviceKey_(name, dim.id);
    if (!visits) {
      continue;
    }
    total += visits;
    if (key === 'tv') {
      counts.tv = (counts.tv || 0) + visits;
    } else if (key) {
      counts[key] += visits;
    }
  }
  if (!total) {
    return { insufficient: true, values: {} };
  }
  return percentsFromRows_(counts, total);
}

function goalMetrics_(matched) {
  return matched.map(function(g) {
    return 'ym:s:goal' + g.id + 'reaches';
  });
}

function totalsToGoalMap_(matched, totals) {
  var map = {};
  for (var i = 0; i < matched.length; i++) {
    map[matched[i].id] = Math.round(num_(totals[i]));
  }
  return map;
}

function fetchConversions_(settings, matched) {
  var metrics = goalMetrics_(matched);
  var extraPrimary = primaryFilter_(settings);
  var directResult = fetchReportTotals_(settings, extraPrimary, metrics);
  var directMap = totalsToGoalMap_(matched, directResult.totals);

  var associatedMap = null;
  var conversionNote = '';
  if (settings.utm) {
    try {
      var userResult = fetchReportTotals_(settings, utmUserFilter_(settings.utm), metrics);
      associatedMap = totalsToGoalMap_(matched, userResult.totals);
    } catch (e) {
      conversionNote = 'Ассоциированные конверсии не получены (' + e.message + '). Прямые записаны.';
      associatedMap = null;
    }
  }

  return {
    sampled: directResult.sampled,
    conversionNote: conversionNote,
    items: matched.map(function(g) {
      var direct = directMap[g.id] || 0;
      if (!settings.utm) {
        return { name: g.name, total: direct, direct: null, associated: null };
      }
      var anyTouch = associatedMap ? (associatedMap[g.id] || 0) : null;
      var associated = anyTouch == null ? null : Math.max(0, anyTouch - direct);
      return { name: g.name, total: anyTouch, direct: direct, associated: associated };
    })
  };
}
