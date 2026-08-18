const express = require('express');
const router = express.Router();
const { queryAll, queryOne, saveDb } = require('../db/db');
const game = require('../services/game');
const { authenticateTeam } = require('../middleware/auth');
const { getQuestionImageMap } = require('../services/questionImages');
const {
  parseOptions,
  getLevelQuestions,
  getDraft,
  getResult,
  saveDraft,
} = require('../services/levelAnswers');
const { isDisqualified } = require('../services/competition');

function getTeamId(req) {
  return req.team ? req.team.id : null;
}

function ensureQuestionOrder(teamId, mode, level) {
  const existing = queryAll(
    `SELECT tqo.question_id, tqo.display_order
     FROM team_question_order tqo
     JOIN questions q ON tqo.question_id = q.id
     WHERE tqo.team_id = ? AND tqo.mode = ? AND q.level = ? AND q.mode = ?`,
    [teamId, mode, level, mode]
  );
  if (existing.length > 0) return;

  const qRows = queryAll('SELECT id FROM questions WHERE level = ? AND mode = ?', [level, mode]);
  for (let i = qRows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [qRows[i], qRows[j]] = [qRows[j], qRows[i]];
  }

  const sqlDb = require('../db/db').getDb();
  const stmt = sqlDb.prepare(
    'INSERT OR IGNORE INTO team_question_order (team_id, question_id, mode, display_order) VALUES (?, ?, ?, ?)'
  );
  qRows.forEach((q, i) => stmt.run([teamId, q.id, mode, i + 1]));
  stmt.free();
  saveDb();
}

router.get('/questions', authenticateTeam, (req, res) => {
  const teamId = getTeamId(req);
  if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

  const state = game.getState();
  const mode = state.mode;
  const level = game.getLevelForPhase(state.phase);
  if (!level) return res.status(400).json({ error: 'Not in a question level' });

  ensureQuestionOrder(teamId, mode, level);
  const questions = getLevelQuestions(teamId, mode, level);
  const draft = getDraft(teamId, mode, level);
  const result = getResult(teamId, mode, level);
  const imageMap = getQuestionImageMap(mode);

  return res.json({
    level,
    mode,
    finalized: Boolean(result),
    draft_updated_at: draft.updated_at,
    remaining_seconds: game.getRemainingSeconds(),
    questions: questions.map((q) => ({
      id: q.id,
      topic: q.topic,
      question_text: q.question_text,
      image_url: imageMap[String(q.id)] || null,
      points: q.points,
      display_order: q.display_order,
      options: parseOptions(q),
      selected_option: result
        ? result.answers[String(q.id)] || null
        : draft.answers[String(q.id)] || null,
    })),
  });
});

router.post('/level-draft', authenticateTeam, (req, res) => {
  const teamId = getTeamId(req);
  if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

  const state = game.getState();
  const mode = state.mode;
  const level = game.getLevelForPhase(state.phase);
  if (!level) return res.status(400).json({ error: 'Not in an active level' });
  if (isDisqualified(teamId, mode)) {
    return res.status(403).json({ error: 'Tim telah didiskualifikasi oleh panitia' });
  }
  if (game.isTimerExpired()) return res.status(400).json({ error: 'Waktu habis' });

  const result = saveDraft(teamId, mode, level, req.body ? req.body.answers : null);
  if (!result.ok) return res.status(400).json({ error: result.error });

  return res.json({
    ok: true,
    level,
    mode,
    answers: result.answers,
    selected_count: result.selected_count,
    total_questions: result.total_questions,
    remaining_seconds: game.getRemainingSeconds(),
  });
});

router.post('/submit-resolution', authenticateTeam, (req, res) => {
  const teamId = getTeamId(req);
  if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

  const state = game.getState();
  const mode = state.mode;
  if (state.phase !== 'resolution') {
    return res.status(400).json({ error: 'Not in resolution phase' });
  }
  if (isDisqualified(teamId, mode)) {
    return res.status(403).json({ error: 'Tim telah didiskualifikasi oleh panitia' });
  }

  if (game.isTimerExpired()) {
    return res.status(400).json({ error: 'Waktu habis' });
  }

  const existing = queryOne('SELECT id FROM final_resolutions WHERE team_id = ? AND mode = ?', [teamId, mode]);
  if (existing) {
    return res.status(400).json({ error: 'Kamu sudah memilih kandidat' });
  }

  const { candidate } = req.body;
  if (!candidate) {
    return res.status(400).json({ error: 'Pilih kandidat terlebih dahulu' });
  }

  const config = require('../config');
  const validCandidates = config.CHAMPION_CANDIDATES.map((item) => item.id);
  if (!validCandidates.includes(candidate)) {
    return res.status(400).json({ error: 'Kandidat tidak valid' });
  }
  const isCorrect = candidate === config.CORRECT_CHAMPION;
  const bonus = isCorrect ? 30 : 0;

  require('../db/db').run(
    'INSERT INTO final_resolutions (team_id, mode, chosen_candidate, is_correct, bonus_points) VALUES (?, ?, ?, ?, ?)',
    [teamId, mode, candidate, isCorrect ? 1 : 0, bonus]
  );

  const io = req.app.get('io');
  if (io) {
    const teamName = queryOne('SELECT name FROM teams WHERE id = ?', [teamId]);
    io.emit('score:updated', {
      team_id: teamId,
      team_name: teamName ? teamName.name : '',
      is_correct: isCorrect,
      bonus,
      mode,
    });
  }

  res.json({ is_correct: isCorrect, bonus_points: bonus });
});

router.get('/clues', authenticateTeam, (req, res) => {
  const teamId = getTeamId(req);
  if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

  const { getTeamClues } = require('../services/clues');
  const clues = getTeamClues(teamId, game.getMode());
  res.json({ mode: game.getMode(), clues });
});

router.get('/results', authenticateTeam, (req, res) => {
  const teamId = getTeamId(req);
  if (!teamId) return res.status(401).json({ error: 'Unauthorized' });

  const { getScoreBreakdown } = require('../services/scoring');
  const breakdown = getScoreBreakdown(teamId, game.getMode());
  const team = queryOne('SELECT name FROM teams WHERE id = ?', [teamId]);
  const { generateVerificationCode } = require('../services/verify');

  const verifCode = generateVerificationCode(teamId, team.name, breakdown);

  res.json({
    team_id: teamId,
    team_name: team.name,
    mode: game.getMode(),
    breakdown,
    verification_code: verifCode,
  });
});

router.get('/leaderboard', (_req, res) => {
  const { getLeaderboard } = require('../services/scoring');
  const lb = getLeaderboard(game.getMode());
  res.json({ leaderboard: lb });
});

router.get('/state', (_req, res) => {
  const state = game.getState();
  const remaining = game.getRemainingSeconds();
  res.json({
    phase: state.phase,
    mode: state.mode,
    remaining_seconds: remaining,
    total_seconds: state.level_duration_seconds || 0,
  });
});

module.exports = router;
