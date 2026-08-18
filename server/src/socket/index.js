const { queryOne } = require('../db/db');
const { unlockCluesForTeams } = require('../services/clues');
const { getLeaderboard } = require('../services/scoring');
const game = require('../services/game');
const { getTeamIdFromToken } = require('../middleware/auth');

const teamSockets = new Map();

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on('auth', ({ team_id, token }) => {
      if (!team_id || !token) {
        socket.emit('auth:error', { error: 'Invalid auth data' });
        return;
      }

      const authenticatedTeamId = getTeamIdFromToken(token);
      if (authenticatedTeamId !== Number(team_id)) {
        socket.emit('auth:error', { error: 'Token tim tidak valid' });
        return;
      }

      const team = queryOne('SELECT id, name FROM teams WHERE id = ?', [authenticatedTeamId]);
      if (!team) {
        socket.emit('auth:error', { error: 'Team not found' });
        return;
      }

      const normalizedTeamId = Number(team_id);
      const existing = teamSockets.get(normalizedTeamId);
      if (existing && existing !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existing);
        if (oldSocket) {
          oldSocket.emit('auth:kick', { message: 'Akun ini login dari perangkat lain' });
          oldSocket.disconnect(true);
        }
      }

      socket.team_id = normalizedTeamId;
      socket.team_name = team.name;
      teamSockets.set(normalizedTeamId, socket.id);

      const state = game.getState();
      socket.emit('auth:success', {
        team_id: normalizedTeamId,
        name: team.name,
        phase: state.phase,
        mode: state.mode,
        remaining_seconds: game.getRemainingSeconds(),
        total_seconds: state.level_duration_seconds || 0,
      });
      console.log(`[Socket] Team authenticated: ${team.name} (ID: ${team_id})`);

      io.emit('team:connected', { team_id: normalizedTeamId, name: team.name });
    });

    socket.on('disconnect', () => {
      if (socket.team_id) {
        if (teamSockets.get(socket.team_id) === socket.id) {
          teamSockets.delete(socket.team_id);
        }
        console.log(`[Socket] Team disconnected: ${socket.team_name || socket.team_id}`);
        io.emit('team:disconnected', { team_id: socket.team_id });
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  const origEmit = io.emit.bind(io);
  io.emit = function (event, data) {
    if (event === 'phase:changed' && data && data.phase) {
      const phase = data.phase;
      const ln = { clue_1: 1, clue_2: 2, clue_3: 3 };
      const mode = data.mode || game.getMode();
      if (ln[phase]) {
        unlockCluesForTeams(io, ln[phase], mode);
      }
      if (phase === 'finished') {
        const lb = getLeaderboard(mode);
        io.emit('leaderboard:update', { leaderboard: lb });
      }
    }

    if (event === 'score:updated') {
      const lb = getLeaderboard(data && data.mode ? data.mode : game.getMode());
      io.emit('leaderboard:update', { leaderboard: lb });
    }

    return origEmit(event, data);
  };
}

function getTeamSockets() {
  return teamSockets;
}

module.exports = setupSocket;
module.exports.getTeamSockets = getTeamSockets;
