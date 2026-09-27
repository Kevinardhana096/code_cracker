const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3298;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_FILENAME = 'resolution_flow_test.db';
const TEST_ADMIN_PASSWORD = 'test-admin-password-2026';
const TEST_TEAM_CODES = Array.from({ length: 15 }, (_, index) => `TESTTEAM${String(index + 1).padStart(2, '0')}`);
const serverDir = path.resolve(__dirname, '..');
const dbPath = path.join(serverDir, 'data', DB_FILENAME);

let child = null;
let serverLogs = '';

async function request(route, options = {}) {
  const response = await fetch(`${BASE_URL}${route}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  let body = null;
  try {
    body = await response.json();
  } catch (_) {
    body = {};
  }
  return { status: response.status, body };
}

async function waitForHealth() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await request('/api/health');
      if (response.status === 200) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Server tidak siap dalam 10 detik');
}

async function main() {
  fs.rmSync(dbPath, { force: true });
  child = spawn(process.execPath, ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      CODE_CRACKER_PORT: String(PORT),
      CODE_CRACKER_DB_FILENAME: DB_FILENAME,
      CODE_CRACKER_ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
      CODE_CRACKER_TEAM_LOGIN_CODES: TEST_TEAM_CODES.join(','),
      CODE_CRACKER_OFFICIAL_READY: 'true',
      CODE_CRACKER_SIMULATION_RESOLUTION: '10',
    },
    windowsHide: true,
  });

  child.stdout.on('data', (data) => { serverLogs += data.toString(); });
  child.stderr.on('data', (data) => { serverLogs += data.toString(); });

  await waitForHealth();
  console.log('Testing Resolution Flow & Anti-Leak Protection...');

  // 1. Admin login
  const adminLogin = await request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: TEST_ADMIN_PASSWORD }),
  });
  assert.strictEqual(adminLogin.status, 200);
  const adminToken = adminLogin.body.token;

  // 2. Team 1 login
  const teamLogin = await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ code: TEST_TEAM_CODES[0] }),
  });
  assert.strictEqual(teamLogin.status, 200);
  const teamToken = teamLogin.body.token;
  const teamHeaders = {
    'X-Team-Id': '1',
    'X-Team-Token': teamToken,
  };

  // 3. Attempt results before finished -> MUST return 400 (no leak)
  const prematureResults = await request('/api/results', { headers: teamHeaders });
  assert.strictEqual(prematureResults.status, 400, 'Premature results must be blocked');

  // 4. Step through phases to reach resolution
  for (const phase of ['case_file', 'level_1', 'clue_1', 'level_2', 'clue_2', 'level_3', 'clue_3', 'resolution']) {
    const res = await request(`/api/admin/start/${phase}`, {
      method: 'POST',
      headers: { 'X-Admin-Token': adminToken },
    });
    assert.strictEqual(res.status, 200, `Starting phase ${phase} failed`);
    assert.strictEqual(res.body.phase, phase);
  }

  // 5. GET /api/resolution before selection
  const initialRes = await request('/api/resolution', { headers: teamHeaders });
  assert.strictEqual(initialRes.status, 200);
  assert.strictEqual(initialRes.body.chosen_candidate, null);
  assert.strictEqual(initialRes.body.is_locked, false);

  // 6. Submit candidate 'A' (incorrect candidate)
  const submitA = await request('/api/submit-resolution', {
    method: 'POST',
    headers: teamHeaders,
    body: JSON.stringify({ candidate: 'A' }),
  });
  assert.strictEqual(submitA.status, 200);
  assert.strictEqual(submitA.body.ok, true);
  assert.strictEqual(submitA.body.chosen_candidate, 'A');
  // CRITICAL ANTI-LEAK CHECK: Must NOT leak is_correct or bonus_points
  assert.strictEqual(submitA.body.is_correct, undefined, 'is_correct must NOT be in response');
  assert.strictEqual(submitA.body.bonus_points, undefined, 'bonus_points must NOT be in response');

  // 7. Check leaderboard during resolution: bonus must NOT be visible yet
  const midLeaderboard = await request('/api/leaderboard');
  assert.strictEqual(midLeaderboard.status, 200);
  const team1Mid = midLeaderboard.body.leaderboard.find((t) => t.team_id === 1);
  assert.strictEqual(team1Mid.bonus, 0, 'Bonus must not be visible on leaderboard during resolution');
  assert.strictEqual(team1Mid.total, 0);

  // 8. Change candidate to 'C' (the correct candidate) while timer still running
  const submitC = await request('/api/submit-resolution', {
    method: 'POST',
    headers: teamHeaders,
    body: JSON.stringify({ candidate: 'C' }),
  });
  if (submitC.status !== 200) {
    console.error('submitC error:', submitC.status, submitC.body);
  }
  assert.strictEqual(submitC.status, 200, 'Changing candidate must be allowed');
  assert.strictEqual(submitC.body.ok, true);
  assert.strictEqual(submitC.body.chosen_candidate, 'C');
  assert.strictEqual(submitC.body.is_correct, undefined, 'is_correct must NOT be in response');
  assert.strictEqual(submitC.body.bonus_points, undefined, 'bonus_points must NOT be in response');

  // 9. GET /api/resolution after refresh/reconnect
  const restoredRes = await request('/api/resolution', { headers: teamHeaders });
  assert.strictEqual(restoredRes.status, 200);
  assert.strictEqual(restoredRes.body.chosen_candidate, 'C', 'Choice must be restored on refresh');
  assert.strictEqual(restoredRes.body.is_locked, false);

  // 10. Transition to finished phase
  const finishRes = await request('/api/admin/start/finished', {
    method: 'POST',
    headers: { 'X-Admin-Token': adminToken },
  });
  assert.strictEqual(finishRes.status, 200);
  assert.strictEqual(finishRes.body.phase, 'finished');

  // 11. GET /api/resolution after finish -> must be locked
  const lockedRes = await request('/api/resolution', { headers: teamHeaders });
  assert.strictEqual(lockedRes.status, 200);
  assert.strictEqual(lockedRes.body.is_locked, true, 'Resolution must be locked after finished');

  // 12. Attempt to submit resolution after finished -> MUST fail
  const postFinishSubmit = await request('/api/submit-resolution', {
    method: 'POST',
    headers: teamHeaders,
    body: JSON.stringify({ candidate: 'D' }),
  });
  assert.strictEqual(postFinishSubmit.status, 400, 'Submissions after finished must be rejected');

  // 13. Check finalized leaderboard: bonus +30 must now be active!
  const finalLeaderboard = await request('/api/leaderboard');
  assert.strictEqual(finalLeaderboard.status, 200);
  const team1Final = finalLeaderboard.body.leaderboard.find((t) => t.team_id === 1);
  assert.strictEqual(team1Final.bonus, 30, 'Bonus +30 must be awarded on finalized leaderboard');
  assert.strictEqual(team1Final.total, 30);

  // 14. GET /api/results after finished: now accessible with breakdown
  const finalResults = await request('/api/results', { headers: teamHeaders });
  assert.strictEqual(finalResults.status, 200);
  assert.strictEqual(finalResults.body.breakdown.final_resolution.chosen, 'C');
  assert.strictEqual(finalResults.body.breakdown.final_resolution.bonus, 30);
  assert.strictEqual(finalResults.body.breakdown.final_resolution.is_correct, 1);

  console.log('PASS: All resolution flow and anti-leak tests passed successfully!');
}

main()
  .catch((err) => {
    console.error('FAIL resolution flow test:', err);
    if (serverLogs) console.error('Server logs:\n', serverLogs);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    fs.rmSync(dbPath, { force: true });
  });
