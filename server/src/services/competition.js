const { getDb, queryAll, queryOne, saveDb } = require('../db/db');

function parseDetails(row) {
  try {
    return JSON.parse(row.details_json || '{}');
  } catch (_) {
    return {};
  }
}

function getTeamStatus(teamId, mode) {
  const row = queryOne(
    'SELECT status, reason, updated_at FROM team_competition_status WHERE team_id = ? AND mode = ?',
    [teamId, mode]
  );
  return row || { status: 'ACTIVE', reason: null, updated_at: null };
}

function isDisqualified(teamId, mode) {
  return getTeamStatus(teamId, mode).status === 'DISQUALIFIED';
}

function getStatusMap(mode) {
  const rows = queryAll(
    'SELECT team_id, status, reason, updated_at FROM team_competition_status WHERE mode = ?',
    [mode]
  );
  return new Map(rows.map((row) => [Number(row.team_id), row]));
}

function getPlayoffOrderMap(mode) {
  const rows = queryAll(
    'SELECT team_id, playoff_group, position FROM playoff_results WHERE mode = ?',
    [mode]
  );
  return new Map(rows.map((row) => [Number(row.team_id), row]));
}

function recordAudit({ mode, action, teamId = null, details = {}, actorType = 'admin', actorId = null }) {
  const db = getDb();
  db.run(
    `INSERT INTO audit_log
      (mode, actor_type, actor_id, action, team_id, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [mode, actorType, actorId, action, teamId, JSON.stringify(details)]
  );
  saveDb();
}

function setTeamStatus(teamId, mode, status, reason = null, audit = true) {
  const db = getDb();
  const existing = queryOne(
    'SELECT id FROM team_competition_status WHERE team_id = ? AND mode = ?',
    [teamId, mode]
  );

  if (existing) {
    db.run(
      `UPDATE team_competition_status
       SET status = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, reason, existing.id]
    );
  } else {
    db.run(
      `INSERT INTO team_competition_status (team_id, mode, status, reason)
       VALUES (?, ?, ?, ?)`,
      [teamId, mode, status, reason]
    );
  }
  saveDb();

  if (audit) {
    recordAudit({
      mode,
      action: status === 'DISQUALIFIED' ? 'TEAM_DISQUALIFIED' : 'TEAM_REINSTATED',
      teamId,
      details: { status, reason },
    });
  }
}

function recordPlayoff(mode, orderedTeamIds, notes = '') {
  const group = `playoff-${Date.now()}`;
  const db = getDb();

  orderedTeamIds.forEach((teamId, index) => {
    db.run(
      `INSERT OR REPLACE INTO playoff_results
       (team_id, mode, playoff_group, position, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [teamId, mode, group, index + 1, notes || null]
    );
  });
  saveDb();

  recordAudit({
    mode,
    action: 'PLAYOFF_RECORDED',
    details: {
      playoff_group: group,
      ordered_team_ids: orderedTeamIds,
      notes,
    },
  });

  return { group, ordered_team_ids: orderedTeamIds, notes };
}

function getAuditLog(mode, limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return queryAll(
    `SELECT id, mode, actor_type, actor_id, action, team_id, details_json, created_at
     FROM audit_log WHERE mode = ? ORDER BY id DESC LIMIT ${safeLimit}`,
    [mode]
  ).map((row) => ({
    id: row.id,
    mode: row.mode,
    actor_type: row.actor_type,
    actor_id: row.actor_id,
    action: row.action,
    team_id: row.team_id === null ? null : Number(row.team_id),
    details: parseDetails(row),
    created_at: row.created_at,
  }));
}

module.exports = {
  getTeamStatus,
  getStatusMap,
  getPlayoffOrderMap,
  isDisqualified,
  recordAudit,
  setTeamStatus,
  recordPlayoff,
  getAuditLog,
};
