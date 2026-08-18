const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DB_FILENAME = 'competition_test.db';
const dbPath = path.join(__dirname, '..', 'data', DB_FILENAME);
process.env.CODE_CRACKER_DB_FILENAME = DB_FILENAME;
process.env.CODE_CRACKER_TEAM_LOGIN_CODES = Array.from(
  { length: 15 },
  (_, index) => `COMPTEAM${String(index + 1).padStart(2, '0')}`
).join(',');

const { initDb, getDb, saveDb } = require('../src/db/db');
const { initSchema } = require('../src/db/schema');
const { seedData } = require('../src/db/seed');
const {
  recordPlayoff,
  setTeamStatus,
  getAuditLog,
} = require('../src/services/competition');
const { getLeaderboard } = require('../src/services/scoring');

async function main() {
  fs.rmSync(dbPath, { force: true });
  await initDb();
  initSchema();
  seedData();

  const db = getDb();
  db.run("UPDATE game_state SET mode = 'simulation', phase = 'finished' WHERE id = 1");
  db.run(
    `INSERT INTO final_resolutions
      (team_id, mode, chosen_candidate, is_correct, bonus_points, submitted_at)
     VALUES (1, 'simulation', 'A', 0, 0, '2026-07-26 10:00:00'),
            (2, 'simulation', 'A', 0, 0, '2026-07-26 10:00:00')`
  );
  saveDb();

  const tied = getLeaderboard('simulation');
  const tiedOne = tied.find((team) => team.team_id === 1);
  const tiedTwo = tied.find((team) => team.team_id === 2);
  assert.strictEqual(tiedOne.status, 'TIED');
  assert.strictEqual(tiedTwo.status, 'TIED');
  assert.strictEqual(tiedOne.qualified, false);
  assert.strictEqual(tiedTwo.qualified, false);

  recordPlayoff('simulation', [2, 1], 'Tim 2 menang play-off');
  const resolved = getLeaderboard('simulation');
  const winner = resolved.find((team) => team.team_id === 2);
  const runnerUp = resolved.find((team) => team.team_id === 1);
  assert.strictEqual(winner.status, 'ACTIVE');
  assert.strictEqual(winner.rank, 1);
  assert.strictEqual(winner.qualified, true);
  assert.strictEqual(runnerUp.status, 'ACTIVE');
  assert.strictEqual(runnerUp.rank, 2);
  assert.strictEqual(runnerUp.tied, false);

  setTeamStatus(1, 'simulation', 'DISQUALIFIED', 'Pelanggaran uji');
  const disqualified = getLeaderboard('simulation').find((team) => team.team_id === 1);
  assert.strictEqual(disqualified.status, 'DISQUALIFIED');
  assert.strictEqual(disqualified.rank, null);
  assert.strictEqual(disqualified.qualified, false);

  const audit = getAuditLog('simulation');
  assert.ok(audit.some((entry) => entry.action === 'PLAYOFF_RECORDED'));
  assert.ok(audit.some((entry) => entry.action === 'TEAM_DISQUALIFIED'));

  console.log('PASS competition tie-break, play-off, disqualification, and audit');
}

main()
  .catch((error) => {
    console.error('FAIL competition:', error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(dbPath, { force: true });
  });
