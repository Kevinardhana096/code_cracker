const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;
let isDirty = false;
let debounceTimer = null;
let maxWaitTimer = null;
let isWriting = false;
let writePending = false;

const DEBOUNCE_DELAY_MS = 500;
const MAX_WAIT_MS = 2000;

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

function clearTimers() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer);
    maxWaitTimer = null;
  }
}

/**
 * Perform a synchronous disk write.
 * Guaranteed to complete before returning.
 * Used for graceful shutdown (SIGINT/SIGTERM), initial seed, and test harnesses.
 */
function saveDbSync() {
  clearTimers();
  if (!db) return;

  try {
    const data = db.export();
    const tempPath = `${dbPath}.tmp`;
    fs.writeFileSync(tempPath, Buffer.from(data));

    try {
      fs.renameSync(tempPath, dbPath);
    } catch (error) {
      fs.copyFileSync(tempPath, dbPath);
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
    isDirty = false;
    writePending = false;
  } catch (err) {
    console.error('[DB] Failed to save database synchronously:', err);
  }
}

/**
 * Perform an asynchronous disk write without blocking the event loop.
 */
async function performAsyncSave() {
  if (!db) return;

  if (isWriting) {
    writePending = true;
    return;
  }

  clearTimers();
  isWriting = true;
  isDirty = false;

  try {
    // db.export() is an in-memory snapshot (<1ms for typical DB sizes)
    const data = Buffer.from(db.export());
    const tempPath = `${dbPath}.tmp`;

    await fs.promises.writeFile(tempPath, data);

    try {
      await fs.promises.rename(tempPath, dbPath);
    } catch (error) {
      // Windows file locking fallback
      await fs.promises.copyFile(tempPath, dbPath);
      try {
        await fs.promises.unlink(tempPath);
      } catch (_) {}
    }
  } catch (err) {
    console.error('[DB] Failed to save database asynchronously:', err);
    isDirty = true; // Retry on next cycle
  } finally {
    isWriting = false;
    if (writePending || isDirty) {
      writePending = false;
      scheduleSaveDb();
    }
  }
}

/**
 * Schedule a debounced asynchronous save.
 * Multiple calls within DEBOUNCE_DELAY_MS coalesce into a single write.
 * Maximum wait capped at MAX_WAIT_MS to ensure timely persistence under high activity.
 */
function scheduleSaveDb() {
  if (!db) return;
  isDirty = true;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    performAsyncSave();
  }, DEBOUNCE_DELAY_MS);
  if (debounceTimer.unref) debounceTimer.unref();

  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(() => {
      maxWaitTimer = null;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      performAsyncSave();
    }, MAX_WAIT_MS);
    if (maxWaitTimer.unref) maxWaitTimer.unref();
  }
}

/**
 * Universal saveDb:
 * - If called with { sync: true }, executes immediate synchronous flush.
 * - Otherwise schedules debounced asynchronous save (non-blocking).
 */
function saveDb(options = {}) {
  if (options && options.sync === true) {
    saveDbSync();
  } else {
    scheduleSaveDb();
  }
}

/**
 * Flush any pending saves and return a promise when complete.
 */
async function flushSaveDb() {
  clearTimers();
  if (isWriting) {
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (!isWriting) {
          clearInterval(check);
          resolve();
        }
      }, 25);
    });
  }
  if (isDirty) {
    await performAsyncSave();
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
  scheduleSaveDb();
}

module.exports = {
  initDb,
  getDb,
  saveDb,
  saveDbSync,
  scheduleSaveDb,
  flushSaveDb,
  queryAll,
  queryOne,
  run,
};
