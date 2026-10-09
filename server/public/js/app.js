let teamInfo = {};
let currentView = null;
let gameView = null;
let investigationView = null;
let resolutionView = null;
let resultsView = null;
let leaderboardView = null;

function teamApiHeaders(extra = {}) {
  return {
    ...extra,
    'X-Team-Id': teamInfo.id,
    'X-Team-Token': teamInfo.token,
  };
}

function updateModeBadge(mode) {
  const badge = document.getElementById('header-mode-badge');
  if (!badge || !mode) return;
  badge.textContent = mode === 'official' ? 'RESMI' : 'SIMULASI';
  badge.classList.remove('hidden');
}

function restoreTeamSession() {
  try {
    const raw = localStorage.getItem('code-cracker-team-session');
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || !saved.id || !saved.token) return false;
    teamInfo.id = saved.id;
    teamInfo.name = saved.name;
    teamInfo.code = saved.code;
    teamInfo.token = saved.token;
    document.getElementById('header-team-name').textContent = saved.name;
    document.getElementById('header-team-badge').classList.remove('hidden');
    document.getElementById('waiting-team-label').textContent = `Tim: ${saved.name}`;
    const input = document.getElementById('login-code');
    if (input && saved.code) input.value = saved.code;
    return true;
  } catch (_) {
    return false;
  }
}

function clearTeamSession() {
  teamInfo = {};
  try {
    localStorage.removeItem('code-cracker-team-session');
  } catch (_) {
    // Ignore storage failures.
  }
}

function showView(viewName) {
  if (currentView === viewName) return;

  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));

  const target = document.getElementById(`view-${viewName}`);
  if (target) {
    target.classList.remove('hidden');
    currentView = viewName;
  }

  document.getElementById('header-timer').classList.add('hidden');

  if (viewName === 'game' && gameView) gameView.loadQuestions();
  if (viewName === 'investigation' && investigationView) investigationView.loadClues();
  if (viewName === 'resolution' && resolutionView) resolutionView.loadCandidates();
  if (viewName === 'results' && resultsView) resultsView.loadResults();
  if (viewName === 'leaderboard') {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => leaderboardView.update(data));
  }
}

function phaseToView(phase) {
  const map = {
    lobby: 'waiting',
    case_file: 'case-file',
    level_1: 'game',
    level_2: 'game',
    level_3: 'game',
    clue_1: 'investigation',
    clue_2: 'investigation',
    clue_3: 'investigation',
    resolution: 'resolution',
    finished: 'results',
  };
  return map[phase] || 'login';
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isAdmin = urlParams.get('admin') === '1';
  const isLeaderboard = urlParams.get('screen') === 'leaderboard';
  const isMc = urlParams.get('screen') === 'mc' || urlParams.get('screen') === 'slides';

  if (isMc) {
    window.location.replace('/mc');
    return;
  }

  if (isLeaderboard) {
    document.body.classList.add('leaderboard-screen');
    leaderboardView = initLeaderboardView();
    connectSocket();
    showView('leaderboard');

    function loadLeaderboardState() {
      fetch('/api/state')
        .then((r) => r.json())
        .then((data) => leaderboardView.updateState(data));
    }

    loadLeaderboardState();
    on('phase:changed', loadLeaderboardState);
    on('mode:changed', loadLeaderboardState);
    return;
  }

  if (isAdmin) {
    initAdminView();
    connectSocket();
    showView('admin');
    return;
  }

  connectSocket();

  const restoredSession = restoreTeamSession();

  document.addEventListener('socket:connected', () => {
    if (!teamInfo.id) showView('login');
  });

  initLogin(teamInfo, () => {
    showView('waiting');
  });

  gameView = initGameView();
  investigationView = initInvestigationView();
  resolutionView = initResolutionView();
  resultsView = initResultsView();
  leaderboardView = initLeaderboardView();

  on('auth:success', (data) => {
    updateModeBadge(data.mode);
    if (data.is_resuming && data.countdown_seconds > 0) {
      setParticipantResumingState(data.countdown_seconds);
    } else {
      setParticipantPauseState(Boolean(data.is_paused));
    }
    if (data.phase && data.phase !== 'lobby') {
      const viewName = phaseToView(data.phase);
      showView(viewName);
    } else {
      showView('waiting');
    }
  });

  on('auth:error', (data) => {
    clearTeamSession();
    showView('login');
    const error = document.getElementById('login-error');
    if (error) {
      error.textContent = data && data.error
        ? `${data.error}. Masukkan kembali kode tim untuk melanjutkan.`
        : 'Sesi tidak dapat dipulihkan. Masukkan kembali kode tim.';
      error.classList.remove('hidden');
    }
  });

  if (restoredSession) {
    emit('auth', { team_id: teamInfo.id, token: teamInfo.token });
  }

  on('auth:kick', (data) => {
    clearTeamSession();
    alert(data.message);
    location.reload();
  });

  on('phase:changed', (data) => {
    updateModeBadge(data.mode);
    setParticipantPauseState(Boolean(data.is_paused));
    const viewName = phaseToView(data.phase);
    if (!teamInfo.id) {
      showView('login');
      return;
    }
    if (currentView === viewName && viewName === 'game' && gameView) {
      gameView.loadQuestions();
    } else {
      showView(viewName);
    }
  });

  on('mode:changed', (data) => updateModeBadge(data.mode));

  function setParticipantResumingState(countdown) {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminScreen = urlParams.get('admin') === '1' || urlParams.get('screen') === 'admin';
    const isLeaderboardScreen = urlParams.get('screen') === 'leaderboard';
    if (isAdminScreen || isLeaderboardScreen) {
      return;
    }

    const overlay = document.getElementById('participant-pause-overlay');
    const pausedCard = document.getElementById('pause-card-paused');
    const resumingCard = document.getElementById('pause-card-resuming');
    const countdownNum = document.getElementById('pause-countdown-number');
    const countdownBar = document.getElementById('pause-countdown-bar');

    if (overlay) {
      overlay.classList.remove('hidden');
      document.body.classList.add('competition-paused');
    }
    if (pausedCard) pausedCard.classList.add('hidden');
    if (resumingCard) resumingCard.classList.remove('hidden');

    if (countdownNum) {
      countdownNum.textContent = countdown;
      countdownNum.classList.remove('countdown-animate');
      void countdownNum.offsetWidth;
      countdownNum.classList.add('countdown-animate');
    }

    if (countdownBar) {
      const pct = Math.max(0, Math.min(100, (countdown / 5) * 100));
      countdownBar.style.width = pct + '%';
    }

    const interactiveElements = document.querySelectorAll(
      '#app-main button, #app-main input, #app-main textarea, #app-main select, .nav-tab, .candidate-btn, #btn-prev-question, #btn-next-question, .question-nav-btn, .option-choice input'
    );
    interactiveElements.forEach((el) => {
      if (!el.hasAttribute('data-was-disabled')) {
        el.setAttribute('data-was-disabled', el.disabled ? 'true' : 'false');
      }
      el.disabled = true;
    });
  }

  function setParticipantPauseState(isPaused) {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminScreen = urlParams.get('admin') === '1' || urlParams.get('screen') === 'admin';
    const isLeaderboardScreen = urlParams.get('screen') === 'leaderboard';
    if (isAdminScreen || isLeaderboardScreen) {
      return;
    }

    const overlay = document.getElementById('participant-pause-overlay');
    const pausedCard = document.getElementById('pause-card-paused');
    const resumingCard = document.getElementById('pause-card-resuming');

    if (overlay) {
      if (isPaused) {
        overlay.classList.remove('hidden');
        document.body.classList.add('competition-paused');
        if (pausedCard) pausedCard.classList.remove('hidden');
        if (resumingCard) resumingCard.classList.add('hidden');
      } else {
        if (resumingCard && !resumingCard.classList.contains('hidden')) {
          const countdownNum = document.getElementById('pause-countdown-number');
          if (countdownNum) countdownNum.textContent = 'MULAI!';
          setTimeout(() => {
            overlay.classList.add('hidden');
            document.body.classList.remove('competition-paused');
            if (pausedCard) pausedCard.classList.remove('hidden');
            if (resumingCard) resumingCard.classList.add('hidden');
          }, 350);
        } else {
          overlay.classList.add('hidden');
          document.body.classList.remove('competition-paused');
          if (pausedCard) pausedCard.classList.remove('hidden');
          if (resumingCard) resumingCard.classList.add('hidden');
        }
      }
    }

    const interactiveElements = document.querySelectorAll(
      '#app-main button, #app-main input, #app-main textarea, #app-main select, .nav-tab, .candidate-btn, #btn-prev-question, #btn-next-question, .question-nav-btn, .option-choice input'
    );
    if (isPaused) {
      interactiveElements.forEach((el) => {
        if (!el.hasAttribute('data-was-disabled')) {
          el.setAttribute('data-was-disabled', el.disabled ? 'true' : 'false');
        }
        el.disabled = true;
      });
    } else {
      interactiveElements.forEach((el) => {
        if (el.getAttribute('data-was-disabled') === 'false') {
          el.disabled = false;
        }
        el.removeAttribute('data-was-disabled');
      });
    }
  }

  on('timer:paused', () => setParticipantPauseState(true));
  on('timer:resuming', (data) => setParticipantResumingState(data.countdown));
  on('timer:resumed', () => setParticipantPauseState(false));

  on('timer:tick', (data) => {
    if (!data.is_paused) {
      setParticipantPauseState(false);
    }

    const mins = Math.floor(data.remaining_seconds / 60);
    const secs = data.remaining_seconds % 60;
    const text = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

    if (data.phase === 'case_file') {
      const timer = document.getElementById('case-file-timer');
      if (timer) timer.textContent = text;
    }
    if (['level_1', 'level_2', 'level_3'].includes(data.phase)) {
      const gameTimer = document.getElementById('game-timer');
      if (gameTimer) {
        gameTimer.textContent = text;
        if (data.is_paused) {
          gameTimer.classList.add('paused');
        } else {
          gameTimer.classList.remove('paused');
        }
      }
      const bar = document.getElementById('timer-bar');
      if (bar) {
        const total = Math.max(0, Number(data.total_seconds) || 0);
        const pct = total > 0 ? (data.remaining_seconds / total) * 100 : 0;
        bar.style.width = pct + '%';
        bar.style.background = data.is_paused ? '#eab308' : (pct < 20 ? '#e2645c' : '#d4a054');
      }
    }
    if (['clue_1', 'clue_2', 'clue_3'].includes(data.phase)) {
      const timer = document.getElementById('clue-timer');
      if (timer) timer.textContent = text;
    }
    if (['case_file', 'clue_1', 'clue_2', 'clue_3'].includes(data.phase)) {
      const headerTimer = document.getElementById('header-timer');
      if (headerTimer) {
        headerTimer.textContent = text;
        headerTimer.classList.remove('hidden');
      }
    }
  });

  on('timer:expired', (data) => {
    if (['level_1', 'level_2', 'level_3'].includes(data && data.phase)) {
      const gameTimer = document.getElementById('game-timer');
      if (gameTimer) gameTimer.textContent = '00:00';
      const bar = document.getElementById('timer-bar');
      if (bar) bar.style.width = '0%';
    }
    document.querySelectorAll('#answer-options input').forEach((input) => {
      input.disabled = true;
    });
  });
});
