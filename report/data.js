/**
 * Данные отчёта «Уют мебель».
 * Другой агент / выгрузка подставляет значения сюда — вёрстка не меняется.
 *
 * mediaPlan — не Метрика (показы, охват, бюджет, CTR).
 * Остальное — Яндекс.Метрика (поведение, доли, разбивки).
 */
window.REPORT = {
  meta: {
    campaignName: 'Уют мебель',
    campaignSite: 'Divano.ru',
    reportKind: 'Промежуточный отчёт по рекламной кампании',
    periodFrom: '11.08.2026',
    periodTo: '01.09.2026',
    reportDate: '02.09.2026',
    cycleNumber: '4',
    cycleFrom: '11.08.2026',
    cycleTo: '01.09.2026',
    cycleLabel: 'МЕДИАПЛАН 4 цикл',
    brand: 'Programmatic.ru'
  },
  contacts: {
    phone: '8 (905) 782-54-00',
    email: 'd.nebiyok@programmatic.ru'
  },
  mediaPlan: {
    planImpressions: 1666667,
    planReach: 416667,
    planFrequency: 4,
    planCtr: 0.23,
    planBudget: 210000,
    planClicks: 3833,
    factImpressions: 2424457,
    factReach: 606114,
    factFrequency: 3.99,
    factCtr: 0.17,
    factBudget: 133358,
    factClicks: 4325
  },
  behavior: {
    programmatic: {
      avgDuration: '3:47',
      bounceRate: 19.72,
      pageDepth: 1.28
    },
    other: {
      avgDuration: '18:45',
      bounceRate: 19.53,
      pageDepth: 4.53
    }
  },
  devicesShare: {
    desktop: 7,
    mobile: 88,
    tablet: 4
  },
  devicesBehavior: {
    desktop: { bounceRate: 9.88, pageDepth: 3.46, avgDuration: '2:22' },
    mobile: { bounceRate: 20.44, pageDepth: 1.1, avgDuration: '3:47' },
    tablet: { bounceRate: 22.41, pageDepth: 1.13, avgDuration: '4:42' }
  },
  ageShare: [
    { key: '18_24', label: '18-24', value: 2 },
    { key: '25_34', label: '25-34', value: 7 },
    { key: '35_44', label: '35-44', value: 10 },
    { key: '45_54', label: '45-54', value: 9 },
    { key: '55plus', label: '55+', value: 5 },
    { key: 'other', label: 'Другие', value: 1 },
    { key: 'unknown', label: 'не опр.', value: 65 }
  ],
  genderShare: {
    male: 38,
    female: 62
  },
  ageBehavior: [
    { key: '18_24', label: '18 - 24', bounceRate: 20.2, pageDepth: 1.08, avgDuration: '7:17' },
    { key: '25_34', label: '25 - 34', bounceRate: 27.63, pageDepth: 1.08, avgDuration: '5:54' },
    { key: '35_44', label: '35 - 44', bounceRate: 21.03, pageDepth: 1.08, avgDuration: '6:41' },
    { key: '45_54', label: '45 - 54', bounceRate: 22.79, pageDepth: 1.19, avgDuration: '5:54' },
    { key: '55plus', label: '55 +', bounceRate: 21.97, pageDepth: 1.23, avgDuration: '8:46' },
    { key: 'other', label: 'Другие', bounceRate: 13.43, pageDepth: 1.18, avgDuration: '4:08' }
  ],
  genderBehavior: {
    male: { bounceRate: 24.1, pageDepth: 1.08, avgDuration: '5:57' },
    female: { bounceRate: 20.13, pageDepth: 1.15, avgDuration: '7:08' }
  },
  matching: {
    percent: 94.7,
    newUsersPercent: 98.08,
    text: 'При programmatic-закупке первостепенное значение имеет совпадение (matching) аудитории. Сегменты Programmatic.ru опираются на конверсионные профили сайта заказчика и таксономию партнёрских SSP. Бенчмарки Matching DMP: ниже 80% — низкий, 80–90% — средний, от 90% — отличный показатель.'
  },
  conversions: {
    postClick: [
      { name: 'Клик по номеру телефона', direct: 1, associated: 2 },
      { name: 'Ecommerce: покупка', direct: null, associated: null }
    ],
    postView: [
      { name: 'Ecommerce: покупка', count: 146 }
    ],
    notes: [
      'CPL 133 358 / 1 + (2 / 2) = 66 679',
      'CPL (Pv) 133 358 / 146 = 913'
    ]
  },
  postView: {
    header: 'Цели Яндекс.Метрика',
    items: [
      { name: '1. Заказ отправлен', count: 12 },
      { name: '2. Запрос скидки отправлен', count: 1 },
      { name: '3. Заявка на звонок отправлена', count: 31 },
      { name: '4. Клик по номеру телефона', count: 23 },
      { name: '5. Email Lead', count: 50 }
    ]
  },
  banners: [
    { name: 'Баннер 1', ctr: 0.21, clicks: 1748, impressions: 715347 },
    { name: 'Баннер 2', ctr: 0.2, clicks: 1048, impressions: 505428 }
  ]
};
