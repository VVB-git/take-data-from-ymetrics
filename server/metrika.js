'use strict';

const YM_API = 'https://api-metrika.yandex.net';
const YM_MAX_RETRIES = 4;
const YM_GEO_TOP = 10;

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function escapeFilterValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildFilters(settings, extraFilter) {
  const parts = [];
  if (!settings.includeRobots) {
    parts.push("ym:s:isRobot=='No'");
  }
  if (extraFilter) {
    parts.push(extraFilter);
  }
  return parts.join(' AND ');
}

function utmEqualsFilter(utm) {
  return "ym:s:UTMSource=='" + escapeFilterValue(utm) + "'";
}

function sliceFilter(settings, mode) {
  if (mode === 'except' && settings.utm) {
    return "ym:s:UTMSource!='" + escapeFilterValue(settings.utm) + "'";
  }
  if (mode === 'except') {
    return '';
  }
  return settings.utm ? utmEqualsFilter(settings.utm) : '';
}

function encodeQuery(params) {
  return Object.keys(params)
    .filter(function (key) {
      const value = params[key];
      return value !== '' && value != null;
    })
    .map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');
}

function parseMetrikaError(code, body) {
  let message = '';
  try {
    const json = JSON.parse(body);
    if (json.message) message = json.message;
    if (json.errors && json.errors.length) {
      message = json.errors.map(function (err) {
        return err.message || err.error_type || '';
      }).filter(Boolean).join('; ');
    }
  } catch (e) {
    if (body) message = String(body).substring(0, 240);
  }
  if (code === 401) return 'Токен неверный или истёк. Вставьте новый OAuth-токен.';
  if (code === 403) return 'Нет доступа к этому счётчику. Проверьте номер и право metrika:read.';
  if (code === 404) return 'Счётчик не найден. Проверьте номер.';
  if (code === 429) return 'Метрика временно ограничила запросы. Подождите минуту и нажмите ещё раз.';
  return message ? ('Метрика: ' + message) : ('Ошибка Метрики, код ' + code);
}

async function metrikaFetch(pathAndQuery, token) {
  const url = YM_API + pathAndQuery;
  let lastError = 'Не удалось связаться с Метрикой.';
  for (let attempt = 1; attempt <= YM_MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: 'OAuth ' + token,
        Accept: 'application/json'
      }
    });
    const body = await response.text();
    const code = response.status;
    if (code >= 200 && code < 300) {
      try {
        return JSON.parse(body);
      } catch (e) {
        throw new Error('Метрика вернула ответ, который не получилось прочитать.');
      }
    }
    lastError = parseMetrikaError(code, body);
    const retryable = code === 429 || code >= 500;
    if (!retryable || attempt === YM_MAX_RETRIES) {
      throw new Error(lastError);
    }
    await sleep(1500 * attempt);
  }
  throw new Error(lastError);
}

async function metrikaStat(token, params) {
  const json = await metrikaFetch('/stat/v1/data?' + encodeQuery(params), token);
  await sleep(200);
  return json;
}

function num(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function round1(value) {
  return Math.round(num(value) * 10) / 10;
}

function round2(value) {
  return Math.round(num(value) * 100) / 100;
}

function formatDuration(seconds) {
  if (seconds === '' || seconds == null || isNaN(Number(seconds))) {
    return '—';
  }
  const total = Math.max(0, Math.round(Number(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = function (v) { return String(v).padStart(2, '0'); };
  if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
  return m + ':' + pad(s);
}

async function fetchReportTotals(settings, extraFilter, metrics) {
  const params = {
    ids: settings.counterId,
    metrics: metrics.join(','),
    date1: settings.date1,
    date2: settings.date2,
    accuracy: 'full',
    lang: 'ru',
    attribution: 'last',
    limit: 100
  };
  const filters = buildFilters(settings, extraFilter);
  if (filters) params.filters = filters;
  const json = await metrikaStat(settings.token, params);
  return {
    totals: json.totals || [],
    sampled: !!json.sampled,
    containsSensitive: !!json.contains_sensitive_data,
    data: json.data || []
  };
}

async function fetchBreakdown(settings, extraFilter, dimension, metric, extraParams) {
  const metrics = Array.isArray(metric) ? metric.join(',') : metric;
  const params = {
    ids: settings.counterId,
    metrics: metrics,
    dimensions: dimension,
    date1: settings.date1,
    date2: settings.date2,
    accuracy: 'full',
    lang: 'ru',
    attribution: 'last',
    limit: extraParams && extraParams.limit ? extraParams.limit : 100
  };
  if (extraParams && extraParams.sort) params.sort = extraParams.sort;
  const filters = buildFilters(settings, extraFilter);
  if (filters) params.filters = filters;
  const json = await metrikaStat(settings.token, params);
  return {
    totals: json.totals || [],
    sampled: !!json.sampled,
    containsSensitive: !!json.contains_sensitive_data,
    data: json.data || []
  };
}

async function fetchGoals(settings) {
  const json = await metrikaFetch('/management/v1/counter/' + settings.counterId + '/goals', settings.token);
  return (json.goals || [])
    .map(function (g) { return { id: g.id, name: g.name || '' }; })
    .filter(function (g) { return g.id && g.name; });
}

function normalizeGoalName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseGoalList(value) {
  return String(value || '')
    .split(',')
    .map(function (item) { return item.trim(); })
    .filter(Boolean);
}

function matchGoals(requestedNames, goals) {
  const byNorm = {};
  goals.forEach(function (g) {
    byNorm[normalizeGoalName(g.name)] = g;
  });
  const matched = [];
  const missing = [];
  requestedNames.forEach(function (name) {
    const found = byNorm[normalizeGoalName(name)];
    if (found) matched.push({ requested: name, id: found.id, name: found.name });
    else missing.push(name);
  });
  if (missing.length) {
    const available = goals.map(function (g) { return g.name; }).join(', ');
    throw new Error(
      'Не найдены цели: ' + missing.join(', ') + '.\n\nВ счётчике есть: ' + (available || 'нет целей') + '.'
    );
  }
  return matched;
}

function isUnknownDimension(name) {
  const n = String(name || '').trim().toLowerCase();
  return !n || n === 'null' || n === 'undefined' || n === 'не определено' || n === 'unknown' || n === '-';
}

function percentsFromRows(rows, totalKnown) {
  if (!totalKnown) return { insufficient: true, values: {} };
  const values = {};
  Object.keys(rows).forEach(function (key) {
    values[key] = round1(rows[key] * 100 / totalKnown);
  });
  return { insufficient: false, values: values };
}

async function fetchBehavior(settings, mode) {
  const result = await fetchReportTotals(settings, sliceFilter(settings, mode), [
    'ym:s:visits',
    'ym:s:pageDepth',
    'ym:s:bounceRate',
    'ym:s:avgVisitDurationSeconds'
  ]);
  return {
    visits: Math.round(num(result.totals[0])),
    pageDepth: round2(result.totals[1]),
    bounceRate: round1(result.totals[2]),
    avgDuration: round1(result.totals[3]),
    sampled: result.sampled
  };
}

function matchAgeBucket(name, id) {
  const n = String(name || '').toLowerCase();
  if (/младше\s*18|<18|under\s*18/.test(n)) return 'under18';
  if (/18\s*[-–]\s*24/.test(n)) return '18_24';
  if (/25\s*[-–]\s*34/.test(n)) return '25_34';
  if (/35\s*[-–]\s*44/.test(n)) return '35_44';
  if (/45\s*[-–]\s*54/.test(n)) return '45_54';
  if (/55/.test(n) || /и\s*старше/.test(n)) return '55plus';
  const sid = String(id == null ? '' : id);
  const byId = {
    '1': 'under18', '17': 'under18', '2': '18_24', '18': '18_24',
    '3': '25_34', '25': '25_34', '4': '35_44', '35': '35_44',
    '5': '45_54', '45': '45_54', '6': '55plus', '55': '55plus'
  };
  return byId[sid] || null;
}

function catalogAgeKey(name, id) {
  const key = matchAgeBucket(name, id);
  if (key === 'under18' || !key) return 'unknown';
  return key;
}

async function fetchAge(settings, mode) {
  const result = await fetchBreakdown(settings, sliceFilter(settings, mode), 'ym:s:ageInterval', 'ym:s:users');
  const data = result.data || [];
  if (result.containsSensitive && !data.length) {
    return { insufficient: true, values: {}, sampled: result.sampled };
  }
  const counts = { '18_24': 0, '25_34': 0, '35_44': 0, '45_54': 0, '55plus': 0, unknown: 0 };
  let total = 0;
  data.forEach(function (row) {
    const dim = row.dimensions && row.dimensions[0] ? row.dimensions[0] : {};
    const users = num(row.metrics && row.metrics[0]);
    if (!users) return;
    const key = catalogAgeKey(dim.name || '', dim.id);
    counts[key] += users;
    total += users;
  });
  if (settings.includeUnknownAge === false) {
    total -= counts.unknown;
    counts.unknown = 0;
  }
  if (total < 10) return { insufficient: true, values: {}, sampled: result.sampled };
  const out = percentsFromRows(counts, total);
  out.sampled = result.sampled;
  return out;
}

function matchGenderKey(name, id) {
  const n = String(name || '').toLowerCase();
  const sid = String(id == null ? '' : id).toLowerCase();
  if (n === 'female' || sid === 'female' || /жен/.test(n) || /woman/.test(n) || /female/.test(n)) return 'female';
  if (n === 'male' || sid === 'male' || /муж/.test(n) || /male/.test(n)) return 'male';
  return null;
}

async function fetchGender(settings, mode) {
  const result = await fetchBreakdown(settings, sliceFilter(settings, mode), 'ym:s:gender', 'ym:s:users');
  if (result.containsSensitive && (!result.data || !result.data.length)) {
    return { insufficient: true, values: {}, sampled: result.sampled };
  }
  const counts = { female: 0, male: 0, unknown: 0 };
  let total = 0;
  result.data.forEach(function (row) {
    const dim = row.dimensions && row.dimensions[0] ? row.dimensions[0] : {};
    const users = num(row.metrics && row.metrics[0]);
    if (!users) return;
    const key = matchGenderKey(dim.name || '', dim.id);
    if (!key || isUnknownDimension(dim.name || '')) counts.unknown += users;
    else counts[key] += users;
    total += users;
  });
  if (total < 10) return { insufficient: true, values: {}, sampled: result.sampled };
  const out = percentsFromRows(counts, total);
  out.sampled = result.sampled;
  return out;
}

function matchDeviceKey(name, id) {
  const n = String(name || '').toLowerCase();
  const sid = String(id == null ? '' : id).toLowerCase();
  if (sid === '1' || sid === 'desktop' || /desktop|компьютер/.test(n)) return 'desktop';
  if (sid === '3' || sid === 'tablet' || /tablet|планшет/.test(n)) return 'tablet';
  if (sid === '4' || sid === 'tv' || /(^|[^a-zа-я])tv([^a-zа-я]|$)|тв|телевиз/.test(n)) return 'tv';
  if (sid === '2' || sid === 'mobile' || /mobile|smart|телефон|смартфон/.test(n)) return 'mobile';
  return null;
}

async function fetchDevices(settings, mode) {
  const result = await fetchBreakdown(settings, sliceFilter(settings, mode), 'ym:s:deviceCategory', 'ym:s:visits');
  const counts = { desktop: 0, mobile: 0, tablet: 0 };
  let tv = 0;
  let other = 0;
  let total = 0;
  result.data.forEach(function (row) {
    const dim = row.dimensions && row.dimensions[0] ? row.dimensions[0] : {};
    const visits = num(row.metrics && row.metrics[0]);
    const key = matchDeviceKey(dim.name || '', dim.id);
    if (!visits) return;
    total += visits;
    if (key === 'tv') tv += visits;
    else if (key) counts[key] += visits;
    else other += visits;
  });
  const threeTotal = counts.desktop + counts.mobile + counts.tablet;
  if (!threeTotal) {
    return { insufficient: true, values: {}, tv: total ? round1(tv * 100 / total) : 0, sampled: result.sampled };
  }
  const out = percentsFromRows(counts, threeTotal);
  out.tv = total ? round1(tv * 100 / total) : 0;
  out.other = total ? round1(other * 100 / total) : 0;
  out.sampled = result.sampled;
  return out;
}

async function fetchDevicesBehavior(settings, mode) {
  const result = await fetchBreakdown(
    settings,
    sliceFilter(settings, mode),
    'ym:s:deviceCategory',
    ['ym:s:bounceRate', 'ym:s:pageDepth', 'ym:s:avgVisitDurationSeconds']
  );
  const values = {};
  result.data.forEach(function (row) {
    const dim = row.dimensions && row.dimensions[0] ? row.dimensions[0] : {};
    const key = matchDeviceKey(dim.name || '', dim.id);
    if (key !== 'desktop' && key !== 'mobile' && key !== 'tablet') return;
    const metrics = row.metrics || [];
    values[key] = {
      bounceRate: round1(metrics[0]),
      pageDepth: round2(metrics[1]),
      avgDuration: formatDuration(round1(metrics[2]))
    };
  });
  return { values: values, sampled: result.sampled };
}

function ageLabel(key) {
  const map = { '18_24': '18–24', '25_34': '25–34', '35_44': '35–44', '45_54': '45–54', '55plus': '55+', unknown: 'не определено' };
  return map[key] || key;
}

function genderLabel(key) {
  if (key === 'female') return 'женщины';
  if (key === 'male') return 'мужчины';
  return 'не определено';
}

async function fetchBehaviorBySocdem(settings, mode) {
  const result = await fetchBreakdown(
    settings,
    sliceFilter(settings, mode),
    'ym:s:ageInterval,ym:s:gender',
    ['ym:s:bounceRate', 'ym:s:pageDepth', 'ym:s:avgVisitDurationSeconds', 'ym:s:visits']
  );
  if (result.containsSensitive && (!result.data || !result.data.length)) {
    return { insufficient: true, items: [], sampled: result.sampled };
  }
  const items = result.data.map(function (row) {
    const dims = row.dimensions || [];
    const ageDim = dims[0] || {};
    const genderDim = dims[1] || {};
    const metrics = row.metrics || [];
    let genderKey = matchGenderKey(genderDim.name || '', genderDim.id);
    if (!genderKey || isUnknownDimension(genderDim.name || '')) genderKey = 'unknown';
    const ageKey = catalogAgeKey(ageDim.name || '', ageDim.id);
    return {
      ageKey: ageKey,
      genderKey: genderKey,
      ageLabel: ageLabel(ageKey),
      genderLabel: genderLabel(genderKey),
      bounceRate: round1(metrics[0]),
      pageDepth: round2(metrics[1]),
      avgDuration: round1(metrics[2]),
      visits: Math.round(num(metrics[3]))
    };
  });
  return { insufficient: false, items: items, sampled: result.sampled };
}

async function fetchNewUsers(settings, mode) {
  const result = await fetchReportTotals(settings, sliceFilter(settings, mode), ['ym:s:percentNewVisitors']);
  return { percent: round1(result.totals[0]), sampled: result.sampled };
}

function goalMetrics(matched) {
  return matched.map(function (g) { return 'ym:s:goal' + g.id + 'reaches'; });
}

async function fetchGeoConversions(settings, matched, mode) {
  if (!matched || !matched.length) return { items: [], sampled: false, skipped: true };
  const result = await fetchBreakdown(settings, sliceFilter(settings, mode), 'ym:s:regionCity', goalMetrics(matched), { limit: 100 });
  const cities = [];
  result.data.forEach(function (row) {
    const dim = row.dimensions && row.dimensions[0] ? row.dimensions[0] : {};
    const name = dim.name || '';
    if (isUnknownDimension(name)) return;
    const perGoal = {};
    let sum = 0;
    const rowMetrics = row.metrics || [];
    matched.forEach(function (g, i) {
      const value = Math.round(num(rowMetrics[i]));
      perGoal[g.name] = value;
      sum += value;
    });
    if (sum) cities.push({ name: name, total: sum, perGoal: perGoal });
  });
  cities.sort(function (a, b) { return b.total - a.total; });
  return { items: cities.slice(0, YM_GEO_TOP), sampled: result.sampled, skipped: false };
}

async function fetchBannerClicks(settings, mode) {
  const result = await fetchBreakdown(settings, sliceFilter(settings, mode), 'ym:s:UTMContent', 'ym:s:visits', {
    limit: 100,
    sort: '-ym:s:visits'
  });
  const items = [];
  let unlabeled = 0;
  result.data.forEach(function (row) {
    const dim = row.dimensions && row.dimensions[0] ? row.dimensions[0] : {};
    const name = String(dim.name || '').trim();
    const visits = Math.round(num(row.metrics && row.metrics[0]));
    if (!visits) return;
    if (isUnknownDimension(name)) {
      unlabeled += visits;
      return;
    }
    items.push({ name: name, visits: visits });
  });
  return { items: items, unlabeled: unlabeled, empty: !items.length, sampled: result.sampled };
}

function totalsToGoalMap(matched, totals) {
  const map = {};
  matched.forEach(function (g, i) {
    map[g.id] = Math.round(num(totals[i]));
  });
  return map;
}

async function fetchConversions(settings, matched) {
  const metrics = goalMetrics(matched);
  const extraPrimary = settings.utm ? utmEqualsFilter(settings.utm) : '';
  const directResult = await fetchReportTotals(settings, extraPrimary, metrics);
  const directMap = totalsToGoalMap(matched, directResult.totals);
  let associatedMap = null;
  let conversionNote = '';
  if (settings.utm) {
    try {
      const userResult = await fetchReportTotals(settings, 'USER(' + utmEqualsFilter(settings.utm) + ')', metrics);
      associatedMap = totalsToGoalMap(matched, userResult.totals);
    } catch (e) {
      conversionNote = 'Ассоциированные конверсии не получены (' + e.message + '). Прямые записаны.';
    }
  }
  const items = matched.map(function (g) {
    const direct = directMap[g.id] || 0;
    if (!settings.utm) return { name: g.name, total: direct, direct: direct, associated: null };
    const anyTouch = associatedMap ? (associatedMap[g.id] || 0) : null;
    const associated = anyTouch == null ? null : Math.max(0, anyTouch - direct);
    return { name: g.name, total: anyTouch, direct: direct, associated: associated };
  });
  let directTotal = 0;
  let associatedTotal = 0;
  const associatedOk = settings.utm && associatedMap != null;
  items.forEach(function (item) {
    directTotal += item.direct || 0;
    if (associatedOk && item.associated != null) associatedTotal += item.associated;
  });
  return {
    sampled: directResult.sampled,
    conversionNote: conversionNote,
    items: items,
    directTotal: directTotal,
    associatedTotal: associatedOk ? associatedTotal : null
  };
}

module.exports = {
  parseGoalList: parseGoalList,
  fetchGoals: fetchGoals,
  matchGoals: matchGoals,
  fetchBehavior: fetchBehavior,
  fetchAge: fetchAge,
  fetchGender: fetchGender,
  fetchDevices: fetchDevices,
  fetchDevicesBehavior: fetchDevicesBehavior,
  fetchBehaviorBySocdem: fetchBehaviorBySocdem,
  fetchNewUsers: fetchNewUsers,
  fetchGeoConversions: fetchGeoConversions,
  fetchBannerClicks: fetchBannerClicks,
  fetchConversions: fetchConversions,
  formatDuration: formatDuration,
  round1: round1,
  round2: round2
};
