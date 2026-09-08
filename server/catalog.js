'use strict';

const { formatDuration } = require('./metrika');

const SRC_METRIKA = 'Яндекс.Метрика';
const SRC_INPUT = 'вводится / админка';
const SRC_CALC = 'расчёт';
const SRC_SETTINGS = 'настройки';
const SLICE_PROG = 'программатик';
const SLICE_OTHER = 'другие источники';
const SLICE_NONE = '-';

const AGE_BUCKETS = [
  { key: '18_24', label: '18–24' },
  { key: '25_34', label: '25–34' },
  { key: '35_44', label: '35–44' },
  { key: '45_54', label: '45–54' },
  { key: '55plus', label: '55+' },
  { key: 'unknown', label: 'не определено' }
];

function asNumber(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s || !/\d/.test(s)) return '';
  const n = Number(s.replace(/\s/g, '').replace('%', '').replace(',', '.'));
  return isNaN(n) ? '' : n;
}

function round2(value) {
  const n = Number(value);
  if (!n && n !== 0) return '';
  return Math.round(n * 100) / 100;
}

function pctValue(block, key) {
  if (!block || block.insufficient) return 'недостаточно данных';
  if (!block.values || block.values[key] == null) return 'недостаточно данных';
  return block.values[key];
}

function missingSlice(utm) {
  return utm ? null : 'нужна метка utm_source';
}

function calcDiv(a, b) {
  const x = asNumber(a);
  const y = asNumber(b);
  if (x === '' || y === '' || !y) return '';
  return round2(x / y);
}

function calcImpressions(clicks, ctr) {
  const c = asNumber(clicks);
  const p = asNumber(ctr);
  if (c === '' || !p) return '';
  return Math.round(c / (p / 100));
}

function buildCatalog(settings, report, payload) {
  const rows = [];
  const utm = settings.utm || '';
  const otherGap = missingSlice(utm);
  const goalNames = (report.meta && report.meta.goalNames) || [];
  const noGoals = !goalNames.length;
  const conversions = report.conversions && report.conversions.items ? report.conversions.items : [];
  const totals = report.conversions || {};
  const mp = (payload && payload.mediaPlan) || {};
  const includeUnknown = !(report.meta && report.meta.includeUnknownAge === false);
  const ageBuckets = AGE_BUCKETS.filter(function (b) {
    return b.key !== 'unknown' || includeUnknown;
  });

  function add(code, name, slice, value, source) {
    rows.push({
      code: String(code),
      name: name,
      slice: slice,
      value: value == null ? '' : value,
      source: source
    });
  }

  add(1, 'Дата начала цикла', SLICE_NONE, settings.cycleFrom || '', SRC_INPUT);
  add(2, 'Дата конца цикла', SLICE_NONE, settings.cycleTo || '', SRC_INPUT);
  add(3, 'Дата начала отчетного периода', SLICE_NONE, settings.date1 || '', SRC_SETTINGS);
  add(4, 'Дата конца отчетного периода', SLICE_NONE, settings.date2 || '', SRC_SETTINGS);
  add(5, 'Номер цикла отчета', SLICE_NONE, settings.cycleNumber || '', SRC_INPUT);
  add(6, 'Название рекламной кампании', SLICE_NONE, settings.campaign || '', SRC_SETTINGS);

  add(7, 'Клики, план', SLICE_PROG, settings.planClicks || '', SRC_INPUT);
  add(8, 'Клики, факт (визиты)', SLICE_PROG, report.primary ? report.primary.visits : '', SRC_METRIKA);
  add(9, 'CTR, план', SLICE_PROG, settings.planCtr || '', SRC_INPUT);
  add(10, 'CTR, факт', SLICE_PROG, settings.factCtr || '', SRC_INPUT);
  add(11, 'Показы, план', SLICE_PROG, settings.planImpressions || '', SRC_INPUT);
  add(12, 'Показы, факт', SLICE_PROG, mp.factImpressions, SRC_CALC);
  add(13, 'Охват, план', SLICE_PROG, settings.planReach || '', SRC_INPUT);
  add(14, 'Охват, факт', SLICE_PROG, mp.factReach, SRC_CALC);
  add(15, 'Частота показов, план', SLICE_PROG, settings.planFrequency || 4, SRC_INPUT);
  add(16, 'Частота показов, факт', SLICE_PROG, settings.factFrequency || 4, SRC_INPUT);
  add(17, 'Бюджет, план', SLICE_PROG, settings.planBudget || '', SRC_INPUT);
  add(18, 'Бюджет, факт', SLICE_PROG, settings.budget || '', SRC_INPUT);
  add(19, 'CPC', SLICE_PROG, mp.factCpc, SRC_CALC);

  add(20, 'Глубина просмотра', SLICE_PROG, report.primary ? report.primary.pageDepth : '', SRC_METRIKA);
  add(21, 'Показатель отказов, %', SLICE_PROG, report.primary ? report.primary.bounceRate : '', SRC_METRIKA);
  add(22, 'Среднее время на сайте, сек', SLICE_PROG, report.primary ? report.primary.avgDuration : '', SRC_METRIKA);
  add(22, 'Среднее время на сайте', SLICE_PROG, report.primary ? formatDuration(report.primary.avgDuration) : '', SRC_METRIKA);

  add(23, 'Глубина просмотра', SLICE_OTHER, otherGap || (report.otherSources ? report.otherSources.pageDepth : ''), SRC_METRIKA);
  add(24, 'Показатель отказов, %', SLICE_OTHER, otherGap || (report.otherSources ? report.otherSources.bounceRate : ''), SRC_METRIKA);
  add(25, 'Среднее время на сайте, сек', SLICE_OTHER, otherGap || (report.otherSources ? report.otherSources.avgDuration : ''), SRC_METRIKA);
  if (report.otherSources) {
    add(25, 'Среднее время на сайте', SLICE_OTHER, formatDuration(report.otherSources.avgDuration), SRC_METRIKA);
  }

  add(26, '% компьютеры (ПК)', SLICE_PROG, pctValue(report.devices, 'desktop'), SRC_METRIKA);
  add(27, '% смартфоны', SLICE_PROG, pctValue(report.devices, 'mobile'), SRC_METRIKA);
  add(28, '% планшеты', SLICE_PROG, pctValue(report.devices, 'tablet'), SRC_METRIKA);
  if (report.devices && report.devices.tv) {
    add('', 'Устройства: TV, % от всех визитов', SLICE_PROG, report.devices.tv, SRC_METRIKA);
  }

  add(29, '% компьютеры (ПК)', SLICE_OTHER, otherGap || pctValue(report.devicesOther, 'desktop'), SRC_METRIKA);
  add(30, '% смартфоны', SLICE_OTHER, otherGap || pctValue(report.devicesOther, 'mobile'), SRC_METRIKA);
  add(31, '% планшеты', SLICE_OTHER, otherGap || pctValue(report.devicesOther, 'tablet'), SRC_METRIKA);

  ageBuckets.forEach(function (bucket) {
    add(32, 'Возраст: ' + bucket.label + ', %', SLICE_PROG, pctValue(report.age, bucket.key), SRC_METRIKA);
  });
  add(33, '% мужчины', SLICE_PROG, pctValue(report.gender, 'male'), SRC_METRIKA);
  add(34, '% женщины', SLICE_PROG, pctValue(report.gender, 'female'), SRC_METRIKA);
  if (report.gender && report.gender.values && report.gender.values.unknown) {
    add('', 'Пол: не определено, %', SLICE_PROG, report.gender.values.unknown, SRC_METRIKA);
  }

  ageBuckets.forEach(function (bucket) {
    add(35, 'Возраст: ' + bucket.label + ', %', SLICE_OTHER, otherGap || pctValue(report.ageOther, bucket.key), SRC_METRIKA);
  });
  add(36, '% мужчины', SLICE_OTHER, otherGap || pctValue(report.genderOther, 'male'), SRC_METRIKA);
  add(37, '% женщины', SLICE_OTHER, otherGap || pctValue(report.genderOther, 'female'), SRC_METRIKA);

  if (report.socdemBehavior && report.socdemBehavior.items && report.socdemBehavior.items.length) {
    report.socdemBehavior.items.forEach(function (socRow) {
      const who = socRow.ageLabel + ' / ' + socRow.genderLabel;
      add(38, 'Отказы, % — ' + who, SLICE_PROG, socRow.bounceRate, SRC_METRIKA);
      add(39, 'Глубина — ' + who, SLICE_PROG, socRow.pageDepth, SRC_METRIKA);
      add(40, 'Время на сайте, сек — ' + who, SLICE_PROG, socRow.avgDuration, SRC_METRIKA);
    });
  } else {
    const socdemEmpty = report.socdemBehavior && report.socdemBehavior.insufficient ? 'недостаточно данных' : '';
    add(38, 'Отказы — по каждому из возрастов и полу', SLICE_PROG, socdemEmpty, SRC_METRIKA);
    add(39, 'Глубина по каждому из возрастов и полу', SLICE_PROG, socdemEmpty, SRC_METRIKA);
    add(40, 'Время на сайте по возрасту и полу', SLICE_PROG, socdemEmpty, SRC_METRIKA);
  }

  if (noGoals) {
    add(41, 'Список городов с наибольшим достижением конверсий (Post-Click)', SLICE_PROG, 'не выбраны цели', SRC_METRIKA);
    add(42, 'Значение конверсий (Post-Click) по топовым городам', SLICE_PROG, 'не выбраны цели', SRC_METRIKA);
  } else if (report.geo && report.geo.items && report.geo.items.length) {
    report.geo.items.forEach(function (city, i) {
      add(41, 'Город ' + (i + 1), SLICE_PROG, city.name, SRC_METRIKA);
      add(42, 'Конверсии Post-Click: ' + city.name, SLICE_PROG, city.total, SRC_METRIKA);
    });
  } else {
    add(41, 'Список городов с наибольшим достижением конверсий (Post-Click)', SLICE_PROG, 'нет данных', SRC_METRIKA);
    add(42, 'Значение конверсий (Post-Click) по топовым городам', SLICE_PROG, 'нет данных', SRC_METRIKA);
  }

  add(43, '% новых пользователей', SLICE_PROG, report.newUsers ? report.newUsers.percent : '', SRC_METRIKA);
  add(44, 'Audience matching, %', SLICE_PROG, settings.matching || '', SRC_INPUT);
  add(45, 'Какие цели считать (post-click)', SLICE_PROG, goalNames.join(', '), SRC_SETTINGS);

  if (noGoals) {
    add(46, 'Post-click прямые, по каждой цели и итого', SLICE_PROG, 'не выбраны цели', SRC_METRIKA);
    add(47, 'Post-click ассоциированные, по каждой цели и итого', SLICE_PROG, utm ? 'не выбраны цели' : 'нужна метка utm_source', SRC_METRIKA);
  } else {
    conversions.forEach(function (conv) {
      add(46, 'Post-click прямые: ' + conv.name, SLICE_PROG, conv.direct, SRC_METRIKA);
    });
    add(46, 'Post-click прямые, итого', SLICE_PROG, totals.directTotal, SRC_METRIKA);
    if (!utm) {
      add(47, 'Post-click ассоциированные, по каждой цели и итого', SLICE_PROG, 'нужна метка utm_source', SRC_METRIKA);
    } else {
      conversions.forEach(function (assoc) {
        add(47, 'Post-click ассоциированные: ' + assoc.name, SLICE_PROG, assoc.associated == null ? 'не удалось посчитать' : assoc.associated, SRC_METRIKA);
      });
      add(47, 'Post-click ассоциированные, итого', SLICE_PROG, totals.associatedTotal != null ? totals.associatedTotal : 'не удалось посчитать', SRC_METRIKA);
    }
  }

  add(48, 'Какие цели считать (post-view)', SLICE_PROG, settings.pvGoals || '', SRC_INPUT);
  add(49, 'Post-view, по каждой цели и итого', SLICE_PROG, settings.pvFact || '', SRC_INPUT);
  add(50, 'Показатели из PC и PV', SLICE_PROG, settings.pcPvNotes || '', SRC_INPUT);
  add(51, 'План-прогноз PV конверсий', SLICE_PROG, settings.planPv || '', SRC_INPUT);
  add(52, 'План-прогноз PC конверсий', SLICE_PROG, settings.planPc || '', SRC_INPUT);
  add(53, 'Факт PV конверсий', SLICE_PROG, settings.pvFact || '', SRC_INPUT);
  add(54, 'Факт PC конверсий', SLICE_PROG, noGoals ? 'не выбраны цели' : (totals.directTotal != null ? totals.directTotal : ''), SRC_METRIKA);
  add(55, 'ДРР план', SLICE_PROG, settings.drrPlan || '', SRC_INPUT);

  const pcFact = noGoals ? '' : totals.directTotal;
  const avgCheck = asNumber(settings.avgCheck);
  const budget = asNumber(settings.budget);
  const pvFact = asNumber(settings.pvFact);
  let drrFact = '';
  if (budget !== '' && avgCheck && pcFact) {
    drrFact = round2(budget / (avgCheck * Number(pcFact)) * 100);
  }
  add(56, 'ДРР факт', SLICE_PROG, drrFact, SRC_CALC);
  add(57, 'Конверсии Roistat', SLICE_PROG, settings.roistat || '', SRC_INPUT);
  add(58, 'CPL', SLICE_PROG, calcDiv(budget, pcFact), SRC_CALC);
  add(59, 'CPL (PV)', SLICE_PROG, calcDiv(budget, pvFact), SRC_CALC);
  add(60, 'CPL (общий)', SLICE_PROG, calcDiv(budget, (asNumber(pvFact) === '' ? 0 : asNumber(pvFact)) + (asNumber(pcFact) === '' ? 0 : asNumber(pcFact))), SRC_CALC);
  add(61, 'Средний чек', SLICE_NONE, settings.avgCheck || '', SRC_INPUT);

  if (report.banners && report.banners.empty) {
    add(62, 'Число кликов по баннерам', SLICE_PROG, 'нет разбивки по UTM Content', SRC_METRIKA);
  } else if (report.banners && report.banners.items) {
    report.banners.items.forEach(function (banner) {
      add(62, 'Клики по баннеру: ' + banner.name, SLICE_PROG, banner.visits, SRC_METRIKA);
    });
    if (report.banners.unlabeled) {
      add(62, 'Клики по баннерам без UTM Content', SLICE_PROG, report.banners.unlabeled, SRC_METRIKA);
    }
  }

  add(63, 'CTR по баннерам', SLICE_PROG, settings.bannerCtr || '', SRC_INPUT);
  const bannerClicks = (report.banners && report.banners.items || []).reduce(function (sum, item) {
    return sum + (Number(item.visits) || 0);
  }, 0);
  add(64, 'Число показов по баннерам', SLICE_PROG, calcImpressions(bannerClicks, settings.bannerCtr), SRC_CALC);
  add(65, 'Изображения баннеров', SLICE_PROG, settings.bannerImages || '', SRC_INPUT);
  add(66, 'Список (какие слайды включать или не включать)', SLICE_NONE, settings.slidesList || '', SRC_INPUT);

  return rows;
}

module.exports = { buildCatalog: buildCatalog };
