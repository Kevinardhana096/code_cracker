const express = require('express');
const router = express.Router();
const game = require('../services/game');
const { startTimer } = require('../services/timer');
const { authenticateAdmin, issueAdminToken } = require('../middleware/auth');
const { queryAll, queryOne, run, saveDb, getDb } = require('../db/db');
const fs = require('fs');
const path = require('path');
const {
  getQuestionImageReport,
  saveQuestionImage,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
} = require('../services/questionImages');

const OPTION_IDS = ['A', 'B', 'C', 'D', 'E'];
const { parseOptions } = require('../services/levelAnswers');
const {
  setTeamStatus,
  recordPlayoff,
  getAuditLog,
} = require('../services/competition');
const { getLeaderboard } = require('../services/scoring');
const crypto = require('crypto');

const adminAttempts = new Map();

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/login', (req, res) => {
  const { password } = req.body;
  const config = require('../config');
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const previous = adminAttempts.get(key);
  const attempt = !previous || now - previous.startedAt >= 60000
    ? { startedAt: now, count: 0 }
    : previous;
  attempt.count += 1;
  adminAttempts.set(key, attempt);
  if (attempt.count > 5) {
    res.set('Retry-After', String(Math.ceil((60000 - (now - attempt.startedAt)) / 1000)));
    return res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi nanti.' });
  }
  if (safeEqual(password, config.ADMIN_PASSWORD)) {
    adminAttempts.delete(key);
    return res.json({ ok: true, token: issueAdminToken() });
  }
  res.status(401).json({ error: 'Password salah' });
});

router.post('/start/:phase', authenticateAdmin, (req, res) => {
  const { phase } = req.params;
  const result = game.transition(phase);

  if (!result.ok) {
    return res.status(400).json(result);
  }

  const io = req.app.get('io');
  io.emit('phase:changed', { phase: result.phase, mode: game.getMode() });
  const { recordAudit } = require('../services/competition');
  recordAudit({
    mode: game.getMode(),
    action: 'PHASE_STARTED',
    details: { phase: result.phase },
  });

  if (require('../services/timer').TIMED_PHASES.includes(phase)) {
    startTimer(io, (completedPhase, nextPhase) => {
      // Timer expired handler is in timer.js
    });
  } else if (result.phase === 'finished') {
    const { getLeaderboard } = require('../services/scoring');
    io.emit('leaderboard:update', { leaderboard: getLeaderboard(game.getMode()) });
  }

  res.json({ ok: true, phase: result.phase });
});

router.post('/mode', authenticateAdmin, (req, res) => {
  const { mode } = req.body;
  if (!game.isValidMode(mode)) {
    return res.status(400).json({ error: 'Mode permainan tidak valid' });
  }
  const config = require('../config');
  if (mode === 'official' && !config.OFFICIAL_READY) {
    return res.status(409).json({ error: 'Dataset resmi belum dikonfirmasi. Set CODE_CRACKER_OFFICIAL_READY=true setelah materi final dipasang.' });
  }

  const { stopTimer } = require('../services/timer');
  stopTimer();
  const result = game.resetMode(mode);
  const io = req.app.get('io');
  const { recordAudit } = require('../services/competition');
  recordAudit({ mode, action: 'MODE_RESET', details: { mode } });
  io.emit('mode:changed', { mode });
  io.emit('phase:changed', { phase: 'lobby', mode });
  return res.json(result);
});

router.get('/state', authenticateAdmin, (req, res) => {
  const state = game.getState();
  const remaining = game.getRemainingSeconds();
  res.json({
    phase: state.phase,
    mode: state.mode,
    level_started_at: state.level_started_at,
    level_duration_seconds: state.level_duration_seconds,
    remaining_seconds: remaining,
    is_paused: Boolean(state.is_paused),
    is_resuming: game.isResuming(),
    countdown: game.getResumeCountdown(),
  });
});

router.post('/timer/pause', authenticateAdmin, (req, res) => {
  if (game.isResuming()) {
    game.cancelResumeCountdown();
    const io = req.app.get('io');
    const state = game.getState();
    if (io) {
      io.emit('timer:paused', {
        phase: state.phase,
        mode: state.mode,
        remaining_seconds: state.paused_remaining_seconds,
      });
    }
    return res.json({ ok: true, is_paused: true, remaining_seconds: state.paused_remaining_seconds });
  }

  const result = game.pauseTimer();
  if (!result.ok) {
    return res.status(400).json(result);
  }

  const io = req.app.get('io');
  const state = game.getState();
  if (io) {
    io.emit('timer:paused', {
      phase: state.phase,
      mode: state.mode,
      remaining_seconds: result.remaining_seconds,
    });
  }

  const { recordAudit } = require('../services/competition');
  recordAudit({
    mode: game.getMode(),
    action: 'TIMER_PAUSED',
    details: { phase: state.phase, remaining_seconds: result.remaining_seconds },
  });

  return res.json({ ok: true, is_paused: true, remaining_seconds: result.remaining_seconds });
});

router.post('/timer/resume', authenticateAdmin, (req, res) => {
  const state = game.getState();
  if (!state) return res.status(400).json({ ok: false, error: 'State game tidak ditemukan' });
  if (!state.is_paused) return res.status(400).json({ ok: false, error: 'Timer tidak sedang dijeda' });

  const io = req.app.get('io');
  const { recordAudit } = require('../services/competition');

  if (req.body && req.body.immediate) {
    game.cancelResumeCountdown();
    const result = game.resumeTimer();
    if (!result.ok) {
      return res.status(400).json(result);
    }
    if (io) {
      io.emit('timer:resumed', {
        phase: state.phase,
        mode: state.mode,
        remaining_seconds: result.remaining_seconds,
      });
    }
    recordAudit({
      mode: game.getMode(),
      action: 'TIMER_RESUMED',
      details: { phase: state.phase, remaining_seconds: result.remaining_seconds },
    });
    return res.json({ ok: true, is_paused: false, remaining_seconds: result.remaining_seconds });
  }

  if (game.isResuming()) {
    return res.json({
      ok: true,
      is_resuming: true,
      countdown: game.getResumeCountdown(),
      remaining_seconds: state.paused_remaining_seconds,
    });
  }

  recordAudit({
    mode: game.getMode(),
    action: 'TIMER_RESUME_REQUESTED',
    details: { phase: state.phase, remaining_seconds: state.paused_remaining_seconds, countdown: 5 },
  });

  const countdownResult = game.startResumeCountdown(io, 5, (resumeResult) => {
    recordAudit({
      mode: game.getMode(),
      action: 'TIMER_RESUMED',
      details: { phase: state.phase, remaining_seconds: resumeResult.remaining_seconds },
    });
  });

  return res.json({
    ok: true,
    is_resuming: true,
    countdown: countdownResult.countdown || 5,
    remaining_seconds: state.paused_remaining_seconds,
  });
});

router.get('/competition', authenticateAdmin, (_req, res) => {
  const mode = game.getMode();
  res.json({ mode, leaderboard: getLeaderboard(mode), audit_log: getAuditLog(mode) });
});

router.get('/audit', authenticateAdmin, (req, res) => {
  const mode = req.query.mode || game.getMode();
  res.json({ mode, audit_log: getAuditLog(mode, req.query.limit) });
});

router.post('/disqualify', authenticateAdmin, (req, res) => {
  const mode = game.getMode();
  const teamId = Number(req.body && req.body.team_id);
  const reason = String((req.body && req.body.reason) || '').trim();
  const team = queryOne('SELECT id, name FROM teams WHERE id = ?', [teamId]);

  if (!team) return res.status(400).json({ error: 'Tim tidak ditemukan' });
  if (!reason) return res.status(400).json({ error: 'Alasan diskualifikasi wajib diisi' });

  setTeamStatus(teamId, mode, 'DISQUALIFIED', reason);
  const io = req.app.get('io');
  if (io) io.emit('leaderboard:update', { leaderboard: getLeaderboard(mode) });
  return res.json({ ok: true, team_id: teamId, team_name: team.name, status: 'DISQUALIFIED' });
});

router.post('/reinstate', authenticateAdmin, (req, res) => {
  const mode = game.getMode();
  const teamId = Number(req.body && req.body.team_id);
  const team = queryOne('SELECT id, name FROM teams WHERE id = ?', [teamId]);

  if (!team) return res.status(400).json({ error: 'Tim tidak ditemukan' });

  setTeamStatus(teamId, mode, 'ACTIVE', null);
  const io = req.app.get('io');
  if (io) io.emit('leaderboard:update', { leaderboard: getLeaderboard(mode) });
  return res.json({ ok: true, team_id: teamId, team_name: team.name, status: 'ACTIVE' });
});

router.post('/playoff', authenticateAdmin, (req, res) => {
  const mode = game.getMode();
  const orderedTeamIds = Array.isArray(req.body && req.body.ordered_team_ids)
    ? req.body.ordered_team_ids.map(Number)
    : [];
  const notes = String((req.body && req.body.notes) || '').trim();

  if (orderedTeamIds.length < 2 || orderedTeamIds.some((id) => !Number.isInteger(id) || id < 1)) {
    return res.status(400).json({ error: 'Minimal dua ID tim diperlukan dalam urutan hasil play-off' });
  }
  if (game.getState().phase !== 'finished') {
    return res.status(400).json({ error: 'Play-off hanya dapat dicatat setelah permainan selesai' });
  }
  if (new Set(orderedTeamIds).size !== orderedTeamIds.length) {
    return res.status(400).json({ error: 'ID tim play-off tidak boleh duplikat' });
  }

  const leaderboard = getLeaderboard(mode);
  const rows = orderedTeamIds.map((teamId) => leaderboard.find((row) => row.team_id === teamId));
  if (rows.some((row) => !row)) return res.status(400).json({ error: 'Ada tim play-off yang tidak ditemukan' });
  if (rows.some((row) => row.status === 'DISQUALIFIED')) {
    return res.status(400).json({ error: 'Tim terdiskualifikasi tidak dapat mengikuti play-off' });
  }
  if (rows.some((row) => row.tie_key !== rows[0].tie_key)) {
    return res.status(400).json({ error: 'Tim play-off harus memiliki skor dan tie-break yang sama' });
  }
  const tiedPeers = leaderboard
    .filter((row) => row.status === 'TIED' && row.tie_key === rows[0].tie_key)
    .map((row) => row.team_id)
    .sort((a, b) => a - b);
  const requestedPeers = [...orderedTeamIds].sort((a, b) => a - b);
  if (tiedPeers.length !== requestedPeers.length
    || tiedPeers.some((teamId, index) => teamId !== requestedPeers[index])) {
    return res.status(400).json({ error: 'Play-off harus mencakup seluruh tim yang masih seri' });
  }

  const result = recordPlayoff(mode, orderedTeamIds, notes);
  const io = req.app.get('io');
  if (io) io.emit('leaderboard:update', { leaderboard: getLeaderboard(mode) });
  return res.json({ ok: true, ...result });
});

router.get('/questions', authenticateAdmin, (req, res) => {
  const requestedMode = req.query.mode || game.getMode();
  if (!['simulation', 'official'].includes(requestedMode)) {
    return res.status(400).json({ error: 'Mode permainan tidak valid' });
  }

  const images = getQuestionImageReport(requestedMode);
  const imageByQuestionId = new Map(images.map((image) => [image.question_id, image]));
  const questions = queryAll(
    'SELECT id, level, topic, question_text, options_json, points FROM questions WHERE mode = ? ORDER BY level, id',
    [requestedMode]
  );

  return res.json({
    mode: requestedMode,
    limits: {
      max_file_size_bytes: MAX_FILE_SIZE_BYTES,
      max_image_dimension: MAX_IMAGE_DIMENSION,
    },
    questions: questions.map((question) => ({
      id: question.id,
      level: question.level,
      topic: question.topic,
      question_text: question.question_text,
      options: parseOptions(question),
      points: question.points,
      image: imageByQuestionId.get(question.id) || null,
    })),
    unrecognized_images: images.filter((image) => !questions.some((question) => question.id === image.question_id)),
  });
});

// --- Manajemen Soal ---

function validateQuestionPayload(body) {
  const errors = [];
  const level = Number(body && body.level);
  if (![1, 2, 3].includes(level)) errors.push('Level harus 1, 2, atau 3');

  const topic = String((body && body.topic) || '').trim();
  const questionText = String((body && body.question_text) || '').trim();
  if (!questionText) errors.push('Teks soal wajib diisi');

  const answerKey = String((body && body.answer_key) || '').trim().toUpperCase();
  if (!OPTION_IDS.includes(answerKey)) errors.push('Kunci jawaban harus A, B, C, D, atau E');

  const rawOptions = (body && body.options) || {};
  const options = OPTION_IDS.map((id) => {
    const entry = rawOptions[id];
    // Dukung dua bentuk: string teks, atau { text, image_url }
    const text = typeof entry === 'object' && entry !== null ? entry.text : entry;
    const imageUrl = typeof entry === 'object' && entry !== null ? entry.image_url : null;
    return { id, text: String(text || '').trim(), image_url: imageUrl || null };
  });
  if (options.some((option) => !option.text && !option.image_url)) {
    errors.push('Setiap opsi A-E wajib berisi teks atau gambar');
  }

  const points = Number(body && body.points);
  if (!Number.isFinite(points) || points <= 0) errors.push('Poin harus lebih dari 0');

  return {
    errors,
    value: { level, topic, questionText, answerKey, options, points: Math.round(points) },
  };
}

// Edit/hapus soal dikunci saat pertandingan berjalan agar penilaian tidak rusak.
function questionEditGuard(_req, res, next) {
  if (game.getState().phase !== 'lobby') {
    return res.status(409).json({ error: 'Soal hanya dapat diubah saat fase lobby. Reset atau tunggu pertandingan selesai.' });
  }
  next();
}

router.get('/questions/full', authenticateAdmin, (req, res) => {
  const requestedMode = req.query.mode || game.getMode();
  if (!['simulation', 'official'].includes(requestedMode)) {
    return res.status(400).json({ error: 'Mode permainan tidak valid' });
  }
  const questions = queryAll(
    'SELECT * FROM questions WHERE mode = ? ORDER BY level, id',
    [requestedMode]
  );
  res.json({
    mode: requestedMode,
    locked: game.getState().phase !== 'lobby',
    questions: questions.map((question) => ({
      id: question.id,
      level: question.level,
      topic: question.topic || '',
      question_text: question.question_text,
      answer_key: question.answer_key,
      options: parseOptions(question),
      points: question.points,
    })),
  });
});

router.post('/questions', authenticateAdmin, questionEditGuard, (req, res) => {
  const { errors, value } = validateQuestionPayload(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const mode = game.getMode();
  const count = queryOne('SELECT COUNT(*) AS count FROM questions WHERE mode = ? AND level = ?', [mode, value.level]);
  if (count.count >= 5) {
    return res.status(400).json({ error: `Level ${value.level} sudah memiliki 5 soal (maksimal). Hapus salah satu dulu.` });
  }

  const { run, saveDb } = require('../db/db');
  const { recordAudit } = require('../services/competition');
  run(
    'INSERT INTO questions (mode, level, topic, question_text, answer_key, options_json, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [mode, value.level, value.topic, value.questionText, value.answerKey, JSON.stringify(value.options), value.points]
  );
  saveDb();
  recordAudit({ mode, action: 'QUESTION_ADDED', details: { level: value.level, topic: value.topic } });
  res.json({ ok: true });
});

router.put('/questions/:id', authenticateAdmin, questionEditGuard, (req, res) => {
  const { errors, value } = validateQuestionPayload(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const existing = queryOne('SELECT * FROM questions WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  const { run, saveDb } = require('../db/db');
  const { recordAudit } = require('../services/competition');
  run(
    'UPDATE questions SET level = ?, topic = ?, question_text = ?, answer_key = ?, options_json = ?, points = ? WHERE id = ?',
    [value.level, value.topic, value.questionText, value.answerKey, JSON.stringify(value.options), value.points, existing.id]
  );
  saveDb();
  recordAudit({ mode: existing.mode, action: 'QUESTION_UPDATED', details: { question_id: existing.id, level: value.level } });
  res.json({ ok: true });
});

router.delete('/questions/:id', authenticateAdmin, questionEditGuard, (req, res) => {
  const existing = queryOne('SELECT * FROM questions WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  const { run, saveDb } = require('../db/db');
  const { recordAudit } = require('../services/competition');
  run('DELETE FROM questions WHERE id = ?', [existing.id]);
  saveDb();
  recordAudit({ mode: existing.mode, action: 'QUESTION_DELETED', details: { question_id: existing.id, level: existing.level } });
  res.json({ ok: true });
});

// --- Manajemen Clue ---

function validateCluePayload(body) {
  const errors = [];
  const level = Number(body && body.level);
  if (![1, 2, 3].includes(level)) errors.push('Level harus 1, 2, atau 3');

  const minCorrect = Number(body && body.min_correct);
  const maxCorrect = Number(body && body.max_correct);
  if (minCorrect < 0 || maxCorrect < 0 || minCorrect > maxCorrect) {
    errors.push('min_correct dan max_correct harus bilangan bulat non-negatif, dan min_correct ≤ max_correct');
  }

  const clueText = String((body && body.clue_text) || '').trim();
  if (!clueText) errors.push('Teks clue wajib diisi');
  if (clueText.length > 500) errors.push('Teks clue maksimal 500 karakter');

  if (errors.length) return { errors };

  return {
    errors: [],
    value: { level, minCorrect, maxCorrect, clueText },
  };
}

// Guard yang sama untuk clue: hanya boleh edit di lobby
router.get('/clues/full', authenticateAdmin, questionEditGuard, (req, res) => {
  const requestedMode = req.query.mode || game.getMode();
  if (!['simulation', 'official'].includes(requestedMode)) {
    return res.status(400).json({ error: 'Mode permainan tidak valid' });
  }

  const clues = queryAll(
    'SELECT * FROM clues WHERE mode = ? ORDER BY level, min_correct DESC',
    [requestedMode]
  );

  res.json({
    mode: requestedMode,
    locked: game.getState().phase !== 'lobby',
    clues: clues.map((c) => ({
      id: c.id,
      level: c.level,
      min_correct: c.min_correct,
      max_correct: c.max_correct,
      clue_text: c.clue_text,
    })),
  });
});

router.post('/clues', authenticateAdmin, questionEditGuard, (req, res) => {
  const { errors, value } = validateCluePayload(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const mode = game.getMode();
  const count = queryOne('SELECT COUNT(*) AS count FROM clues WHERE mode = ? AND level = ?', [mode, value.level]);
  if (count.count >= 4) {
    return res.status(400).json({ error: `Level ${value.level} sudah memiliki 4 clue (maksimal). Hapus salah satu dulu.` });
  }

  const { run, saveDb } = require('../db/db');
  const { recordAudit } = require('../services/competition');
  run(
    'INSERT INTO clues (mode, level, min_correct, max_correct, clue_text) VALUES (?, ?, ?, ?, ?)',
    [mode, value.level, value.minCorrect, value.maxCorrect, value.clueText]
  );
  saveDb();
  recordAudit({ mode, action: 'CLUE_ADDED', details: { level: value.level } });
  res.json({ ok: true });
});

router.put('/clues/:id', authenticateAdmin, questionEditGuard, (req, res) => {
  const { errors, value } = validateCluePayload(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const existing = queryOne('SELECT * FROM clues WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'Clue tidak ditemukan' });

  const { run, saveDb } = require('../db/db');
  const { recordAudit } = require('../services/competition');
  run(
    'UPDATE clues SET level = ?, min_correct = ?, max_correct = ?, clue_text = ? WHERE id = ?',
    [value.level, value.minCorrect, value.maxCorrect, value.clueText, existing.id]
  );
  saveDb();
  recordAudit({ mode: existing.mode, action: 'CLUE_UPDATED', details: { clue_id: existing.id, level: value.level } });
  res.json({ ok: true });
});

router.delete('/clues/:id', authenticateAdmin, questionEditGuard, (req, res) => {
  const existing = queryOne('SELECT * FROM clues WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'Clue tidak ditemukan' });

  const { run, saveDb } = require('../db/db');
  const { recordAudit } = require('../services/competition');
  run('DELETE FROM clues WHERE id = ?', [existing.id]);
  saveDb();
  recordAudit({ mode: existing.mode, action: 'CLUE_DELETED', details: { clue_id: existing.id, level: existing.level } });
  res.json({ ok: true });
});

// Upload gambar soal dari panel admin. Body: { extension, data_base64 }.
router.post('/questions/:id/image', authenticateAdmin, questionEditGuard, (req, res) => {
  const existing = queryOne('SELECT * FROM questions WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  const extension = String((req.body && req.body.extension) || '');
  const dataBase64 = String((req.body && req.body.data_base64) || '');
  if (!dataBase64) return res.status(400).json({ error: 'Data gambar kosong' });

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Data gambar tidak valid' });
  }
  if (!buffer.length) return res.status(400).json({ error: 'Data gambar kosong' });
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({ error: `Ukuran melebihi ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB` });
  }

  const { saveQuestionImage } = require('../services/questionImages');
  const result = saveQuestionImage(existing.mode, existing.id, extension, buffer);
  if (!result.ok) {
    return res.status(400).json({ error: 'Gambar tidak valid: ' + result.issues.join(', ') });
  }

  const { recordAudit } = require('../services/competition');
  recordAudit({ mode: existing.mode, action: 'QUESTION_IMAGE_UPLOADED', details: { question_id: existing.id, filename: result.filename } });
  res.json({ ok: true, filename: result.filename, width: result.width, height: result.height });
});

// Upload gambar untuk satu opsi (A-E). Tersimpan sebagai q_<id>_<opsi>.<ext>
// dan URL-nya ditulis ke options_json agar otomatis terkirim ke peserta.
router.post('/questions/:id/options/:optionId/image', authenticateAdmin, questionEditGuard, (req, res) => {
  const existing = queryOne('SELECT * FROM questions WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'Soal tidak ditemukan' });

  const optionId = String(req.params.optionId || '').trim().toUpperCase();
  if (!OPTION_IDS.includes(optionId)) {
    return res.status(400).json({ error: 'Opsi harus A, B, C, D, atau E' });
  }

  const extension = String((req.body && req.body.extension) || '');
  const dataBase64 = String((req.body && req.body.data_base64) || '');
  if (!dataBase64) return res.status(400).json({ error: 'Data gambar kosong' });

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Data gambar tidak valid' });
  }
  if (!buffer.length) return res.status(400).json({ error: 'Data gambar kosong' });
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({ error: `Ukuran melebihi ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB` });
  }

  const result = saveQuestionImage(existing.mode, `${existing.id}_${optionId}`, extension, buffer);
  if (!result.ok) {
    return res.status(400).json({ error: 'Gambar tidak valid: ' + result.issues.join(', ') });
  }

  // Tulis image_url ke opsi yang bersangkutan di options_json
  const options = parseOptions(existing);
  const target = options.find((option) => option.id === optionId);
  if (!target) return res.status(404).json({ error: `Opsi ${optionId} tidak ada pada soal ini` });
  target.image_url = `/uploads/questions/${existing.mode}/${result.filename}`;

  const { run, saveDb } = require('../db/db');
  const { recordAudit } = require('../services/competition');
  run('UPDATE questions SET options_json = ? WHERE id = ?', [JSON.stringify(options), existing.id]);
  saveDb();
  recordAudit({ mode: existing.mode, action: 'OPTION_IMAGE_UPLOADED', details: { question_id: existing.id, option: optionId, filename: result.filename } });
  res.json({ ok: true, filename: result.filename, image_url: target.image_url, width: result.width, height: result.height });
});

// --- Manajemen Tim & Kredensial Login ---

router.get('/teams', authenticateAdmin, (_req, res) => {
  const teams = queryAll('SELECT id, name, login_code FROM teams ORDER BY id ASC');
  const isLobby = game.getState().phase === 'lobby';
  res.json({ ok: true, teams, locked: !isLobby });
});

router.put('/teams/:id', authenticateAdmin, (req, res) => {
  if (game.getState().phase !== 'lobby') {
    return res.status(400).json({ error: 'Data tim hanya dapat diubah saat fase LOBBY' });
  }

  const teamId = Number(req.params.id);
  const existing = queryOne('SELECT id, name, login_code FROM teams WHERE id = ?', [teamId]);
  if (!existing) {
    return res.status(404).json({ error: 'Tim tidak ditemukan' });
  }

  const name = String((req.body && req.body.name) || '').trim();
  const loginCode = String((req.body && req.body.login_code) || '').trim().toUpperCase();

  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'Nama tim harus diisi (maksimal 100 karakter)' });
  }
  if (!loginCode || loginCode.length < 6 || loginCode.length > 32) {
    return res.status(400).json({ error: 'Kode login harus 6–32 karakter' });
  }
  if (!/^[A-Z0-9_-]+$/.test(loginCode)) {
    return res.status(400).json({ error: 'Kode login hanya boleh huruf, angka, tanda hubung (-), dan garis bawah (_)' });
  }

  const duplicate = queryOne('SELECT id FROM teams WHERE login_code = ? AND id != ?', [loginCode, teamId]);
  if (duplicate) {
    return res.status(400).json({ error: `Kode login "${loginCode}" sudah digunakan oleh tim lain` });
  }

  run('UPDATE teams SET name = ?, login_code = ? WHERE id = ?', [name, loginCode, teamId]);
  saveDb();

  // Sinkronkan file team-login-codes.txt
  try {
    const allTeams = queryAll('SELECT id, name, login_code FROM teams ORDER BY id ASC');
    const outputPath = path.join(__dirname, '..', '..', 'data', 'team-login-codes.txt');
    const content = allTeams.map((t) => `${t.name}: ${t.login_code}`).join('\n') + '\n';
    fs.writeFileSync(outputPath, content, 'utf8');
  } catch (err) {
    console.warn('[Admin] Gagal menulis pembaruan ke team-login-codes.txt:', err.message);
  }

  const { recordAudit } = require('../services/competition');
  recordAudit({
    mode: game.getMode(),
    action: 'TEAM_UPDATED',
    details: { team_id: teamId, old_name: existing.name, new_name: name, old_code: existing.login_code, new_code: loginCode },
  });

  res.json({ ok: true, team: { id: teamId, name, login_code: loginCode } });
});

router.post('/teams/regenerate-codes', authenticateAdmin, (req, res) => {
  if (game.getState().phase !== 'lobby') {
    return res.status(400).json({ error: 'Kode login hanya dapat diacak ulang saat fase LOBBY' });
  }

  const teams = queryAll('SELECT id, name FROM teams ORDER BY id ASC');
  if (!teams.length) {
    return res.status(400).json({ error: 'Tidak ada data tim' });
  }

  const db = getDb();
  const generatedCodes = new Set();
  while (generatedCodes.size < teams.length) {
    const code = crypto.randomBytes(6).toString('base64url').toUpperCase().slice(0, 8);
    generatedCodes.add(code);
  }
  const codesArray = Array.from(generatedCodes);

  const updateTeam = db.prepare('UPDATE teams SET login_code = ? WHERE id = ?');
  teams.forEach((t, i) => updateTeam.run([codesArray[i], t.id]));
  updateTeam.free();
  saveDb();

  // Tulis ke team-login-codes.txt
  try {
    const outputPath = path.join(__dirname, '..', '..', 'data', 'team-login-codes.txt');
    const content = teams.map((t, i) => `${t.name}: ${codesArray[i]}`).join('\n') + '\n';
    fs.writeFileSync(outputPath, content, 'utf8');
  } catch (err) {
    console.warn('[Admin] Gagal menulis pembaruan ke team-login-codes.txt:', err.message);
  }

  const { recordAudit } = require('../services/competition');
  recordAudit({
    mode: game.getMode(),
    action: 'TEAM_CODES_REGENERATED',
    details: { count: teams.length },
  });

  res.json({ ok: true, message: 'Kode login semua tim berhasil diacak ulang' });
});

router.post('/reset', authenticateAdmin, (req, res) => {
  const { stopTimer } = require('../services/timer');
  stopTimer();
  const result = game.resetMode(game.getMode());

  const io = req.app.get('io');
  io.emit('phase:changed', { phase: 'lobby', mode: game.getMode() });

  res.json(result);
});

// Validasi kode verifikasi tim (HMAC-SHA256): POST /api/admin/verify-code
router.post('/verify-code', authenticateAdmin, (req, res) => {
  const code = String((req.body && req.body.code) || '').trim().toUpperCase();
  if (!code || code.length !== 8) {
    return res.status(400).json({ error: 'Kode verifikasi harus terdiri dari 8 karakter alfanumerik' });
  }

  const { generateVerificationCode } = require('../services/verify');
  const { getScoreBreakdown } = require('../services/scoring');
  const teams = queryAll('SELECT id, name FROM teams ORDER BY id ASC');
  const modes = ['simulation', 'official'];

  for (const mode of modes) {
    for (const team of teams) {
      const breakdown = getScoreBreakdown(team.id, mode);
      const expectedCode = generateVerificationCode(team.id, team.name, breakdown);
      if (expectedCode === code) {
        const totalScore = breakdown.level_1.score + breakdown.level_2.score + breakdown.level_3.score + (breakdown.final_resolution ? breakdown.final_resolution.bonus : 0);
        return res.json({
          ok: true,
          matched: true,
          team: {
            id: team.id,
            name: team.name,
          },
          mode,
          code: expectedCode,
          total_score: totalScore,
          breakdown,
        });
      }
    }
  }

  return res.json({
    ok: true,
    matched: false,
    code,
    message: 'Kode verifikasi tidak cocok dengan data tim atau skor manapun di sistem.',
  });
});

module.exports = router;
