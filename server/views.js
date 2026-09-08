'use strict';

const { FIELD_GROUPS } = require('./fields');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fieldControl(field, value) {
  const id = 'f-' + field.key;
  const common = 'id="' + id + '" name="' + escapeHtml(field.key) + '"' + (field.required ? ' required' : '');
  if (field.type === 'textarea') {
    return '<textarea ' + common + ' rows="3">' + escapeHtml(value) + '</textarea>';
  }
  if (field.type === 'yesno') {
    const yes = value === 'нет' ? '' : ' selected';
    const no = value === 'нет' ? ' selected' : '';
    return (
      '<select ' + common + '>' +
        '<option value="да"' + yes + '>да</option>' +
        '<option value="нет"' + no + '>нет</option>' +
      '</select>'
    );
  }
  const type = field.type === 'password' || field.type === 'date' ? field.type : 'text';
  return '<input type="' + type + '" ' + common + ' value="' + escapeHtml(value) + '">';
}

function renderGroups(settings) {
  return FIELD_GROUPS.map(function (group) {
    const fields = group.fields.map(function (field) {
      const note = field.note ? '<p class="note">' + escapeHtml(field.note) + '</p>' : '';
      return (
        '<label class="field" for="f-' + escapeHtml(field.key) + '">' +
          '<span class="field-label">' + escapeHtml(field.label) + (field.required ? ' *' : '') + '</span>' +
          fieldControl(field, settings[field.key] == null ? '' : settings[field.key]) +
          note +
        '</label>'
      );
    }).join('');
    return (
      '<section class="card" id="' + escapeHtml(group.id) + '">' +
        '<h2>' + escapeHtml(group.title) + '</h2>' +
        '<div class="grid">' + fields + '</div>' +
      '</section>'
    );
  }).join('');
}

function layout(title, bodyClass, inner) {
  return '<!DOCTYPE html>\n' +
    '<html lang="ru">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '  <title>' + escapeHtml(title) + '</title>\n' +
    '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n' +
    '  <link rel="stylesheet" href="/app.css">\n' +
    '</head>\n' +
    '<body class="' + escapeHtml(bodyClass) + '">\n' +
    inner +
    '</body>\n' +
    '</html>\n';
}

function formPage(opts) {
  const settings = opts.settings || {};
  const error = opts.error ? '<div class="banner error" role="status">' + escapeHtml(opts.error) + '</div>' : '';
  const saved = opts.saved ? '<div class="banner ok" role="status">Черновик сохранён. Можно собирать отчёт позже.</div>' : '';
  const inner =
    '<div class="page">\n' +
    '  <header class="hero">\n' +
    '    <p class="eyebrow">Локальный сервис для ассистентов АМ</p>\n' +
    '    <h1>Сбор отчёта<br><span>из Яндекс.Метрики</span></h1>\n' +
    '    <p class="lead">Заполните поля как раньше на листе «Настройки» и жёлтых ячейках медиаплана. Цифры Метрики попадут в HTML-файл — без таблиц и без скриптов в отчёте.</p>\n' +
    '  </header>\n' +
    error + saved +
    '  <form method="post" action="/collect" autocomplete="off">\n' +
    renderGroups(settings) +
    '    <div class="actions sticky">\n' +
    '      <button type="submit" formaction="/draft" formnovalidate class="btn ghost">Сохранить черновик</button>\n' +
    '      <button type="submit" class="btn primary">Собрать отчёт</button>\n' +
    '    </div>\n' +
    '  </form>\n' +
    '</div>\n';
  return layout('Отчёт Метрики', 'form-page', inner);
}

function progressPage() {
  const inner =
    '<div class="page progress-page">\n' +
    '  <header class="hero">\n' +
    '    <p class="eyebrow">Сбор из Метрики</p>\n' +
    '    <h1>Идёт <span>отчёт</span></h1>\n' +
    '    <p class="lead" id="status-text">Читаю настройки и запрашиваю срезы.</p>\n' +
    '  </header>\n' +
    '  <section class="card progress-card">\n' +
    '    <div class="meter"><div class="meter-fill" id="meter"></div></div>\n' +
    '    <p class="percent" id="percent">0%</p>\n' +
    '    <ul class="steps" id="steps"></ul>\n' +
    '    <div class="banner error" id="error" hidden></div>\n' +
    '    <div class="done-actions" id="error-actions" hidden>\n' +
    '      <a class="btn ghost" href="/">К форме</a>\n' +
    '    </div>\n' +
    '    <div class="done-actions" id="done" hidden>\n' +
    '      <a class="btn primary" href="/report.html">Скачать отчёт</a>\n' +
    '      <a class="btn ghost" href="/">К форме</a>\n' +
    '    </div>\n' +
    '    <p class="note sampled" id="sampled" hidden>Метрика отдала семплированные данные — цифры могут чуть отличаться от кабинета.</p>\n' +
    '  </section>\n' +
    '</div>\n' +
    '<script src="/progress.js"></script>\n';
  return layout('Сбор отчёта', 'progress-body', inner);
}

module.exports = {
  formPage: formPage,
  progressPage: progressPage
};
