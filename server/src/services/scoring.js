const { queryAll, queryOne } = require('../db/db');
const { getStatusMap, getPlayoffOrderMap } = require('./competition');

function getCurrentMode() {
  const state = queryOne('SELECT mode FROM game_state WHERE id = 1');
  return state && state.mode ? state.mode : 'simulation';
}

function getTeamScore(teamId, mode = getCurrentMode()) {
  const math = queryOne(
    'SELECT COALESCE(SUM(score), 0) as math_score FROM level_results WHERE team_id = ? AND mode = ?',
    [teamId, mode]
  );
  const resolution = queryOne(
    'SELECT COALESCE(bonus_points, 0) as bonus FROM final_resolutions WHERE team_id = ? AND mode = ?',
    [teamId, mode]
  );

  const mathScore = math ? Number(math.math_score) : 0;
  const bonus = resolution ? Number(resolution.bonus) : 0;

  return {
    team_id: teamId,
    math_score: mathScore,
    bonus,
    total: mathScore + bonus,
  };
}

function getLevelStats(teamId, mode, level) {
  const result = queryOne(
    `SELECT score, correct_count, wrong_count, unanswered_count, finalized_at
     FROM level_results WHERE team_id = ? AND mode = ? AND level = ?`,
    [teamId, mode, level]
  );

  return result || {
    score: 0,
    correct_count: 0,
    wrong_count: 0,
    unanswered_count: 0,
    finalized_at: null,
  };
}

function getCompletionTime(teamId, mode) {
  const resolution = queryOne(
    "SELECT strftime('%s', submitted_at) as completion_time FROM final_resolutions WHERE team_id = ? AND mode = ?",
    [teamId, mode]
  );
  return resolution && resolution.completion_time !== null
    ? Number(resolution.completion_time)
    : null;
}

function getTieKey(score) {
  return [score.total, score.correct_count, score.l3_correct, score.completion_time]
    .map((value) => value === null ? 'null' : String(value))
    .join('|');
}

function compareBase(a, b) {
  if (b.total !== a.total) return b.total - a.total;
  if (b.correct_count !== a.correct_count) return b.correct_count - a.correct_count;
  if (b.l3_correct !== a.l3_correct) return b.l3_correct - a.l3_correct;
  if (a.completion_time === null && b.completion_time !== null) return 1;
  if (a.completion_time !== null && b.completion_time === null) return -1;
  if (a.completion_time !== null && b.completion_time !== null
    && a.completion_time !== b.completion_time) {
    return a.completion_time - b.completion_time;
  }
  return 0;
}

function compareScores(a, b) {
  if (a.status === 'DISQUALIFIED' && b.status !== 'DISQUALIFIED') return 1;
  if (a.status !== 'DISQUALIFIED' && b.status === 'DISQUALIFIED') return -1;

  const base = compareBase(a, b);
  if (base !== 0) return base;

  if (a.playoff_order !== null && b.playoff_order !== null
    && a.playoff_order !== b.playoff_order) {
    return a.playoff_order - b.playoff_order;
  }
  return 0;
}

function hasResolvedPlayoff(a, b) {
  return a.tie_key === b.tie_key
    && a.playoff_order !== null
    && b.playoff_order !== null
    && a.playoff_group === b.playoff_group;
}

function getLeaderboard(mode = getCurrentMode()) {
  const teams = queryAll('SELECT id, name FROM teams');
  const gameState = queryOne('SELECT phase FROM game_state WHERE id = 1');
  const rankingFinalized = gameState && gameState.phase === 'finished';
  const statuses = getStatusMap(mode);
  const playoffOrders = getPlayoffOrderMap(mode);

  const scores = teams.map((team) => {
    const score = getTeamScore(team.id, mode);
    const l1 = getLevelStats(team.id, mode, 1);
    const l2 = getLevelStats(team.id, mode, 2);
    const l3 = getLevelStats(team.id, mode, 3);
    const completionTime = getCompletionTime(team.id, mode);
    const status = statuses.get(Number(team.id)) || { status: 'ACTIVE', reason: null };
    const playoff = playoffOrders.get(Number(team.id)) || null;

    const row = {
      team_id: Number(team.id),
      name: team.name,
      math_score: score.math_score,
      bonus: score.bonus,
      total: score.total,
      correct_count: Number(l1.correct_count) + Number(l2.correct_count) + Number(l3.correct_count),
      l1_correct: Number(l1.correct_count),
      l2_correct: Number(l2.correct_count),
      l3_correct: Number(l3.correct_count),
      completion_time: completionTime,
      status: status.status,
      disqualification_reason: status.reason,
      playoff_group: playoff ? playoff.playoff_group : null,
      playoff_order: playoff ? Number(playoff.position) : null,
    };
    row.tie_key = getTieKey(row);
    return row;
  });

  scores.sort(compareScores);

  let activeRank = 0;
  return scores.map((score, index) => {
    const previous = scores[index - 1];
    const next = scores[index + 1];
    const tiedWithPrevious = previous
      && previous.status !== 'DISQUALIFIED'
      && score.status !== 'DISQUALIFIED'
      && previous.tie_key === score.tie_key
      && !hasResolvedPlayoff(previous, score);
    const tiedWithNext = next
      && next.status !== 'DISQUALIFIED'
      && score.status !== 'DISQUALIFIED'
      && next.tie_key === score.tie_key
      && !hasResolvedPlayoff(score, next);
    const tied = rankingFinalized && Boolean(tiedWithPrevious || tiedWithNext);

    if (score.status !== 'DISQUALIFIED') activeRank += 1;

    return {
      ...score,
      rank: score.status === 'DISQUALIFIED' ? null : activeRank,
      tied,
      status: score.status === 'DISQUALIFIED'
        ? 'DISQUALIFIED'
        : tied ? 'TIED' : 'ACTIVE',
      qualified: score.status !== 'DISQUALIFIED' && !tied && activeRank <= 5,
    };
  });
}

function getScoreBreakdown(teamId, mode = getCurrentMode()) {
  const l1 = getLevelStats(teamId, mode, 1);
  const l2 = getLevelStats(teamId, mode, 2);
  const l3 = getLevelStats(teamId, mode, 3);
  const res = queryOne(
    'SELECT bonus_points, chosen_candidate, is_correct FROM final_resolutions WHERE team_id = ? AND mode = ?',
    [teamId, mode]
  );
  const status = queryOne(
    'SELECT status, reason FROM team_competition_status WHERE team_id = ? AND mode = ?',
    [teamId, mode]
  );

  function breakdown(level) {
    return {
      score: Number(level.score) || 0,
      total_questions: Number(level.correct_count) + Number(level.wrong_count) + Number(level.unanswered_count),
      correct: Number(level.correct_count),
      wrong: Number(level.wrong_count),
      unanswered: Number(level.unanswered_count),
    };
  }

  return {
    status: status ? status.status : 'ACTIVE',
    disqualification_reason: status ? status.reason : null,
    level_1: breakdown(l1),
    level_2: breakdown(l2),
    level_3: breakdown(l3),
    final_resolution: res ? {
      bonus: res.bonus_points,
      chosen: res.chosen_candidate,
      is_correct: res.is_correct,
    } : null,
  };
}

module.exports = {
  getTeamScore,
  getLeaderboard,
  getScoreBreakdown,
  getTieKey,
};
