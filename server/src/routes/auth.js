const express = require('express');
const router = express.Router();
const { queryOne } = require('../db/db');
const { issueTeamToken } = require('../middleware/auth');

const attempts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 8;

function loginRateLimit(req, res, next) {
  const submittedCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : 'invalid';
  const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${submittedCode}`;
  const now = Date.now();
  const current = attempts.get(key);
  const entry = !current || now - current.startedAt >= WINDOW_MS
    ? { startedAt: now, count: 0 }
    : current;
  entry.count += 1;
  attempts.set(key, entry);
  if (entry.count > MAX_ATTEMPTS) {
    res.set('Retry-After', String(Math.ceil((WINDOW_MS - (now - entry.startedAt)) / 1000)));
    return res.status(429).json({ error: 'Terlalu banyak percobaan login. Coba lagi nanti.' });
  }
  next();
}

router.post('/login', loginRateLimit, (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Kode tim diperlukan' });
  }

  const cleanCode = code.trim().toUpperCase();
  const team = queryOne('SELECT id, name, login_code FROM teams WHERE login_code = ?', [cleanCode]);

  if (!team) {
    return res.status(401).json({ error: 'Kode tim tidak valid' });
  }

  const token = issueTeamToken(team.id);

  return res.json({
    team_id: team.id,
    name: team.name,
    token: token,
  });
});

module.exports = router;
