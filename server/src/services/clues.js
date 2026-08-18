const { queryAll, queryOne, run } = require('../db/db');

function unlockCluesForTeams(io, levelNumber, mode = 'simulation') {
  const teams = queryAll('SELECT id, name FROM teams');

  teams.forEach((team) => {
    const levelResult = queryOne(
      'SELECT correct_count FROM level_results WHERE team_id = ? AND mode = ? AND level = ?',
      [team.id, mode, levelNumber]
    );
    const count = levelResult ? levelResult.correct_count : 0;

    const clue = queryOne(
      'SELECT id, clue_text FROM clues WHERE mode = ? AND level = ? AND min_correct <= ? AND max_correct >= ?',
      [mode, levelNumber, count, count]
    );

    if (clue) {
      const existing = queryOne(
        'SELECT id FROM clues_unlocked WHERE team_id = ? AND clue_id = ? AND mode = ?',
        [team.id, clue.id, mode]
      );

      if (!existing) {
        run('INSERT INTO clues_unlocked (team_id, clue_id, mode) VALUES (?, ?, ?)', [team.id, clue.id, mode]);
      }

      io.emit('clue:unlocked', {
        team_id: team.id,
        team_name: team.name,
        level: levelNumber,
        mode,
        clue_id: clue.id,
        clue_text: clue.clue_text,
        correct_count: count,
      });
    }
  });
}

function getTeamClues(teamId, mode = 'simulation') {
  return queryAll(
    `SELECT c.id, c.level, c.clue_text, cu.unlocked_at
     FROM clues c
     JOIN clues_unlocked cu ON c.id = cu.clue_id
     WHERE cu.team_id = ? AND c.mode = ? AND cu.mode = ?
     ORDER BY c.level, c.id`,
    [teamId, mode, mode]
  );
}

module.exports = { unlockCluesForTeams, getTeamClues };
