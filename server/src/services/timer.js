let timerInterval = null;

const TIMED_PHASES = [
  'case_file', 'level_1', 'clue_1', 'level_2',
  'clue_2', 'level_3', 'clue_3', 'resolution',
];

function getNextPhase(phase) {
  const next = {
    case_file: 'level_1',
    level_1: 'clue_1',
    clue_1: 'level_2',
    level_2: 'clue_2',
    clue_2: 'level_3',
    level_3: 'clue_3',
    clue_3: 'resolution',
    resolution: 'finished',
  };
  return next[phase] || null;
}

function startTimer(io, onExpire) {
  stopTimer();

  timerInterval = setInterval(() => {
    const game = require('./game');
    const state = game.getState();
    if (!state || !TIMED_PHASES.includes(state.phase)) {
      stopTimer();
      return;
    }

    const remaining = game.getRemainingSeconds();
    if (remaining <= 0) {
      const completedPhase = state.phase;
      const nextPhase = getNextPhase(completedPhase);
      io.emit('timer:expired', { phase: completedPhase, mode: state.mode });

      if (['level_1', 'level_2', 'level_3'].includes(completedPhase)) {
        const { finalizeLevelForAllTeams } = require('./levelAnswers');
        finalizeLevelForAllTeams(state.mode, Number(completedPhase.replace('level_', '')));
      }

      if (nextPhase) {
        game.transition(nextPhase);
        io.emit('phase:changed', { phase: nextPhase, mode: game.getMode() });

        if (['level_1', 'level_2', 'level_3'].includes(completedPhase)) {
          const { getLeaderboard } = require('./scoring');
          io.emit('leaderboard:update', { leaderboard: getLeaderboard(state.mode) });
        }
      }

      stopTimer();
      if (nextPhase && TIMED_PHASES.includes(nextPhase)) {
        startTimer(io, onExpire);
      }
      if (onExpire) onExpire(completedPhase, nextPhase);
      return;
    }

    io.emit('timer:tick', {
      phase: state.phase,
      mode: state.mode,
      remaining_seconds: remaining,
      total_seconds: state.level_duration_seconds || 0,
    });
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function isRunning() {
  return timerInterval !== null;
}

module.exports = { startTimer, stopTimer, isRunning, TIMED_PHASES };
