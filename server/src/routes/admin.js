const express = require('express');
const router = express.Router();
const game = require('../services/game');
const { startTimer } = require('../services/timer');
const { authenticateAdmin, issueAdminToken } = require('../middleware/auth');
const { queryAll, queryOne } = require('../db/db');
const {
  getQuestionImageReport,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
} = require('../services/questionImages');
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

router.post('/reset', authenticateAdmin, (req, res) => {
  const { stopTimer } = require('../services/timer');
  stopTimer();
  const result = game.resetMode(game.getMode());

  const io = req.app.get('io');
  io.emit('phase:changed', { phase: 'lobby', mode: game.getMode() });

  res.json(result);
});

module.exports = router;
