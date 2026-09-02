/**
 * Листы «Настройки» и «Данные»: разметка, чтение формы, запись отчёта.
 */

var YM_SHEET_SETTINGS = 'Настройки';
var YM_SHEET_DATA = 'Данные';
var YM_TOKEN_SAVED = 'токен сохранён';
var YM_TOKEN_PROP = 'METRIKA_OAUTH_TOKEN';
var YM_PROGRESS_KEY = 'YM_REPORT_PROGRESS';

var YM_AGE_BUCKETS = [
  { key: 'under18', label: 'младше 18' },
  { key: '18_24', label: '18–24' },
  { key: '25_34', label: '25–34' },
  { key: '35_44', label: '35–44' },
  { key: '45_54', label: '45–54' },
  { key: '55plus', label: '55+' }
];

function getSettingsSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(YM_SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(YM_SHEET_SETTINGS);
  }
  return sheet;
}

function getDataSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(YM_SHEET_DATA);
  if (!sheet) {
    sheet = ss.insertSheet(YM_SHEET_DATA);
  }
  return sheet;
}

function setupWorkbook() {
  ensureLayout_();
  SpreadsheetApp.getActive().toast('Таблица подготовлена. Заполните лист «Настройки».', 'Отчёт Метрики', 6);
}

function ensureLayout_() {
  ensureSettingsLayout_();
  ensureDataLayoutPlaceholder_();
}

function mergeIfNeeded_(sheet, a1) {
  var range = sheet.getRange(a1);
  if (!range.isPartOfMerge()) {
    range.merge();
  }
}

function ensureSettingsLayout_() {
  var sheet = getSettingsSheet_();
  sheet.setTabColor('#1a73e8');
  sheet.setHiddenGridlines(true);
  sheet.setColumnWidth(1, 280);
  sheet.setColumnWidth(2, 280);
  sheet.setColumnWidth(3, 24);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 360);
  sheet.setColumnWidth(6, 24);
  sheet.setColumnWidth(7, 280);
  sheet.setColumnWidth(8, 120);
  sheet.getRange('A1:B10').setBorder(false, false, false, false, false, false);

  mergeIfNeeded_(sheet, 'A1:B1');
  setIfEmptyOrTemplate_(sheet, 'A1', 'Отчёт Яндекс.Метрики');
  sheet.getRange('A1').setFontSize(18).setFontWeight('bold').setFontColor('#1a73e8');

  mergeIfNeeded_(sheet, 'A2:B2');
  setIfEmptyOrTemplate_(sheet, 'A2', 'Заполните жёлтые поля → меню «Отчёт Метрики» → «Собрать отчёт». Метка и конверсии необязательны.');
  sheet.getRange('A2').setWrap(true).setFontColor('#5f6368');
  sheet.setRowHeight(2, 40);

  var labels = [
    [4, 'Номер счётчика', 'Только цифры, как в Метрике. Пример: 44147844'],
    [5, 'OAuth-токен', 'Вставьте токен один раз — скрипт сохранит его и скроет. Нужно право metrika:read.'],
    [6, 'Метка (utm_source)', 'Можно оставить пустым — тогда отчёт по всем источникам.'],
    [7, 'Учитывать роботов', 'Да — роботы входят в цифры. Нет — как в интерфейсе Метрики без роботов.'],
    [8, 'Дата начала', 'Первый день периода'],
    [9, 'Дата конца', 'Последний день периода']
  ];

  for (var i = 0; i < labels.length; i++) {
    var row = labels[i][0];
    sheet.getRange(row, 1).setValue(labels[i][1]).setFontWeight('bold').setBackground('#f1f3f4');
    sheet.getRange(row, 2).setBackground('#fff8e1').setNote(labels[i][2]);
  }

  if (!String(sheet.getRange('B7').getDisplayValue() || '').trim()) {
    sheet.getRange('B7').setValue('Да');
  }
  var robotsRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Да', 'Нет'], true)
    .setAllowInvalid(false)
    .setHelpText('Да — включить роботов в отчёт. Нет — исключить.')
    .build();
  sheet.getRange('B7').setDataValidation(robotsRule);

  sheet.getRange('B8:B9').setNumberFormat('yyyy-mm-dd');
  var dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(true)
    .setHelpText('Выберите дату')
    .build();
  sheet.getRange('B8:B9').setDataValidation(dateRule);

  sheet.getRange('A11').setValue('Названия конверсий').setFontWeight('bold');
  mergeIfNeeded_(sheet, 'A11:B11');
  mergeIfNeeded_(sheet, 'A12:B12');
  sheet.getRange('A12').setValue('Необязательно. По одному названию в столбец B, как цель называется в Метрике. Если пусто — конверсии не запрашиваем.')
    .setFontColor('#5f6368').setWrap(true);
  sheet.setRowHeight(12, 48);

  sheet.getRange('A13').setValue('Цель в Метрике').setFontWeight('bold').setBackground('#f1f3f4');
  sheet.getRange('B13').setValue('Название').setFontWeight('bold').setBackground('#f1f3f4');
  sheet.getRange('B14:B28').setBackground('#fff8e1');
  for (var r = 14; r <= 28; r++) {
    sheet.getRange(r, 1).setValue(r - 13);
  }

  sheet.getRange('D4').setValue('Статус').setFontWeight('bold').setBackground('#f1f3f4');
  sheet.getRange('D5').setValue('Последний запуск').setFontWeight('bold').setBackground('#f1f3f4');
  sheet.getRange('D6').setValue('Комментарий').setFontWeight('bold').setBackground('#f1f3f4');
  sheet.getRange('E4:E6').setBackground('#e8f0fe').setWrap(true);
  sheet.getRange('D6:E6').setWrap(true);
  sheet.setRowHeight(6, 64);
  if (!String(sheet.getRange('E4').getDisplayValue() || '').trim()) {
    sheet.getRange('E4').setValue('ожидание');
  }

  sheet.getRange('G3').setValue('Цели счётчика').setFontWeight('bold').setFontColor('#1a73e8');
  sheet.getRange('G4').setValue('Нажмите «Показать цели счётчика», чтобы подставить точные имена.')
    .setFontColor('#5f6368').setWrap(true);
  mergeIfNeeded_(sheet, 'G3:H3');
  mergeIfNeeded_(sheet, 'G4:H4');

  sheet.getRange('A4:B9').setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange('D4:E6').setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
}

function setIfEmptyOrTemplate_(sheet, a1, value) {
  var cell = sheet.getRange(a1);
  var current = String(cell.getDisplayValue() || '').trim();
  if (!current) {
    cell.setValue(value);
  }
}

function ensureDataLayoutPlaceholder_() {
  var sheet = getDataSheet_();
  sheet.setTabColor('#137333');
  sheet.setColumnWidth(1, 420);
  sheet.setColumnWidth(2, 220);
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1').setValue('Показатель').setFontWeight('bold');
    sheet.getRange('B1').setValue('Значение').setFontWeight('bold');
    sheet.getRange('A2').setValue('Здесь появятся данные после кнопки «Собрать отчёт».');
  }
}

function readSettings_() {
  var sheet = getSettingsSheet_();
  var tokenCell = String(sheet.getRange('B5').getDisplayValue() || '').trim();
  var stored = PropertiesService.getDocumentProperties().getProperty(YM_TOKEN_PROP) || '';
  var token = stored;
  var tokenFromSheet = false;
  if (tokenCell && tokenCell.toLowerCase() !== YM_TOKEN_SAVED) {
    token = tokenCell;
    tokenFromSheet = true;
  }

  var conversions = [];
  var convValues = sheet.getRange('B14:B40').getDisplayValues();
  for (var i = 0; i < convValues.length; i++) {
    var name = String(convValues[i][0] || '').trim();
    if (name) {
      conversions.push(name);
    }
  }

  var robotsRaw = String(sheet.getRange('B7').getDisplayValue() || 'Да').trim().toLowerCase();
  var includeRobots = robotsRaw !== 'нет' && robotsRaw !== 'no' && robotsRaw !== 'false';

  var counterCell = sheet.getRange('B4').getValue();
  var counterId = '';
  if (typeof counterCell === 'number' && isFinite(counterCell)) {
    counterId = String(Math.round(counterCell));
  } else {
    counterId = String(counterCell || '').replace(/\s+/g, '').replace(/,/g, '').replace(/\.0+$/, '');
  }

  return {
    counterId: counterId,
    token: token,
    tokenFromSheet: tokenFromSheet,
    utm: String(sheet.getRange('B6').getDisplayValue() || '').trim(),
    includeRobots: includeRobots,
    date1: toIsoDate_(sheet.getRange('B8').getValue(), 'начала'),
    date2: toIsoDate_(sheet.getRange('B9').getValue(), 'конца'),
    conversions: conversions
  };
}

function validateAccessSettings_(settings) {
  if (!/^\d+$/.test(settings.counterId)) {
    throw new Error('Укажите номер счётчика цифрами, без текста.');
  }
  if (!settings.token) {
    throw new Error('Нет OAuth-токена. Вставьте его в жёлтое поле на листе «Настройки».');
  }
}

function validateSettings_(settings) {
  validateAccessSettings_(settings);
  if (!settings.date1 || !settings.date2) {
    throw new Error('Укажите дату начала и дату конца периода.');
  }
  if (settings.date1 > settings.date2) {
    throw new Error('Дата начала позже даты конца. Поправьте период.');
  }
}

function saveTokenIfNeeded_(settings) {
  if (!settings.tokenFromSheet) {
    return;
  }
  PropertiesService.getDocumentProperties().setProperty(YM_TOKEN_PROP, settings.token);
  getSettingsSheet_().getRange('B5').setValue(YM_TOKEN_SAVED);
}

function toIsoDate_(value, label) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    if (value.getFullYear() < 1990) {
      return '';
    }
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(value).trim();
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return iso[1] + '-' + iso[2] + '-' + iso[3];
  }
  var dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    return dmy[3] + '-' + pad2_(dmy[2]) + '-' + pad2_(dmy[1]);
  }
  throw new Error('Непонятная дата ' + label + ': «' + s + '». Выберите дату в ячейке.');
}

function pad2_(v) {
  return ('0' + v).slice(-2);
}

function setStatus_(status, when, comment) {
  var sheet = getSettingsSheet_();
  sheet.getRange('E4').setValue(status);
  if (when) {
    sheet.getRange('E5').setValue(Utilities.formatDate(when, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
  }
  sheet.getRange('E6').setValue(comment || '');
  if (status === 'Готово') {
    sheet.getRange('E4').setFontColor('#137333');
  } else if (status === 'Ошибка') {
    sheet.getRange('E4').setFontColor('#c5221f');
  } else {
    sheet.getRange('E4').setFontColor('#174ea6');
  }
  SpreadsheetApp.flush();
}

function setProgress_(step, label, percent) {
  var payload = JSON.stringify({
    step: step,
    label: label,
    percent: percent,
    t: Date.now()
  });
  CacheService.getDocumentCache().put(YM_PROGRESS_KEY, payload, 600);
  PropertiesService.getDocumentProperties().setProperty(YM_PROGRESS_KEY, payload);
}

function getReportProgress() {
  var raw = CacheService.getDocumentCache().get(YM_PROGRESS_KEY)
    || PropertiesService.getDocumentProperties().getProperty(YM_PROGRESS_KEY);
  if (!raw) {
    return { step: '', label: '', percent: 0 };
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { step: '', label: '', percent: 0 };
  }
}

function writeGoalsList_(goals) {
  var sheet = getSettingsSheet_();
  sheet.getRange('G5:H80').clearContent();
  sheet.getRange('G5').setValue('Название').setFontWeight('bold').setBackground('#f1f3f4');
  sheet.getRange('H5').setValue('ID').setFontWeight('bold').setBackground('#f1f3f4');
  if (!goals.length) {
    sheet.getRange('G6').setValue('У счётчика нет целей');
    return;
  }
  var rows = goals.map(function(g) {
    return [g.name, g.id];
  });
  sheet.getRange(6, 7, rows.length, 2).setValues(rows);
}

function writeDataSheet_(report) {
  var sheet = getDataSheet_();
  sheet.clear();
  sheet.setHiddenGridlines(true);
  sheet.setColumnWidth(1, 460);
  sheet.setColumnWidth(2, 240);
  sheet.setFrozenRows(1);

  var rows = [];
  rows.push(['Показатель', 'Значение']);
  rows.push(['Счётчик', Number(report.meta.counterId) || report.meta.counterId]);
  rows.push(['Метка (utm_source)', report.meta.utm || 'все источники']);
  rows.push(['Учитывать роботов', report.meta.includeRobots ? 'Да' : 'Нет']);
  rows.push(['Период', report.meta.date1 + ' — ' + report.meta.date2]);
  rows.push(['Выгружено', report.meta.fetchedAt]);
  if (report.meta.sampled) {
    rows.push(['Выборка Метрики', 'данные семплированы']);
  }
  if (report.meta.conversionNote) {
    rows.push(['Конверсии, примечание', report.meta.conversionNote]);
  }

  rows.push(['', '']);
  rows.push(['Поведение', '']);
  rows.push(['Клики (визиты)', report.primary.visits]);

  var scopeMain = report.meta.utm ? 'наша метка' : 'все источники';
  rows.push(['Глубина просмотра (' + scopeMain + ')', report.primary.pageDepth]);
  rows.push(['Отказы, % (' + scopeMain + ')', report.primary.bounceRate]);
  rows.push(['Среднее время, сек (' + scopeMain + ')', report.primary.avgDuration]);
  rows.push(['Среднее время (' + scopeMain + ')', formatDuration_(report.primary.avgDuration)]);

  if (report.otherSources) {
    rows.push(['Глубина просмотра (все кроме метки)', report.otherSources.pageDepth]);
    rows.push(['Отказы, % (все кроме метки)', report.otherSources.bounceRate]);
    rows.push(['Среднее время, сек (все кроме метки)', report.otherSources.avgDuration]);
    rows.push(['Среднее время (все кроме метки)', formatDuration_(report.otherSources.avgDuration)]);
  }

  rows.push(['', '']);
  rows.push(['Возраст, %', '']);
  appendBreakdown_(rows, report.age, YM_AGE_BUCKETS.map(function(b) {
    return { key: b.key, label: 'Возраст: ' + b.label + ', %' };
  }));

  rows.push(['', '']);
  rows.push(['Пол, %', '']);
  appendBreakdown_(rows, report.gender, [
    { key: 'female', label: 'Пол: женщины, %' },
    { key: 'male', label: 'Пол: мужчины, %' }
  ]);

  rows.push(['', '']);
  rows.push(['Устройства, %', '']);
  appendBreakdown_(rows, report.devices, [
    { key: 'desktop', label: 'Устройства: компьютер, %' },
    { key: 'mobile', label: 'Устройства: телефон, %' },
    { key: 'tablet', label: 'Устройства: планшет, %' }
  ]);
  if (report.devices && report.devices.values && report.devices.values.tv != null) {
    rows.push(['Устройства: TV, %', report.devices.values.tv]);
  }

  if (report.conversions && report.conversions.length) {
    rows.push(['', '']);
    rows.push(['Конверсии', '']);
    for (var i = 0; i < report.conversions.length; i++) {
      var c = report.conversions[i];
      if (report.meta.utm) {
        rows.push(['Конверсия: ' + c.name + ', прямые', c.direct]);
        rows.push(['Конверсия: ' + c.name + ', ассоциированные', c.associated == null ? 'не удалось посчитать' : c.associated]);
      } else {
        rows.push(['Конверсия: ' + c.name, c.total]);
      }
    }
  }

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff');

  var last = rows.length;
  for (var r = 2; r <= last; r++) {
    var label = rows[r - 1][0];
    var value = rows[r - 1][1];
    if (!label && !value) {
      continue;
    }
    if (label && (value === '' || value === null) && [
      'Поведение', 'Возраст, %', 'Пол, %', 'Устройства, %', 'Конверсии'
    ].indexOf(label) !== -1) {
      sheet.getRange(r, 1, 1, 2).merge().setFontWeight('bold').setBackground('#e8f0fe');
    }
  }

  sheet.getRange(2, 1, Math.max(last - 1, 1), 2).setBorder(
    true, true, true, true, false, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID
  );
}

function appendBreakdown_(rows, block, fields) {
  if (!block || block.insufficient) {
    for (var i = 0; i < fields.length; i++) {
      rows.push([fields[i].label, 'недостаточно данных']);
    }
    return;
  }
  for (var j = 0; j < fields.length; j++) {
    var val = block.values[fields[j].key];
    rows.push([fields[j].label, val == null ? 'недостаточно данных' : val]);
  }
}

function formatDuration_(seconds) {
  if (seconds === '' || seconds === null || typeof seconds === 'undefined' || isNaN(Number(seconds))) {
    return '—';
  }
  var total = Math.max(0, Math.round(Number(seconds)));
  var h = Math.floor(total / 3600);
  var m = Math.floor((total % 3600) / 60);
  var s = total % 60;
  if (h > 0) {
    return h + ':' + pad2_(m) + ':' + pad2_(s);
  }
  return m + ':' + pad2_(s);
}
