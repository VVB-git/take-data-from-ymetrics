'use strict';

const { formatDuration, round1, round2 } = require('./metrika');

const AGE_ROWS = [
  { key: '18_24', label: '18-24', behaviorLabel: '18 - 24' },
  { key: '25_34', label: '25-34', behaviorLabel: '25 - 34' },
  { key: '35_44', label: '35-44', behaviorLabel: '35 - 44' },
  { key: '45_54', label: '45-54', behaviorLabel: '45 - 54' },
  { key: '55plus', label: '55+', behaviorLabel: '55 +' },
  { key: 'unknown', label: 'не опр.', behaviorLabel: '' }
];

function parseNumber(value) {
  const s = String(value == null ? '' : value).trim();
  if (!s || !/\d/.test(s)) return '';
  const n = Number(s.replace(/\s/g, '').replace('%', '').replace(',', '.'));
  return isNaN(n) ? '' : n;
}

function formatRuDate(value) {
  if (!value) return '';
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '.' + iso[2] + '.' + iso[1];
  return String(value);
}

function shareValue(block, key) {
  if (!block || block.insufficient || !block.values || block.values[key] == null) return '';
  const n = Number(block.values[key]);
  return isNaN(n) ? '' : n;
}

function weightedSocdem(socdem, field, key) {
  if (!socdem || !socdem.items || !socdem.items.length) return null;
  let wBounce = 0;
  let wDepth = 0;
  let wDur = 0;
  let weight = 0;
  socdem.items.forEach(function (item) {
    if (item[field] !== key) return;
    const visits = Number(item.visits) || 0;
    if (!visits) return;
    wBounce += Number(item.bounceRate) * visits;
    wDepth += Number(item.pageDepth) * visits;
    wDur += Number(item.avgDuration) * visits;
    weight += visits;
  });
  if (!weight) return null;
  return {
    bounceRate: round1(wBounce / weight),
    pageDepth: round2(wDepth / weight),
    avgDuration: round1(wDur / weight)
  };
}

function calcFact(clicks, ctr, frequency) {
  const clickN = parseNumber(clicks);
  const ctrN = parseNumber(ctr);
  const freqN = parseNumber(frequency) || 4;
  let impressions = '';
  let reach = '';
  if (clickN !== '' && ctrN) {
    impressions = Math.round(clickN / (ctrN / 100));
    if (freqN) reach = Math.round(impressions / freqN);
  }
  return { impressions: impressions, reach: reach };
}

function buildPayload(settings, report) {
  const factClicks = report && report.primary ? report.primary.visits : '';
  const fact = calcFact(factClicks, settings.factCtr, settings.factFrequency);
  const includeUnknown = settings.unknownAge !== 'нет';
  const today = new Date();
  const reportDate = settings.reportDate
    ? formatRuDate(settings.reportDate)
    : String(today.getDate()).padStart(2, '0') + '.' + String(today.getMonth() + 1).padStart(2, '0') + '.' + today.getFullYear();
  const cycleNumber = settings.cycleNumber || '';
  const emptyDev = { bounceRate: '', pageDepth: '', avgDuration: '' };
  const devicesBehavior = (report && report.devicesBehavior && report.devicesBehavior.values) || {};

  const ageShare = AGE_ROWS
    .filter(function (spec) { return spec.key !== 'unknown' || includeUnknown; })
    .map(function (spec) {
      return { key: spec.key, label: spec.label, value: shareValue(report && report.age, spec.key) };
    });

  const ageBehavior = AGE_ROWS
    .filter(function (spec) { return spec.behaviorLabel; })
    .map(function (spec) {
      const agg = weightedSocdem(report && report.socdemBehavior, 'ageKey', spec.key);
      if (!agg) return null;
      return {
        key: spec.key,
        label: spec.behaviorLabel,
        bounceRate: agg.bounceRate,
        pageDepth: agg.pageDepth,
        avgDuration: formatDuration(agg.avgDuration)
      };
    })
    .filter(Boolean);

  const male = weightedSocdem(report && report.socdemBehavior, 'genderKey', 'male');
  const female = weightedSocdem(report && report.socdemBehavior, 'genderKey', 'female');

  return {
    meta: {
      campaignName: settings.campaign || '',
      campaignSite: settings.campaignSite || '',
      reportKind: settings.reportKind || 'Промежуточный отчёт по рекламной кампании',
      periodFrom: formatRuDate(settings.date1),
      periodTo: formatRuDate(settings.date2),
      reportDate: reportDate,
      cycleNumber: cycleNumber,
      cycleFrom: formatRuDate(settings.cycleFrom),
      cycleTo: formatRuDate(settings.cycleTo),
      cycleLabel: cycleNumber ? ('МЕДИАПЛАН ' + cycleNumber + ' цикл') : '',
      brand: settings.brand || 'Programmatic.ru'
    },
    contacts: {
      phone: settings.phone || '',
      email: settings.email || ''
    },
    mediaPlan: {
      planImpressions: parseNumber(settings.planImpressions),
      planReach: parseNumber(settings.planReach),
      planFrequency: parseNumber(settings.planFrequency),
      planCtr: parseNumber(settings.planCtr),
      planBudget: parseNumber(settings.planBudget),
      planClicks: parseNumber(settings.planClicks),
      factImpressions: fact.impressions,
      factReach: fact.reach,
      factFrequency: parseNumber(settings.factFrequency) === '' ? 4 : parseNumber(settings.factFrequency),
      factCtr: parseNumber(settings.factCtr),
      factBudget: parseNumber(settings.budget),
      factClicks: factClicks,
      factCpc: (factClicks && parseNumber(settings.budget) !== '')
        ? Math.round((parseNumber(settings.budget) / Number(factClicks)) * 100) / 100
        : ''
    },
    behavior: {
      programmatic: report && report.primary
        ? {
            avgDuration: formatDuration(report.primary.avgDuration),
            bounceRate: report.primary.bounceRate,
            pageDepth: report.primary.pageDepth
          }
        : { avgDuration: '', bounceRate: '', pageDepth: '' },
      other: report && report.otherSources
        ? {
            avgDuration: formatDuration(report.otherSources.avgDuration),
            bounceRate: report.otherSources.bounceRate,
            pageDepth: report.otherSources.pageDepth
          }
        : { avgDuration: '', bounceRate: '', pageDepth: '' }
    },
    devicesShare: {
      desktop: shareValue(report && report.devices, 'desktop'),
      mobile: shareValue(report && report.devices, 'mobile'),
      tablet: shareValue(report && report.devices, 'tablet')
    },
    devicesBehavior: {
      desktop: devicesBehavior.desktop || emptyDev,
      mobile: devicesBehavior.mobile || emptyDev,
      tablet: devicesBehavior.tablet || emptyDev
    },
    ageShare: ageShare,
    genderShare: {
      male: shareValue(report && report.gender, 'male'),
      female: shareValue(report && report.gender, 'female')
    },
    ageBehavior: ageBehavior,
    genderBehavior: {
      male: male
        ? { bounceRate: male.bounceRate, pageDepth: male.pageDepth, avgDuration: formatDuration(male.avgDuration) }
        : emptyDev,
      female: female
        ? { bounceRate: female.bounceRate, pageDepth: female.pageDepth, avgDuration: formatDuration(female.avgDuration) }
        : emptyDev
    }
  };
}

function reportFilename(payload) {
  const name = (payload.meta && payload.meta.campaignName) || 'отчёт';
  const safe = String(name).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'отчёт';
  const date = (payload.meta && payload.meta.reportDate) || '';
  return 'Отчёт ' + safe + (date ? ' ' + date : '') + '.html';
}

module.exports = {
  buildPayload: buildPayload,
  reportFilename: reportFilename
};
