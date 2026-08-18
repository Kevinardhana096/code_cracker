const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;

const dbDir = path.resolve(__dirname, '..', '..', 'data');
const dbPath = path.join(dbDir, config.DB_FILENAME);

async function initDb() {
  const SQL = await initSqlJs();

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  return db;
}

function getDb() {
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const tempPath = `${dbPath}.tmp`;
    fs.writeFileSync(tempPath, Buffer.from(data));

    try {
      fs.renameSync(tempPath, dbPath);
    } catch (error) {
      // Windows may reject rename when the destination already exists.
      // Keep the existing database if the fallback copy fails.
      fs.copyFileSync(tempPath, dbPath);
      fs.unlinkSync(tempPath);
    }
  }
}

function queryAll(sql, params = []) {
  let stmt;
  try {
    stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    if (stmt) stmt.free();
  }
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

module.exports = { initDb, getDb, saveDb, queryAll, queryOne, run };
