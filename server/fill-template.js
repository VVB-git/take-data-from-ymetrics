'use strict';

const fs = require('fs');
const path = require('path');

const DASH = '—';
const REPORT_DIR = path.join(__dirname, '..', 'report');

function get(obj, pathStr) {
  return String(pathStr || '').split('.').reduce(function (acc, key) {
    return acc == null ? undefined : acc[key];
  }, obj);
}

function isEmpty(v) {
  return v === null || v === undefined || v === '';
}

function formatValue(value, fmt) {
  if (isEmpty(value)) return DASH;
  if (fmt === 'text' || !fmt) return String(value);
  const n = Number(value);
  if (isNaN(n)) return DASH;
  if (fmt === 'int' || fmt === 'money') {
    const text = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return fmt === 'money' ? text + ' ₽' : text;
  }
  if (fmt === 'pct0') return Math.round(n) + '%';
  const dec = n.toFixed(2).replace('.', ',');
  if (fmt === 'ctr') return dec + '%';
  if (fmt === 'bounce' || fmt === 'pct') return dec + ' %';
  if (fmt === 'freq' || fmt === 'depth' || fmt === 'dec2') return dec;
  return dec;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function bakeBoundTexts(page, payload) {
  return page.replace(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*\bdata-bind="([^"]+)"[^>]*)>\s*<\/\1>/g, function (full, tag, attrs, bindPath) {
    let fmt = 'text';
    const matchFmt = attrs.match(/data-fmt="([^"]+)"/);
    if (matchFmt) fmt = matchFmt[1];
    const value = formatValue(get(payload, bindPath), fmt);
    return '<' + tag + attrs + '>' + escapeHtml(value) + '</' + tag + '>';
  });
}

function bakeAgeBars(page, payload) {
  const rows = payload.ageShare || [];
  let max = 1;
  rows.forEach(function (r) {
    max = Math.max(max, Number(r.value) || 0);
  });
  const html = rows.map(function (r) {
    const cls = r.key === 'unknown' ? 'bar-row unknown' : 'bar-row';
    const w = Math.max(4, (Number(r.value) || 0) / max * 100);
    return (
      '<div class="' + cls + '">' +
        '<span>' + escapeHtml(formatValue(r.label, 'text')) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%"></div></div>' +
        '<span>' + escapeHtml(formatValue(r.value, 'pct0')) + '</span>' +
      '</div>'
    );
  }).join('');
  return page.replace(/<div class="bars" id="age-bars"><\/div>/, '<div class="bars" id="age-bars">' + html + '</div>');
}

function bakeAgeStats(page, payload) {
  const rows = payload.ageBehavior || [];
  const html = rows.map(function (r) {
    return (
      '<div class="stat-block age">' +
        '<div class="pill-head">' + escapeHtml(formatValue(r.label, 'text')) + '</div>' +
        '<div class="pill"><span class="lab">Отказы:</span> ' + escapeHtml(formatValue(r.bounceRate, 'bounce')) + '</div>' +
        '<div class="pill"><span class="lab">Глубина просмотра:</span> ' + escapeHtml(formatValue(r.pageDepth, 'depth')) + '</div>' +
        '<div class="pill"><span class="lab">Время на сайте:</span> ' + escapeHtml(formatValue(r.avgDuration, 'text')) + '</div>' +
      '</div>'
    );
  }).join('');
  return page.replace(/<div class="stats-grid" id="age-stats"><\/div>/, '<div class="stats-grid" id="age-stats">' + html + '</div>');
}

function conic(stops) {
  return 'conic-gradient(' + stops + ')';
}

function bakeCharts(page, payload) {
  const mp = payload.mediaPlan || {};
  const plan = Number(mp.planClicks) || 0;
  const fact = Number(mp.factClicks) || 0;
  const total = plan + fact;
  if (total) {
    const planDeg = (plan / total) * 360;
    page = page.replace(
      'id="clicks-donut"',
      'id="clicks-donut" style="background:' + conic('from 200deg, var(--purple) 0 ' + planDeg + 'deg, var(--purple-soft) ' + planDeg + 'deg 360deg') + '"'
    );
  }
  const d = payload.devicesShare || {};
  const desk = Number(d.desktop) || 0;
  const tab = Number(d.tablet) || 0;
  const mob = Number(d.mobile) || 0;
  const sum = desk + tab + mob || 1;
  const d1 = (mob / sum) * 360;
  const d2 = d1 + (tab / sum) * 360;
  page = page.replace(
    'id="device-donut"',
    'id="device-donut" style="background:' + conic('from 110deg, var(--purple) 0 ' + d1 + 'deg, var(--magenta) ' + d1 + 'deg ' + d2 + 'deg, #c9c6ff ' + d2 + 'deg 360deg') + '"'
  );
  const g = payload.genderShare || {};
  const male = Number(g.male) || 0;
  const female = Number(g.female) || 0;
  page = page.replace(
    'id="gender-male"',
    'id="gender-male" style="background:' + conic('var(--male) 0 ' + male * 3.6 + 'deg, #dfe2f5 ' + male * 3.6 + 'deg 360deg') + '"'
  );
  page = page.replace(
    'id="gender-female"',
    'id="gender-female" style="background:' + conic('var(--magenta) 0 ' + female * 3.6 + 'deg, #f3e4f7 ' + female * 3.6 + 'deg 360deg') + '"'
  );
  return page;
}

function fillTemplate(payload) {
  let page = fs.readFileSync(path.join(REPORT_DIR, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(REPORT_DIR, 'styles.css'), 'utf8');
  const title = payload.meta && payload.meta.campaignName
    ? ('Отчёт — ' + payload.meta.campaignName)
    : 'Отчёт';
  page = page.replace(/<title>[^<]*<\/title>/i, '<title>' + escapeHtml(title) + '</title>');
  page = page.replace(/<link[^>]*href="styles\.css[^"]*"[^>]*>/i, '<style>\n' + css + '\n</style>');
  page = bakeBoundTexts(page, payload);
  page = bakeAgeBars(page, payload);
  page = bakeAgeStats(page, payload);
  page = bakeCharts(page, payload);
  page = page.replace(/<script src="data\.js[^"]*"><\/script>\s*/i, '');
  page = page.replace(/<script src="render\.js[^"]*"><\/script>\s*/i, '');
  return page;
}

module.exports = { fillTemplate: fillTemplate };
