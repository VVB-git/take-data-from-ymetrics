'use strict';

const path = require('path');
const express = require('express');
const db = require('./db');
const collect = require('./collect');
const views = require('./views');
const { fillTemplate } = require('./fill-template');
const { reportFilename } = require('./payload');

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function contentDisposition(filename) {
  const encoded = encodeURIComponent(filename);
  return 'attachment; filename="report.html"; filename*=UTF-8\'\'' + encoded;
}

app.get('/', function (req, res) {
  res.type('html').send(views.formPage({
    settings: db.getSettings(),
    saved: req.query.saved === '1',
    error: req.query.error || ''
  }));
});

app.post('/draft', function (req, res) {
  db.saveSettings(req.body);
  res.redirect('/?saved=1');
});

app.post('/collect', function (req, res) {
  db.saveSettings(req.body);
  try {
    collect.startCollect(db.getSettings());
    res.redirect('/progress');
  } catch (e) {
    res.status(400).type('html').send(views.formPage({
      settings: db.getSettings(),
      error: e.message
    }));
  }
});

app.get('/progress', function (req, res) {
  const job = collect.currentJob();
  if (job.status === 'idle' && !db.getLatestCollect()) {
    res.redirect('/');
    return;
  }
  res.type('html').send(views.progressPage());
});

function writeSse(res, job) {
  res.write('data: ' + JSON.stringify(job) + '\n\n');
}

app.get('/collect/events', function (req, res) {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  writeSse(res, collect.currentJob());
  const timer = setInterval(function () {
    const job = collect.currentJob();
    writeSse(res, job);
    if (job.status === 'done' || job.status === 'error') {
      clearInterval(timer);
      res.end();
    }
  }, 400);
  req.on('close', function () {
    clearInterval(timer);
  });
});

app.get('/collect/status', function (req, res) {
  res.json(collect.currentJob());
});

app.get('/report.html', function (req, res) {
  const job = collect.currentJob();
  if (job.status === 'running') {
    res.redirect('/progress');
    return;
  }
  const snap = db.getSnapshot();
  if (!snap || !snap.payload) {
    res.status(404).type('html').send(views.formPage({
      settings: db.getSettings(),
      error: 'Сначала соберите отчёт — файла ещё нет.'
    }));
    return;
  }
  const html = fillTemplate(snap.payload);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', contentDisposition(reportFilename(snap.payload)));
  res.send(html);
});

async function main() {
  await db.init();
  collect.hydrate();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', function () {
    console.log('Отчёт АМ: http://localhost:' + port);
  });
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
