const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DB_FILENAME = 'pause_timer_test.db';
const dbPath = path.join(__dirname, '..', 'data', DB_FILENAME);
process.env.CODE_CRACKER_DB_FILENAME = DB_FILENAME;

const { initDb, getDb, saveDb } = require('../src/db/db');
const { initSchema } = require('../src/db/schema');
const { seedData } = require('../src/db/seed');
const game = require('../src/services/game');

async function main() {
  fs.rmSync(dbPath, { force: true });
  await initDb();
  initSchema();
  seedData();

  console.log('Test 1: Initial state is lobby and not paused');
  const state0 = game.getState();
  assert.strictEqual(state0.phase, 'lobby');
  assert.strictEqual(game.isPaused(), false);

  console.log('Test 2: Transition to case_file');
  const t1 = game.transition('case_file');
  assert.strictEqual(t1.ok, true);
  const state1 = game.getState();
  assert.strictEqual(state1.phase, 'case_file');
  assert.strictEqual(game.isPaused(), false);
  assert(game.getRemainingSeconds() > 0);

  console.log('Test 3: Pause timer');
  const pauseResult = game.pauseTimer();
  assert.strictEqual(pauseResult.ok, true);
  assert(pauseResult.remaining_seconds > 0);
  assert.strictEqual(game.isPaused(), true);

  const remainingFrozen = game.getRemainingSeconds();
  assert.strictEqual(remainingFrozen, pauseResult.remaining_seconds);

  // Attempting to pause again should return error
  const pauseAgain = game.pauseTimer();
  assert.strictEqual(pauseAgain.ok, false);

  console.log('Test 4: Resume timer');
  const resumeResult = game.resumeTimer();
  assert.strictEqual(resumeResult.ok, true);
  assert.strictEqual(game.isPaused(), false);
  assert(game.getRemainingSeconds() <= remainingFrozen);

  // Attempting to resume again should return error
  const resumeAgain = game.resumeTimer();
  assert.strictEqual(resumeAgain.ok, false);

  console.log('Test 5: Reset mode clears pause state');
  game.pauseTimer();
  assert.strictEqual(game.isPaused(), true);
  game.resetMode('simulation');
  assert.strictEqual(game.isPaused(), false);
  assert.strictEqual(game.getState().phase, 'lobby');

  console.log('ALL PAUSE TIMER TESTS PASSED!');
  fs.rmSync(dbPath, { force: true });
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
