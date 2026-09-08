'use strict';

const db = require('./db');
const metrika = require('./metrika');
const { buildPayload } = require('./payload');
const { buildCatalog } = require('./catalog');
const { fillTemplate } = require('./fill-template');

const STEPS = [
  { id: 'start', title: 'Настройки' },
  { id: 'goals', title: 'Цели' },
  { id: 'behavior', title: 'Визиты и поведение' },
  { id: 'other', title: 'Другие источники' },
  { id: 'age', title: 'Возраст' },
  { id: 'gender', title: 'Пол' },
  { id: 'devices', title: 'Устройства' },
  { id: 'socdem', title: 'Поведение × соцдем' },
  { id: 'conv', title: 'Конверсии и гео' },
  { id: 'banners', title: 'Баннеры' },
  { id: 'write', title: 'Запись' },
  { id: 'html', title: 'Сборка HTML' },
  { id: 'done', title: 'Готово' }
];

let job = {
  status: 'idle',
  step: '',
  label: '',
  percent: 0,
  error: '',
  collectId: 0,
  sampled: false
};

function publicJob() {
  return {
    status: job.status,
    step: job.step,
    label: job.label,
    percent: job.percent,
    error: job.error,
    collectId: job.collectId,
    sampled: !!job.sampled,
    steps: STEPS
  };
}

function currentJob() {
  return publicJob();
}

function setJob(fields) {
  job = Object.assign({}, job, fields);
  if (!job.collectId) {
    return;
  }
  const patch = {
    status: job.status,
    step: job.step,
    label: job.label,
    percent: job.percent,
    error: job.error || '',
    sampled: job.sampled ? 1 : 0
  };
  if (Object.prototype.hasOwnProperty.call(fields, 'snapshot')) {
    patch.snapshot = fields.snapshot;
  }
  if (job.status === 'done' || job.status === 'error') {
    patch.finished_at = new Date().toISOString();
  }
  db.updateCollect(job.collectId, patch);
}

function parseYes(value) {
  const n = String(value || '').trim().toLowerCase();
  return n !== 'нет' && n !== 'no';
}

function toApiSettings(form) {
  const counter = String(form.counter || '').replace(/\D/g, '');
  if (!/^\d+$/.test(counter)) {
    throw new Error('Укажите номер счётчика цифрами.');
  }
  if (!String(form.token || '').trim()) {
    throw new Error('Вставьте OAuth-токен Метрики.');
  }
  if (!form.date1 || !form.date2) {
    throw new Error('Укажите дату начала и дату конца периода.');
  }
  if (form.date1 > form.date2) {
    throw new Error('Дата начала позже даты конца.');
  }
  return {
    counterId: counter,
    token: String(form.token).trim(),
    utm: String(form.utm || '').trim(),
    includeRobots: parseYes(form.robots),
    includeUnknownAge: parseYes(form.unknownAge),
    date1: form.date1,
    date2: form.date2,
    conversions: metrika.parseGoalList(form.goals)
  };
}

function hydrate() {
  const row = db.getLatestCollect();
  if (!row) {
    return;
  }
  job = {
    status: row.status || 'idle',
    step: row.step || '',
    label: row.label || '',
    percent: row.percent || 0,
    error: row.error || '',
    collectId: row.id || 0,
    sampled: !!row.sampled
  };
  if (job.status === 'running') {
    job.status = 'error';
    job.error = 'Сбор прервался: сервер перезапустили. Запустите ещё раз.';
    job.label = job.error;
    db.updateCollect(job.collectId, {
      status: 'error',
      error: job.error,
      label: job.label,
      finished_at: new Date().toISOString()
    });
  }
}

async function runCollect(form) {
  const api = toApiSettings(form);
  const saved = db.saveSettings(form);
  const row = db.insertCollect({
    started_at: new Date().toISOString(),
    status: 'running',
    step: 'start',
    label: 'Читаю настройки',
    percent: 5
  });
  job = {
    status: 'running',
    step: 'start',
    label: 'Читаю настройки',
    percent: 5,
    error: '',
    collectId: row.id,
    sampled: false
  };

  try {
    const report = {
      meta: {
        sampled: false,
        includeUnknownAge: api.includeUnknownAge,
        utm: api.utm,
        date1: api.date1,
        date2: api.date2,
        campaignName: saved.campaign || '',
        budget: saved.budget || '',
        goalNames: []
      },
      primary: null,
      otherSources: null,
      age: null,
      gender: null,
      devices: null,
      devicesBehavior: null,
      socdemBehavior: null,
      newUsers: null,
      geo: null,
      banners: null,
      conversions: null
    };

    let matched = [];
    if (api.conversions.length) {
      setJob({ step: 'goals', label: 'Сверяю названия целей', percent: 10 });
      const goals = await metrika.fetchGoals(api);
      matched = metrika.matchGoals(api.conversions, goals);
      report.meta.goalNames = matched.map(function (g) { return g.name; });
    }

    setJob({ step: 'behavior', label: 'Запрашиваю визиты и поведение', percent: 18 });
    report.primary = await metrika.fetchBehavior(api, 'primary');
    report.meta.sampled = report.meta.sampled || report.primary.sampled;

    if (api.utm) {
      setJob({ step: 'other', label: 'Запрашиваю поведение по другим источникам', percent: 28 });
      report.otherSources = await metrika.fetchBehavior(api, 'except');
      report.meta.sampled = report.meta.sampled || report.otherSources.sampled;
    }

    setJob({ step: 'age', label: 'Запрашиваю возраст', percent: 38 });
    report.age = await metrika.fetchAge(api, 'primary');
    report.meta.sampled = report.meta.sampled || report.age.sampled;

    setJob({ step: 'gender', label: 'Запрашиваю пол', percent: 48 });
    report.gender = await metrika.fetchGender(api, 'primary');
    report.meta.sampled = report.meta.sampled || report.gender.sampled;

    setJob({ step: 'devices', label: 'Запрашиваю устройства', percent: 58 });
    report.devices = await metrika.fetchDevices(api, 'primary');
    report.devicesBehavior = await metrika.fetchDevicesBehavior(api, 'primary');
    report.meta.sampled = report.meta.sampled || report.devices.sampled || report.devicesBehavior.sampled;

    setJob({ step: 'socdem', label: 'Запрашиваю поведение по возрасту и полу', percent: 68 });
    report.socdemBehavior = await metrika.fetchBehaviorBySocdem(api, 'primary');
    report.newUsers = await metrika.fetchNewUsers(api, 'primary');

    if (matched.length) {
      setJob({ step: 'conv', label: 'Запрашиваю конверсии и гео', percent: 78 });
      report.conversions = await metrika.fetchConversions(api, matched);
      report.geo = await metrika.fetchGeoConversions(api, matched, 'primary');
      report.meta.sampled = report.meta.sampled || report.conversions.sampled || report.geo.sampled;
    }

    setJob({ step: 'banners', label: 'Запрашиваю клики по баннерам', percent: 88 });
    report.banners = await metrika.fetchBannerClicks(api, 'primary');
    report.meta.sampled = report.meta.sampled || report.banners.sampled;

    setJob({ step: 'write', label: 'Сохраняю в базу', percent: 94 });
    const payload = buildPayload(saved, report);
    db.saveSnapshot({ metrics: buildCatalog(saved, report, payload) });
    const snapshot = JSON.stringify({ payload: payload });

    setJob({ step: 'html', label: 'Собираю HTML', percent: 97, snapshot: snapshot });
    fillTemplate(payload);

    setJob({
      step: 'done',
      label: 'Готово',
      percent: 100,
      status: 'done',
      sampled: report.meta.sampled,
      snapshot: snapshot
    });
  } catch (e) {
    setJob({
      status: 'error',
      label: e.message || 'Не получилось собрать отчёт.',
      error: e.message || 'Не получилось собрать отчёт.',
      percent: job.percent || 0
    });
  }
}

function startCollect(form) {
  toApiSettings(form);
  if (job.status === 'running') {
    return;
  }
  Promise.resolve(runCollect(form)).catch(function (e) {
    setJob({
      status: 'error',
      label: e.message || 'Не получилось собрать отчёт.',
      error: e.message || 'Не получилось собрать отчёт.'
    });
  });
}

module.exports = {
  STEPS: STEPS,
  currentJob: currentJob,
  startCollect: startCollect,
  hydrate: hydrate,
  toApiSettings: toApiSettings
};
