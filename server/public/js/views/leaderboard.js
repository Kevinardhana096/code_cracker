function initLeaderboardView() {
  function update(data) {
    const tbody = document.getElementById('leaderboard-body');
    if (!data || !data.leaderboard) return;

    tbody.innerHTML = data.leaderboard
      .map((t, i) => {
        const cls = t.qualified ? 'top-five' : '';
        const label = t.status === 'DISQUALIFIED'
          ? 'DQ'
          : t.status === 'TIED' ? 'TIED' : (t.rank || '-');
        return `<tr class="${cls}">
          <td>${label}</td>
          <td>${escapeLeaderboardHtml(t.name)}</td>
          <td>${t.total}</td>
        </tr>`;
      })
      .join('');
  }

  function updateState(data) {
    const mode = document.getElementById('leaderboard-mode');
    const phase = document.getElementById('leaderboard-phase');
    if (mode) mode.textContent = 'MODE: ' + (data.mode || '-').toUpperCase();
    if (phase) phase.textContent = 'FASE: ' + (data.phase || '-').toUpperCase();
    updateTimer(data);
  }

  function updateTimer(data) {
    const remaining = Math.max(0, Number(data.remaining_seconds) || 0);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timer = document.getElementById('leaderboard-timer');
    if (timer) timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  on('leaderboard:update', update);
  on('timer:tick', updateTimer);

  return { update, updateState, updateTimer };
}

function escapeLeaderboardHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}
