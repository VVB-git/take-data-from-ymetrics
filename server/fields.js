'use strict';

const FIELD_GROUPS = [
  {
    id: 'access',
    title: 'Доступ к Метрике',
    fields: [
      { key: 'counter', label: 'Номер счётчика', type: 'text', required: true, note: 'Только цифры, как в кабинете Метрики.' },
      { key: 'token', label: 'OAuth-токен', type: 'password', required: true, note: 'Право metrika:read. Вставьте токен из oauth.yandex.ru.' },
      { key: 'date1', label: 'Дата начала', type: 'date', required: true },
      { key: 'date2', label: 'Дата окончания', type: 'date', required: true },
      { key: 'utm', label: 'UTM-метка (utm_source)', type: 'text', note: 'Можно оставить пустым — тогда срез по всем источникам.' },
      { key: 'robots', label: 'Учитывать роботов', type: 'yesno', defaultValue: 'да' },
      { key: 'unknownAge', label: 'Учитывать «не определено» в возрасте', type: 'yesno', defaultValue: 'да' },
      { key: 'goals', label: 'Цели через запятую', type: 'textarea', note: 'Точные названия целей из кабинета. Можно пусто.' }
    ]
  },
  {
    id: 'cover',
    title: 'Обложка и контакты',
    fields: [
      { key: 'campaign', label: 'Название кампании', type: 'text' },
      { key: 'campaignSite', label: 'Сайт кампании', type: 'text' },
      { key: 'reportKind', label: 'Тип отчёта', type: 'text', defaultValue: 'Промежуточный отчёт по рекламной кампании' },
      { key: 'brand', label: 'Бренд', type: 'text', defaultValue: 'Programmatic.ru' },
      { key: 'phone', label: 'Телефон', type: 'text' },
      { key: 'email', label: 'Почта', type: 'text' },
      { key: 'cycleNumber', label: 'Номер цикла', type: 'text' },
      { key: 'cycleFrom', label: 'Дата начала цикла', type: 'date' },
      { key: 'cycleTo', label: 'Дата конца цикла', type: 'date' },
      { key: 'reportDate', label: 'Дата отчёта', type: 'date' }
    ]
  },
  {
    id: 'mediaplan',
    title: 'Медиаплан — ввод руками',
    fields: [
      { key: 'planClicks', label: 'Клики, план', type: 'text' },
      { key: 'planCtr', label: 'CTR, план %', type: 'text' },
      { key: 'factCtr', label: 'CTR, факт %', type: 'text' },
      { key: 'planImpressions', label: 'Показы, план', type: 'text' },
      { key: 'planReach', label: 'Охват, план', type: 'text' },
      { key: 'planFrequency', label: 'Частота, план', type: 'text', defaultValue: '4' },
      { key: 'factFrequency', label: 'Частота, факт', type: 'text', defaultValue: '4' },
      { key: 'planBudget', label: 'Бюджет, план', type: 'text' },
      { key: 'budget', label: 'Бюджет, факт', type: 'text' }
    ]
  },
  {
    id: 'extra',
    title: 'Дополнительно',
    fields: [
      { key: 'matching', label: 'Audience matching, %', type: 'text' },
      { key: 'pvGoals', label: 'Какие цели считать (post-view)', type: 'text' },
      { key: 'pvFact', label: 'Post-view, факт', type: 'text' },
      { key: 'pcPvNotes', label: 'Показатели из PC и PV', type: 'text' },
      { key: 'planPv', label: 'План-прогноз PV', type: 'text' },
      { key: 'planPc', label: 'План-прогноз PC', type: 'text' },
      { key: 'drrPlan', label: 'ДРР план', type: 'text' },
      { key: 'roistat', label: 'Конверсии Roistat', type: 'text' },
      { key: 'avgCheck', label: 'Средний чек', type: 'text' },
      { key: 'bannerCtr', label: 'CTR по баннерам', type: 'text' },
      { key: 'bannerImages', label: 'Изображения баннеров', type: 'text' },
      { key: 'slidesList', label: 'Какие слайды включать', type: 'text' }
    ]
  }
];

function allFields() {
  return FIELD_GROUPS.reduce(function (list, group) {
    return list.concat(group.fields);
  }, []);
}

function emptySettings() {
  var out = {};
  allFields().forEach(function (field) {
    out[field.key] = field.defaultValue != null ? field.defaultValue : '';
  });
  return out;
}

module.exports = {
  FIELD_GROUPS: FIELD_GROUPS,
  allFields: allFields,
  emptySettings: emptySettings
};
