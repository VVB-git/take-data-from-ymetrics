(function () {
  var stepsEl = document.getElementById('steps');
  var meter = document.getElementById('meter');
  var percentEl = document.getElementById('percent');
  var statusText = document.getElementById('status-text');
  var errorEl = document.getElementById('error');
  var errorActions = document.getElementById('error-actions');
  var doneEl = document.getElementById('done');
  var sampledEl = document.getElementById('sampled');
  var order = [];

  function paint(job) {
    if (!job) return;
    if (job.steps && job.steps.length && !order.length) {
      order = job.steps;
    }
    var active = job.step || '';
    var reached = false;
    stepsEl.innerHTML = order.filter(function (step) {
      return step.id !== 'done';
    }).map(function (step) {
      var cls = '';
      if (job.status === 'error' && step.id === active) {
        cls = 'error';
        reached = true;
      } else if (step.id === active && job.status === 'running') {
        cls = 'active';
        reached = true;
      } else if (!reached) {
        cls = job.status === 'done' || (active && step.id !== active) ? 'done' : '';
        if (step.id === active) reached = true;
      }
      return '<li class="' + cls + '">' + step.title + '</li>';
    }).join('');

    var pct = Number(job.percent) || 0;
    meter.style.width = pct + '%';
    percentEl.textContent = pct + '%';
    statusText.textContent = job.label || 'Собираю данные';

    errorEl.hidden = job.status !== 'error';
    errorEl.textContent = job.status === 'error'
      ? (job.error || job.label || 'Не получилось собрать отчёт.')
      : '';
    if (errorActions) errorActions.hidden = job.status !== 'error';
    doneEl.hidden = job.status !== 'done';
    sampledEl.hidden = !(job.status === 'done' && job.sampled);

    if (job.status === 'done') {
      statusText.textContent = 'Отчёт готов. Скачайте HTML-файл и откройте его в Chrome.';
    }
  }

  function apply(raw) {
    try {
      paint(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch (e) {}
  }

  if (window.EventSource) {
    var source = new EventSource('/collect/events');
    source.onmessage = function (ev) {
      var job;
      try {
        job = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      paint(job);
      if (job.status === 'done' || job.status === 'error') {
        source.close();
      }
    };
  } else {
    poll();
  }

  function poll() {
    fetch('/collect/status')
      .then(function (res) { return res.json(); })
      .then(function (job) {
        apply(job);
        if (job.status === 'running' || job.status === 'idle') {
          setTimeout(poll, 700);
        }
      })
      .catch(function () {
        setTimeout(poll, 1200);
      });
  }
})();
