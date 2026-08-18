const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3297;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_FILENAME = 'uat_simulation.db';
const TEST_ADMIN_PASSWORD = 'test-admin-password-2026';
const TEST_VERIFICATION_SECRET = 'test-verification-secret-at-least-32-characters';
const TEST_TEAM_CODES = Array.from({ length: 15 }, (_, index) => `TESTTEAM${String(index + 1).padStart(2, '0')}`);
const serverDir = path.resolve(__dirname, '..');
const dbPath = path.join(serverDir, 'data', DB_FILENAME);

const teams = [];
const results = [];
let child = null;
let serverLogs = '';

function record(id, description, passed, detail = '') {
  results.push({ id, description, status: passed ? 'PASS' : 'FAIL', detail });
  if (!passed) throw new Error(`${id} FAILED: ${description}${detail ? ` (${detail})` : ''}`);
}

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
    } catch (_) {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Server tidak siap dalam 10 detik');
}

async function waitForPhase(adminToken, expectedPhase) {
  const deadline = Date.now() + 15000;
  let lastPhase = 'unknown';
  let lastState = {};
  while (Date.now() < deadline) {
    const response = await request('/api/admin/state', {
      headers: { 'X-Admin-Token': adminToken },
    });
    lastState = response.body;
    lastPhase = response.body.phase || lastPhase;
    if (response.body.phase === expectedPhase) return response.body;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Fase tidak berubah ke ${expectedPhase}; state terakhir: ${JSON.stringify(lastState)}`);
}

async function adminRequest(route, token, body) {
  return request(route, {
    method: 'POST',
    headers: { 'X-Admin-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function teamRequest(team, route, options = {}) {
  return request(route, {
    ...options,
    headers: {
      'X-Team-Id': String(team.team_id),
      'X-Team-Token': team.token,
      ...(options.headers || {}),
    },
  });
}

async function loginTeams() {
  for (let i = 1; i <= 15; i += 1) {
    const response = await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ code: TEST_TEAM_CODES[i - 1] }),
    });
    record(`AUTH-${i}`, `Login tim ${i}`, response.status === 200, `status=${response.status}`);
    teams.push(response.body);
  }
}

const correctOptions = {
  1: 'A', 2: 'A', 3: 'A', 4: 'A', 5: 'A',
  6: 'A', 7: 'A', 8: 'A', 9: 'A', 10: 'A',
  11: 'A', 12: 'A', 13: 'A', 14: 'A', 15: 'C',
};

function buildLevelAnswers(response, quota, leaveUnanswered = false) {
  const answers = {};
  response.body.questions.forEach((question, questionIndex) => {
    const correct = correctOptions[question.id];
    if (leaveUnanswered && questionIndex >= quota) return;
    if (questionIndex < quota) {
      answers[question.id] = correct;
    } else {
      answers[question.id] = question.options.find((option) => option.id !== correct).id;
    }
  });
  return answers;
}

async function playLevel(level, adminToken) {
  const activeState = await waitForPhase(adminToken, `level_${level}`);
  record(`GAME-${level}-START`, `Level ${level} dimulai otomatis setelah fase sebelumnya`,
    activeState.phase === `level_${level}` && activeState.remaining_seconds > 0);

  const questionResponses = await Promise.all(teams.map((team) => teamRequest(team, '/api/questions')));
  questionResponses.forEach((response, index) => {
    record(`GAME-${level}-QUESTIONS-${index + 1}`, `Tim ${index + 1} menerima 5 soal Level ${level}`,
      response.status === 200 && response.body.mode === 'simulation' && response.body.questions.length === 5
      && response.body.questions.every((question) => question.options.length === 4));
  });

  const drafts = [];
  questionResponses.forEach((response, teamIndex) => {
    const team = teams[teamIndex];
    const quota = team.team_id === 1 ? 5 : team.team_id === 2 ? 0 : team.team_id === 3 ? 3 : team.team_id === 4 ? 4 : 1;
    const leaveUnanswered = team.team_id === 15;
    drafts.push(teamRequest(team, '/api/level-draft', {
      method: 'POST',
      body: JSON.stringify({ answers: buildLevelAnswers(response, quota, leaveUnanswered) }),
    }));
  });
  const draftResponses = await Promise.all(drafts);
  record(`GAME-${level}-DRAFT`, `15 draft Level ${level} tersimpan`,
    draftResponses.length === 15 && draftResponses.every((response) => response.status === 200));

  const changedAnswers = buildLevelAnswers(questionResponses[0], 5);
  changedAnswers[questionResponses[0].body.questions[0].id] =
    questionResponses[0].body.questions[0].options.find((option) => option.id !== correctOptions[questionResponses[0].body.questions[0].id]).id;
  const changedDraft = await teamRequest(teams[0], '/api/level-draft', {
    method: 'POST',
    body: JSON.stringify({ answers: changedAnswers }),
  });
  const restoredDraft = await teamRequest(teams[0], '/api/level-draft', {
    method: 'POST',
    body: JSON.stringify({ answers: buildLevelAnswers(questionResponses[0], 5) }),
  });
  record(`GAME-${level}-CHANGE`, `Pilihan Level ${level} dapat diubah sebelum timer habis`,
    changedDraft.status === 200 && restoredDraft.status === 200);

  const invalidDraft = await teamRequest(teams[0], '/api/level-draft', {
    method: 'POST',
    body: JSON.stringify({ answers: { [questionResponses[0].body.questions[0].id]: 'INVALID' } }),
  });
  record(`GAME-${level}-VALIDATION`, `Opsi tidak valid Level ${level} ditolak`, invalidDraft.status === 400);

  await waitForPhase(adminToken, `clue_${level}`);
  const clue = await teamRequest(teams[0], '/api/clues');
  record(`GAME-${level}-CLUE`, `Clue Level ${level} terbuka`, clue.status === 200 && clue.body.clues.length === level);
}

async function runUat() {
  fs.rmSync(dbPath, { force: true });
  child = spawn(process.execPath, ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      CODE_CRACKER_PORT: String(PORT),
      CODE_CRACKER_DB_FILENAME: DB_FILENAME,
      CODE_CRACKER_ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
      CODE_CRACKER_VERIFICATION_SECRET: TEST_VERIFICATION_SECRET,
      CODE_CRACKER_TEAM_LOGIN_CODES: TEST_TEAM_CODES.join(','),
      CODE_CRACKER_OFFICIAL_READY: 'true',
      CODE_CRACKER_SIMULATION_CASE_FILE: '3',
      CODE_CRACKER_SIMULATION_LEVEL_1: '10',
      CODE_CRACKER_SIMULATION_CLUE_1: '3',
      CODE_CRACKER_SIMULATION_LEVEL_2: '10',
      CODE_CRACKER_SIMULATION_CLUE_2: '3',
      CODE_CRACKER_SIMULATION_LEVEL_3: '10',
      CODE_CRACKER_SIMULATION_CLUE_3: '3',
      CODE_CRACKER_SIMULATION_RESOLUTION: '10',
      CODE_CRACKER_OFFICIAL_CASE_FILE: '3',
    },
    windowsHide: true,
  });

  let logs = '';
  child.stdout.on('data', (data) => { logs += data.toString(); serverLogs = logs; });
  child.stderr.on('data', (data) => { logs += data.toString(); serverLogs = logs; });

  await waitForHealth();
  record('SYS-HEALTH', 'Server health endpoint aktif', true);

  const unauthenticated = await request('/api/questions');
  record('AUTH-NEGATIVE', 'Request tanpa token ditolak', unauthenticated.status === 401);

  const adminLogin = await request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: TEST_ADMIN_PASSWORD }),
  });
  record('ADMIN-LOGIN', 'Admin dapat login', adminLogin.status === 200 && !!adminLogin.body.token);
  const adminToken = adminLogin.body.token;

  await loginTeams();
  const wrongTeamToken = await teamRequest({ team_id: 2, token: teams[0].token }, '/api/questions');
  record('AUTH-MISMATCH', 'Token tim tidak dapat dipakai untuk tim lain', wrongTeamToken.status === 401);

  const initialState = await request('/api/admin/state', { headers: { 'X-Admin-Token': adminToken } });
  record('MODE-INITIAL', 'State awal berada di mode simulasi/lobby',
    initialState.status === 200 && initialState.body.mode === 'simulation' && initialState.body.phase === 'lobby');

  const caseFileStart = await adminRequest('/api/admin/start/case_file', adminToken);
  record('CASE-FILE-START', 'Case File 2 menit/simulasi dimulai', caseFileStart.status === 200 && caseFileStart.body.ok === true);
  await playLevel(1, adminToken);
  await playLevel(2, adminToken);
  await playLevel(3, adminToken);

  const resolutionStart = await adminRequest('/api/admin/start/resolution', adminToken);
  record('RESOLUTION-START', 'Final Resolution dimulai', resolutionStart.status === 200 && resolutionStart.body.ok === true);

  const invalidCandidate = await teamRequest(teams[0], '/api/submit-resolution', {
    method: 'POST',
    body: JSON.stringify({ candidate: 'INVALID' }),
  });
  record('RESOLUTION-NEGATIVE', 'Kandidat tidak valid ditolak', invalidCandidate.status === 400);

  const resolutions = await Promise.all(teams.map((team) => teamRequest(team, '/api/submit-resolution', {
    method: 'POST',
    body: JSON.stringify({ candidate: team.team_id === 1 ? 'C' : 'A' }),
  })));
  record('RESOLUTION-SUBMIT', '15 resolution diproses', resolutions.every((response) => response.status === 200));
  await waitForPhase(adminToken, 'finished');

  const simulationLeaderboard = await request('/api/leaderboard');
  const teamOne = simulationLeaderboard.body.leaderboard.find((team) => team.team_id === 1);
  const teamTwo = simulationLeaderboard.body.leaderboard.find((team) => team.team_id === 2);
  const teamFifteen = simulationLeaderboard.body.leaderboard.find((team) => team.team_id === 15);
  record('SCORE-CALCULATION', 'Skor Tim 1 sesuai 330 poin', simulationLeaderboard.status === 200 && teamOne.total === 330);
  record('SCORE-WRONG-PENALTY', 'Jawaban salah mendapat penalti level', teamTwo.total === -60);
  record('SCORE-EMPTY-PENALTY', 'Jawaban kosong mendapat penalti level', teamFifteen.total === 36);
  record('LEADERBOARD-COUNT', 'Leaderboard berisi 15 tim', simulationLeaderboard.body.leaderboard.length === 15);

  const switchOfficial = await adminRequest('/api/admin/mode', adminToken, { mode: 'official' });
  record('MODE-ISOLATION', 'Mode resmi dapat dimulai dari kondisi bersih', switchOfficial.status === 200 && switchOfficial.body.mode === 'official');
  const officialLeaderboard = await request('/api/leaderboard');
  record('MODE-SCORE-ISOLATION', 'Skor simulasi tidak masuk leaderboard resmi',
    officialLeaderboard.status === 200 && officialLeaderboard.body.leaderboard.every((team) => team.total === 0));

  const officialStart = await adminRequest('/api/admin/start/case_file', adminToken);
  await waitForPhase(adminToken, 'level_1');
  const officialQuestions = await teamRequest(teams[0], '/api/questions');
  record('OFFICIAL-DATA', 'Mode resmi menyediakan dataset terpisah',
    officialStart.status === 200 && officialQuestions.status === 200 && officialQuestions.body.mode === 'official' && officialQuestions.body.questions.length === 5);

  const disqualify = await adminRequest('/api/admin/disqualify', adminToken, {
    team_id: 15,
    reason: 'UAT: simulasi pelanggaran aturan',
  });
  record('DQ-RECORD', 'Admin dapat mencatat diskualifikasi',
    disqualify.status === 200 && disqualify.body.status === 'DISQUALIFIED');

  const blockedDraft = await teamRequest(teams[14], '/api/level-draft', {
    method: 'POST',
    body: JSON.stringify({ answers: {} }),
  });
  record('DQ-BLOCK', 'Tim terdiskualifikasi tidak dapat mengubah jawaban', blockedDraft.status === 403);

  const disqualifiedLeaderboard = await request('/api/leaderboard');
  const disqualifiedTeam = disqualifiedLeaderboard.body.leaderboard.find((team) => team.team_id === 15);
  record('DQ-LEADERBOARD', 'Tim terdiskualifikasi tidak masuk peringkat',
    disqualifiedTeam && disqualifiedTeam.status === 'DISQUALIFIED' && disqualifiedTeam.rank === null && !disqualifiedTeam.qualified);

  const reinstate = await adminRequest('/api/admin/reinstate', adminToken, { team_id: 15 });
  record('DQ-REINSTATE', 'Status tim dapat dipulihkan oleh admin',
    reinstate.status === 200 && reinstate.body.status === 'ACTIVE');

  const competition = await request('/api/admin/competition', {
    headers: { 'X-Admin-Token': adminToken },
  });
  const auditActions = (competition.body.audit_log || []).map((entry) => entry.action);
  record('AUDIT-TRAIL', 'Diskualifikasi dan pemulihan masuk audit trail',
    competition.status === 200 && auditActions.includes('TEAM_DISQUALIFIED') && auditActions.includes('TEAM_REINSTATED'));

  console.log('\nUAT RESULTS');
  results.forEach((result) => console.log(`${result.status} ${result.id} - ${result.description}`));
  console.log(`\nTOTAL: ${results.length} | PASS: ${results.filter((result) => result.status === 'PASS').length} | FAIL: ${results.filter((result) => result.status === 'FAIL').length}`);
  if (logs.includes('Error')) console.log('\nSERVER LOG NOTICE:\n' + logs);
}

async function main() {
  try {
    await runUat();
  } catch (error) {
    console.error(`\nUAT FAILED: ${error.message}`);
    if (serverLogs) console.error(`\nSERVER LOGS:\n${serverLogs}`);
    process.exitCode = 1;
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    fs.rmSync(dbPath, { force: true });
  }
}

main();
