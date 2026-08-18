const crypto = require('crypto');
const { queryOne } = require('../db/db');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const teamSessions = new Map();
const teamTokens = new Map();
const adminSessions = new Map();

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function issueTeamToken(teamId) {
  const previousToken = teamTokens.get(teamId);
  if (previousToken) teamSessions.delete(previousToken);

  const token = createToken();
  const session = { teamId: Number(teamId), createdAt: Date.now() };
  teamSessions.set(token, session);
  teamTokens.set(Number(teamId), token);
  return token;
}

function getTeamIdFromToken(token) {
  if (!token || typeof token !== 'string') return null;

  const session = teamSessions.get(token);
  if (!session) return null;

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    teamSessions.delete(token);
    if (teamTokens.get(session.teamId) === token) teamTokens.delete(session.teamId);
    return null;
  }

  return session.teamId;
}

function authenticateTeam(req, res, next) {
  const teamId = Number(req.get('X-Team-Id'));
  const token = req.get('X-Team-Token');
  const tokenTeamId = getTeamIdFromToken(token);

  if (!Number.isInteger(teamId) || teamId < 1 || tokenTeamId !== teamId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const team = queryOne('SELECT id, name, login_code FROM teams WHERE id = ?', [teamId]);
  if (!team) {
    return res.status(401).json({ error: 'Team tidak ditemukan' });
  }

  req.team = team;
  next();
}

function issueAdminToken() {
  const token = createToken();
  adminSessions.set(token, { createdAt: Date.now() });
  return token;
}

function authenticateAdmin(req, res, next) {
  const token = req.get('X-Admin-Token');
  const session = token ? adminSessions.get(token) : null;

  if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
    if (token) adminSessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = {
  authenticateAdmin,
  authenticateTeam,
  getTeamIdFromToken,
  issueAdminToken,
  issueTeamToken,
};
