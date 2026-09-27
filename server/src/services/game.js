const { queryOne, run, getDb, saveDb } = require('../db/db');
const config = require('../config');

function getState() {
  return queryOne('SELECT * FROM game_state WHERE id = 1');
}

function getMode() {
  const state = getState();
  return state && state.mode ? state.mode : 'simulation';
}

function isValidMode(mode) {
  return config.GAME_MODES.includes(mode);
}

function getDurationForPhase(phase, mode = getMode()) {
  const durationMap = mode === 'simulation'
    ? config.SIMULATION_DURATION_MAP
    : config.LEVEL_DURATION_MAP;
  return durationMap[phase] || 0;
}

function transition(newPhase) {
  const state = getState();
  const currentPhase = state.phase;

  const allowed = config.VALID_TRANSITIONS[currentPhase] || [];
  if (!allowed.includes(newPhase)) {
    return { ok: false, error: `Cannot transition from ${currentPhase} to ${newPhase}` };
  }

  const isTimedPhase = [
    'case_file', 'level_1', 'clue_1', 'level_2', 'clue_2',
    'level_3', 'clue_3', 'resolution',
  ].includes(newPhase);
  if (isTimedPhase) {
    const duration = getDurationForPhase(newPhase, state.mode);
    const now = Math.floor(Date.now() / 1000);
    run('UPDATE game_state SET phase = ?, level_started_at = ?, level_duration_seconds = ?, is_paused = 0, paused_remaining_seconds = NULL WHERE id = 1',
      [newPhase, now, duration]);
  } else {
    run('UPDATE game_state SET phase = ?, level_started_at = NULL, level_duration_seconds = NULL, is_paused = 0, paused_remaining_seconds = NULL WHERE id = 1',
      [newPhase]);
  }

  return { ok: true, phase: newPhase };
}

function resetMode(mode) {
  if (!isValidMode(mode)) {
    return { ok: false, error: 'Mode permainan tidak valid' };
  }

  const db = getDb();
  db.run('DELETE FROM submissions WHERE mode = ?', [mode]);
  db.run('DELETE FROM level_drafts WHERE mode = ?', [mode]);
  db.run('DELETE FROM level_results WHERE mode = ?', [mode]);
  db.run('DELETE FROM team_competition_status WHERE mode = ?', [mode]);
  db.run('DELETE FROM playoff_results WHERE mode = ?', [mode]);
  db.run('DELETE FROM team_question_order WHERE mode = ?', [mode]);
  db.run('DELETE FROM clues_unlocked WHERE mode = ?', [mode]);
  db.run('DELETE FROM final_resolutions WHERE mode = ?', [mode]);
  db.run(
    'UPDATE game_state SET mode = ?, phase = ?, level_started_at = NULL, level_duration_seconds = NULL, is_paused = 0, paused_remaining_seconds = NULL WHERE id = 1',
    [mode, 'lobby']
  );
  saveDb();

  return { ok: true, mode, phase: 'lobby' };
}

function getRemainingSeconds() {
  const state = getState();
  if (!state) return 0;
  if (state.is_paused) {
    return Math.max(0, state.paused_remaining_seconds || 0);
  }
  if (!state.level_started_at || !state.level_duration_seconds) {
    return 0;
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - state.level_started_at;
  const remaining = state.level_duration_seconds - elapsed;
  return Math.max(0, remaining);
}

function isPaused() {
  const state = getState();
  return Boolean(state && state.is_paused);
}

function pauseTimer() {
  const state = getState();
  if (!state) return { ok: false, error: 'State game tidak ditemukan' };
  if (state.is_paused) return { ok: false, error: 'Timer sudah dalam keadaan jeda' };
  if (!state.level_started_at || !state.level_duration_seconds) {
    return { ok: false, error: 'Tidak ada timer aktif yang dapat dijeda' };
  }
  const remaining = getRemainingSeconds();
  run('UPDATE game_state SET is_paused = 1, paused_remaining_seconds = ? WHERE id = 1', [remaining]);
  saveDb();
  return { ok: true, remaining_seconds: remaining };
}

function resumeTimer() {
  const state = getState();
  if (!state) return { ok: false, error: 'State game tidak ditemukan' };
  if (!state.is_paused) return { ok: false, error: 'Timer tidak sedang dijeda' };
  const remaining = Math.max(0, state.paused_remaining_seconds || 0);
  const now = Math.floor(Date.now() / 1000);
  run('UPDATE game_state SET is_paused = 0, paused_remaining_seconds = NULL, level_started_at = ?, level_duration_seconds = ? WHERE id = 1',
    [now, remaining]);
  saveDb();
  return { ok: true, remaining_seconds: remaining };
}

function isTimerExpired() {
  return getRemainingSeconds() <= 0;
}

function isActiveLevel() {
  const state = getState();
  return [
    'case_file', 'level_1', 'clue_1', 'level_2', 'clue_2',
    'level_3', 'clue_3', 'resolution',
  ].includes(state.phase);
}

function getLevelForPhase(phase) {
  const map = { level_1: 1, level_2: 2, level_3: 3 };
  return map[phase] || null;
}

module.exports = {
  getDurationForPhase,
  getMode,
  getState,
  isValidMode,
  transition,
  getRemainingSeconds,
  isPaused,
  pauseTimer,
  resumeTimer,
  isTimerExpired,
  isActiveLevel,
  getLevelForPhase,
  resetMode,
};
