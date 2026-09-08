'use strict';

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { allFields, emptySettings } = require('./fields');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_DB = path.join(DATA_DIR, 'reports.sqlite');

let SQL = null;
let db = null;
let dbPath = DEFAULT_DB;

function loadEnv() {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) {
    return;
  }
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.charAt(0) === '#') {
      return;
    }
    const eq = trimmed.indexOf('=');
    if (eq < 1) {
      return;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function persist() {
  if (!db) {
    return;
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const data = Buffer.from(db.export());
  fs.writeFileSync(dbPath, data);
}

function run(sql, params) {
  db.run(sql, params || []);
}

function get(sql, params) {
  const stmt = db.prepare(sql);
  if (params) {
    stmt.bind(params);
  }
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function all(sql, params) {
  const stmt = db.prepare(sql);
  if (params) {
    stmt.bind(params);
  }
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function migrate() {
  run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL
    )
  `);
  run(`
    CREATE TABLE IF NOT EXISTS metrics (
      code TEXT NOT NULL,
      name TEXT,
      slice TEXT,
      value TEXT,
      source TEXT,
      PRIMARY KEY (code, name, slice)
    )
  `);
  run(`
    CREATE TABLE IF NOT EXISTS collects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT,
      finished_at TEXT,
      status TEXT,
      step TEXT,
      label TEXT,
      percent INTEGER,
      error TEXT,
      sampled INTEGER,
      snapshot TEXT
    )
  `);
  if (!get('SELECT id FROM settings WHERE id = 1')) {
    run('INSERT INTO settings (id, payload) VALUES (1, ?)', [JSON.stringify(emptySettings())]);
  }
}

async function init() {
  loadEnv();
  dbPath = process.env.DATABASE_PATH
    ? path.resolve(__dirname, process.env.DATABASE_PATH)
    : DEFAULT_DB;
  SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new SQL.Database();
  }
  migrate();
  persist();
}

function getSettings() {
  const row = get('SELECT payload FROM settings WHERE id = 1');
  const base = emptySettings();
  if (!row || !row.payload) {
    return base;
  }
  try {
    const parsed = JSON.parse(row.payload);
    allFields().forEach(function (field) {
      if (parsed[field.key] != null) {
        base[field.key] = String(parsed[field.key]);
      }
    });
  } catch (e) {}
  return base;
}

function saveSettings(values) {
  const current = getSettings();
  allFields().forEach(function (field) {
    if (Object.prototype.hasOwnProperty.call(values, field.key)) {
      current[field.key] = values[field.key] == null ? '' : String(values[field.key]);
    }
  });
  run('UPDATE settings SET payload = ? WHERE id = 1', [JSON.stringify(current)]);
  persist();
  return current;
}

function saveSnapshot(snapshot) {
  run('DELETE FROM metrics');
  const metrics = snapshot.metrics || [];
  metrics.forEach(function (row) {
    run(
      'INSERT INTO metrics (code, name, slice, value, source) VALUES (?, ?, ?, ?, ?)',
      [String(row.code || ''), row.name || '', row.slice || '', String(row.value == null ? '' : row.value), row.source || '']
    );
  });
  persist();
}

function getLatestCollect() {
  return get('SELECT * FROM collects ORDER BY id DESC LIMIT 1');
}

function insertCollect(row) {
  run(
    `INSERT INTO collects (started_at, finished_at, status, step, label, percent, error, sampled, snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.started_at || '',
      row.finished_at || '',
      row.status || 'running',
      row.step || '',
      row.label || '',
      row.percent || 0,
      row.error || '',
      row.sampled ? 1 : 0,
      row.snapshot || ''
    ]
  );
  persist();
  return getLatestCollect();
}

function updateCollect(id, fields) {
  const current = get('SELECT * FROM collects WHERE id = ?', [id]);
  if (!current) {
    return null;
  }
  const merged = Object.assign({}, current, fields);
  run(
    `UPDATE collects SET finished_at=?, status=?, step=?, label=?, percent=?, error=?, sampled=?, snapshot=? WHERE id=?`,
    [
      merged.finished_at || '',
      merged.status,
      merged.step || '',
      merged.label || '',
      merged.percent || 0,
      merged.error || '',
      merged.sampled ? 1 : 0,
      merged.snapshot || '',
      id
    ]
  );
  persist();
  return get('SELECT * FROM collects WHERE id = ?', [id]);
}

function getSnapshot() {
  const collect = getLatestCollect();
  if (!collect || !collect.snapshot) {
    return null;
  }
  try {
    return JSON.parse(collect.snapshot);
  } catch (e) {
    return null;
  }
}

function getMetrics() {
  return all('SELECT code, name, slice, value, source FROM metrics ORDER BY CAST(code AS INTEGER), name');
}

module.exports = {
  init: init,
  persist: persist,
  getSettings: getSettings,
  saveSettings: saveSettings,
  saveSnapshot: saveSnapshot,
  getLatestCollect: getLatestCollect,
  insertCollect: insertCollect,
  updateCollect: updateCollect,
  getSnapshot: getSnapshot,
  getMetrics: getMetrics
};
