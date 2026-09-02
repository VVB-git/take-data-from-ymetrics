/**
 * Отчёт Яндекс.Метрики для аккаунт-менеджеров.
 *
 * Установка в таблицу:
 * 1. Откройте Google-таблицу → Расширения → Apps Script.
 * 2. Удалите содержимое стандартного Code.gs и создайте файлы:
 *    Code.gs, Metrika.gs, Sheets.gs, Sidebar.html, appsscript.json
 *    Скопируйте в них содержимое из папки apps-script этого проекта.
 * 3. Сохраните проект (Ctrl+S) и обновите таблицу — появится меню «Отчёт Метрики».
 * 4. Меню «Подготовить таблицу», затем вставьте номер счётчика и OAuth-токен.
 *
 * Токен Метрики (право metrika:read):
 *  - создайте приложение на https://oauth.yandex.ru с доступом
 *    «Получение статистики, чтение параметров своих и доверенных счётчиков»;
 *  - откройте
 *    https://oauth.yandex.ru/authorize?response_type=token&client_id=ИД_ПРИЛОЖЕНИЯ
 *  - скопируйте token из адресной строки и вставьте в лист «Настройки».
 *    Скрипт сохранит токен в свойствах документа и заменит ячейку на «токен сохранён».
 */

function onInstall(e) {
  onOpen(e);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Отчёт Метрики')
    .addItem('Собрать отчёт', 'showSidebar')
    .addItem('Показать цели счётчика', 'listCounterGoals')
    .addSeparator()
    .addItem('Подготовить таблицу', 'setupWorkbook')
    .addToUi();
  try {
    ensureLayout_();
  } catch (e) {
    // Первое открытие до выдачи прав — меню всё равно появится.
  }
}

function showSidebar() {
  ensureLayout_();
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Отчёт Метрики')
    .setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

function listCounterGoals() {
  try {
    ensureLayout_();
    setProgress_('goals', 'Запрашиваю список целей', 30);
    var settings = readSettings_();
    validateAccessSettings_(settings);
    saveTokenIfNeeded_(settings);
    var goals = fetchGoals_(settings);
    writeGoalsList_(goals);
    setProgress_('done', 'Цели записаны на лист «Настройки»', 100);
    SpreadsheetApp.getActive().toast(
      goals.length ? ('Найдено целей: ' + goals.length) : 'У счётчика нет целей',
      'Отчёт Метрики',
      8
    );
    return {
      ok: true,
      message: goals.length
        ? ('Найдено целей: ' + goals.length + '. Список — справа на листе «Настройки».')
        : 'У счётчика нет целей.'
    };
  } catch (e) {
    setProgress_('error', e.message, 0);
    throw e;
  }
}

function collectReport() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(2000)) {
    throw new Error('Отчёт уже собирается. Подождите окончания.');
  }
  try {
    setProgress_('start', 'Читаю настройки', 5);
    setStatus_('Собираю…', new Date(), 'Читаю настройки');
    ensureLayout_();

    var settings = readSettings_();
    validateSettings_(settings);
    saveTokenIfNeeded_(settings);

    var report = {
      meta: {
        counterId: settings.counterId,
        utm: settings.utm,
        includeRobots: settings.includeRobots,
        date1: settings.date1,
        date2: settings.date2,
        fetchedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
        sampled: false,
        conversionNote: ''
      },
      primary: null,
      otherSources: null,
      age: null,
      gender: null,
      devices: null,
      conversions: null
    };

    var matched = [];
    if (settings.conversions.length) {
      setProgress_('goals', 'Сверяю названия целей', 12);
      setStatus_('Собираю…', new Date(), 'Сверяю названия целей');
      var goals = fetchGoals_(settings);
      matched = matchGoals_(settings.conversions, goals);
    }

    setProgress_('behavior', 'Запрашиваю визиты и поведение', 22);
    setStatus_('Собираю…', new Date(), 'Запрашиваю визиты и поведение');
    report.primary = fetchBehavior_(settings, 'primary');
    report.meta.sampled = report.meta.sampled || report.primary.sampled;

    if (settings.utm) {
      setProgress_('other', 'Запрашиваю поведение по другим источникам', 38);
      setStatus_('Собираю…', new Date(), 'Запрашиваю поведение по другим источникам');
      report.otherSources = fetchBehavior_(settings, 'except');
      report.meta.sampled = report.meta.sampled || report.otherSources.sampled;
    }

    setProgress_('age', 'Запрашиваю возраст', 52);
    setStatus_('Собираю…', new Date(), 'Запрашиваю возраст');
    report.age = fetchAge_(settings);

    setProgress_('gender', 'Запрашиваю пол', 64);
    setStatus_('Собираю…', new Date(), 'Запрашиваю пол');
    report.gender = fetchGender_(settings);

    setProgress_('devices', 'Запрашиваю устройства', 76);
    setStatus_('Собираю…', new Date(), 'Запрашиваю устройства');
    report.devices = fetchDevices_(settings);

    if (matched.length) {
      setProgress_('conv', 'Запрашиваю конверсии', 86);
      setStatus_('Собираю…', new Date(), 'Запрашиваю конверсии');
      var conv = fetchConversions_(settings, matched);
      report.conversions = conv.items;
      report.meta.sampled = report.meta.sampled || conv.sampled;
      report.meta.conversionNote = conv.conversionNote || '';
    }

    setProgress_('write', 'Записываю на лист «Данные»', 95);
    setStatus_('Собираю…', new Date(), 'Записываю на лист «Данные»');
    writeDataSheet_(report);
    SpreadsheetApp.getActive().setActiveSheet(getDataSheet_());

    setStatus_('Готово', new Date(), 'Данные обновлены на листе «Данные».');
    setProgress_('done', 'Готово', 100);
    return { ok: true, message: 'Готово. Откройте лист «Данные».' };
  } catch (e) {
    setStatus_('Ошибка', new Date(), e.message);
    setProgress_('error', e.message, 0);
    throw e;
  } finally {
    lock.releaseLock();
  }
}
