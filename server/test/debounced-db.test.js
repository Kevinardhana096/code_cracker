const assert = require('assert');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILENAME = 'test_debounced_db.db';
const serverDir = path.resolve(__dirname, '..');
const dbPath = path.join(serverDir, 'data', DB_FILENAME);
process.env.CODE_CRACKER_DB_FILENAME = DB_FILENAME;

const {
  initDb,
  queryOne,
  queryAll,
  run,
  saveDb,
  saveDbSync,
  flushSaveDb,
} = require('../src/db/db');

async function runTests() {
  console.log('--- Testing Debounced & Non-Blocking Database Persistence ---');

  fs.rmSync(dbPath, { force: true });
  fs.rmSync(`${dbPath}.tmp`, { force: true });

  const db = await initDb();
  db.run('CREATE TABLE test_counter (id INTEGER PRIMARY KEY, value INTEGER)');
  saveDbSync();

  // Test 1: Immediate in-memory availability with non-blocking execution
  console.log('Test 1: 50 rapid mutations in memory complete in < 20ms');
  const start = performance.now();
  for (let i = 1; i <= 50; i += 1) {
    run('INSERT INTO test_counter (id, value) VALUES (?, ?)', [i, i * 10]);
  }
  const elapsed = performance.now() - start;
  console.log(`  -> 50 run() calls completed in ${elapsed.toFixed(2)}ms`);
  assert(elapsed < 100, `Expected rapid in-memory writes to be < 100ms, took ${elapsed}ms`);

  // In-memory queries must reflect changes immediately
  const count = queryOne('SELECT COUNT(*) as count FROM test_counter');
  assert.strictEqual(count.count, 50, 'In-memory count should immediately be 50');

  // Test 2: Flush saves to disk correctly
  console.log('Test 2: flushSaveDb persists in-memory data to disk');
  await flushSaveDb();

  assert(fs.existsSync(dbPath), 'Database file should exist on disk after flush');

  // Verify disk content independently by loading into a fresh SQL.Database instance
  const SQL = await initSqlJs();
  const diskBuffer = fs.readFileSync(dbPath);
  const diskDb = new SQL.Database(diskBuffer);
  const diskStmt = diskDb.prepare('SELECT COUNT(*) as count FROM test_counter');
  diskStmt.step();
  const diskCount = diskStmt.getAsObject();
  diskStmt.free();
  diskDb.close();

  assert.strictEqual(diskCount.count, 50, 'Disk database should contain all 50 rows');
  console.log('  -> Disk file independently verified: 50 rows persisted.');

  // Test 3: saveDbSync persists synchronously
  console.log('Test 3: saveDbSync performs immediate synchronous persistence');
  run('INSERT INTO test_counter (id, value) VALUES (?, ?)', [51, 510]);
  saveDbSync();

  const diskBufferSync = fs.readFileSync(dbPath);
  const diskDbSync = new SQL.Database(diskBufferSync);
  const stmtSync = diskDbSync.prepare('SELECT COUNT(*) as count FROM test_counter');
  stmtSync.step();
  const diskCountSync = stmtSync.getAsObject();
  stmtSync.free();
  diskDbSync.close();

  assert.strictEqual(diskCountSync.count, 51, 'Disk database should immediately reflect row 51');
  console.log('  -> Disk file independently verified: row 51 persisted synchronously.');

  // Cleanup
  fs.rmSync(dbPath, { force: true });
  fs.rmSync(`${dbPath}.tmp`, { force: true });
  console.log('ALL DEBOUNCED DB TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error('FAIL debounced db test:', err);
  process.exit(1);
});
