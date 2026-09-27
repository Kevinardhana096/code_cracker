function initLeaderboardView() {
  const prevScores = {};

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function getGoldTrophyMedallion() {
    return `
      <div class="lb-medallion lb-medallion-gold" title="Juara 1">
        <svg viewBox="0 0 36 36" class="lb-medallion-svg">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#fef08a" stroke-width="1" opacity="0.6" />
          <path d="M10 25 C 8 20, 8 14, 13 10 M 8 19 C 10 17, 12 16, 13 16 M 9 14 C 11 12, 13 12, 14 13" stroke="#fef08a" stroke-width="1.1" fill="none" stroke-linecap="round" />
          <path d="M26 25 C 28 20, 28 14, 23 10 M 28 19 C 26 17, 24 16, 23 16 M 27 14 C 25 12, 23 12, 22 13" stroke="#fef08a" stroke-width="1.1" fill="none" stroke-linecap="round" />
          <path d="M13.5 12h9v3.5c0 2.5-2 4.5-4.5 4.5s-4.5-2-4.5-4.5v-3.5zm-2 1.8h2v1.8c0 1-.7 1.5-1.5 1.5-.7 0-1.2-.4-1.2-1 0-.3.2-.7.7-.7zm13 0h-2v1.8c0 1 .7 1.5 1.5 1.5.7 0 1.2-.4 1.2-1 0-.3-.2-.7-.7-.7zm-7 6.2v3m-2.5 0h5" fill="#fef9c3" stroke="#ca8a04" stroke-width="0.8" stroke-linecap="round"/>
        </svg>
      </div>
    `;
  }

  function getSilverMedallion(text = 'Seri') {
    return `
      <div class="lb-medallion lb-medallion-silver" title="${text}">
        <svg viewBox="0 0 36 36" class="lb-medallion-svg">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.6" />
          <path d="M10 25 C 8 20, 8 14, 13 10 M 8 19 C 10 17, 12 16, 13 16 M 9 14 C 11 12, 13 12, 14 13" stroke="#e2e8f0" stroke-width="1.1" fill="none" stroke-linecap="round" />
          <path d="M26 25 C 28 20, 28 14, 23 10 M 28 19 C 26 17, 24 16, 23 16 M 27 14 C 25 12, 23 12, 22 13" stroke="#e2e8f0" stroke-width="1.1" fill="none" stroke-linecap="round" />
          <text x="18" y="20.5" text-anchor="middle" font-size="8" font-weight="800" fill="#ffffff" letter-spacing="0.3">${text}</text>
        </svg>
      </div>
    `;
  }

  function getBronzeMedallion(text = 'Seri') {
    return `
      <div class="lb-medallion lb-medallion-bronze" title="${text}">
        <svg viewBox="0 0 36 36" class="lb-medallion-svg">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#fed7aa" stroke-width="1" opacity="0.6" />
          <path d="M10 25 C 8 20, 8 14, 13 10 M 8 19 C 10 17, 12 16, 13 16 M 9 14 C 11 12, 13 12, 14 13" stroke="#fed7aa" stroke-width="1.1" fill="none" stroke-linecap="round" />
          <path d="M28 25 C 28 20, 28 14, 23 10 M 28 19 C 26 17, 24 16, 23 16 M 27 14 C 25 12, 23 12, 22 13" stroke="#fed7aa" stroke-width="1.1" fill="none" stroke-linecap="round" />
          <text x="18" y="20.5" text-anchor="middle" font-size="8" font-weight="800" fill="#fef3c7" letter-spacing="0.3">${text}</text>
        </svg>
      </div>
    `;
  }

  function renderTeamCard(t, index) {
    const rank = t.rank != null ? t.rank : index + 1;
    let rankClass = '';
    let rankHtml = '';
    let statusTag = '';
    let medallionHtml = '';

    const isColRight = index >= 8;

    if (isColRight) {
      rankClass = 'rank-eliminasi';
      if (t.status === 'TIED') {
        rankHtml = `<span class="lb-rank-num lb-tied-title">#TIED</span><span class="lb-rank-sub">(${getOrdinal(rank)})</span>`;
        statusTag = '<span class="lb-tag lb-tag-tied">Seri</span>';
      } else if (t.status === 'DISQUALIFIED') {
        rankHtml = `<span class="lb-rank-num lb-tied-title">#DQ</span>`;
        statusTag = '<span class="lb-tag lb-tag-dq">DQ</span>';
      } else {
        rankHtml = `<span class="lb-rank-num">#${rank}</span>`;
        statusTag = '';
      }
      medallionHtml = '';
    } else {
      // Column 1: Peringkat 1 - 8 (Zona Lolos)
      if (index === 0) {
        rankClass = 'rank-1';
        rankHtml = `<span class="lb-medal">🏅</span><span class="lb-rank-num">1</span>`;
        statusTag = '<span class="lb-tag lb-tag-champ">Juara 1</span>';
        medallionHtml = getGoldTrophyMedallion();
      } else if (index === 1) {
        rankClass = 'rank-2';
        rankHtml = `<span class="lb-rank-num">#2</span>`;
        statusTag = t.status === 'TIED' ? '<span class="lb-tag lb-tag-tied">Seri</span>' : '<span class="lb-tag lb-tag-qual">Lolos</span>';
        medallionHtml = getSilverMedallion(t.status === 'TIED' ? 'Seri' : '2');
      } else if (index === 2) {
        rankClass = 'rank-3';
        rankHtml = `<span class="lb-rank-num">#3</span>`;
        statusTag = t.status === 'TIED' ? '<span class="lb-tag lb-tag-tied">Seri</span>' : '<span class="lb-tag lb-tag-qual">Lolos</span>';
        medallionHtml = getBronzeMedallion(t.status === 'TIED' ? 'Seri' : '3');
      } else {
        rankClass = 'rank-zone-lolos';
        rankHtml = `<span class="lb-rank-num">#${index + 1}</span>`;
        statusTag = t.status === 'TIED' ? '<span class="lb-tag lb-tag-tied">Seri</span>' : '<span class="lb-tag lb-tag-qual">Lolos</span>';
        medallionHtml = getSilverMedallion(t.status === 'TIED' ? 'Seri' : `${index + 1}`);
      }
    }

    const l1 = t.l1_correct != null ? t.l1_correct : '-';
    const l2 = t.l2_correct != null ? t.l2_correct : '-';
    const l3 = t.l3_correct != null ? t.l3_correct : '-';
    const bonusStr = t.bonus ? `<span class="lb-stat-bonus">+${t.bonus}</span>` : '';

    const prev = prevScores[t.name];
    const isBump = prev != null && t.total > prev;
    prevScores[t.name] = t.total;
    const bumpClass = isBump ? 'bump' : '';

    return `
      <div class="lb-team-card ${rankClass}" style="--card-index: ${index};">
        <div class="lb-rank-box">
          ${rankHtml}
        </div>
        <div class="lb-team-info">
          <div class="lb-team-name-row">
            <span class="lb-team-name" title="${escapeLeaderboardHtml(t.name)}">${escapeLeaderboardHtml(t.name)}</span>
            ${statusTag}
          </div>
          <div class="lb-breakdown-row">
            <span class="lb-stat">L1: ${l1}</span>
            <span class="lb-stat">L2: ${l2}</span>
            <span class="lb-stat">L3: ${l3}</span>
            ${bonusStr ? `<span class="lb-stat">Bonus: ${bonusStr}</span>` : ''}
          </div>
        </div>
        ${medallionHtml}
        <div class="lb-score-box">
          <span class="lb-score-label">SKOR</span>
          <span class="lb-score-num ${bumpClass}">${t.total}</span>
        </div>
      </div>
    `;
  }

  function update(data) {
    if (!data || !data.leaderboard) return;

    const list = data.leaderboard;
    const colLeft = document.getElementById('leaderboard-col-left');
    const colRight = document.getElementById('leaderboard-col-right');

    if (colLeft && colRight) {
      const leftTeams = list.slice(0, 8);
      const rightTeams = list.slice(8, 15);

      colLeft.innerHTML = leftTeams.map((t, i) => renderTeamCard(t, i)).join('');
      colRight.innerHTML = rightTeams.map((t, i) => renderTeamCard(t, i + 8)).join('');
    }

    // Fallback for standard table if present
    const tbody = document.getElementById('leaderboard-body');
    if (tbody) {
      tbody.innerHTML = list
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
  }

  function updateState(data) {
    const mode = document.getElementById('leaderboard-mode');
    const phase = document.getElementById('leaderboard-phase');
    if (mode) mode.textContent = (data.mode || '-').toUpperCase();
    if (phase) phase.textContent = (data.phase || '-').toUpperCase();
    updateTimer(data);
  }

  function updateTimer(data) {
    const remaining = Math.max(0, Number(data.remaining_seconds) || 0);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timer = document.getElementById('leaderboard-timer');
    const timerPill = document.querySelector('.lb-stat-pill-timer');
    if (timer) {
      timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (data.is_paused) {
        timer.classList.add('paused');
        if (timerPill) timerPill.classList.add('is-paused');
      } else {
        timer.classList.remove('paused');
        if (timerPill) timerPill.classList.remove('is-paused');
      }
      if (remaining <= 30 && remaining > 0 && !data.is_paused) {
        timer.classList.add('critical');
      } else {
        timer.classList.remove('critical');
      }
    }
  }

  // Fullscreen toggle button
  const fsBtn = document.getElementById('btn-leaderboard-fullscreen');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  on('leaderboard:update', update);
  on('timer:tick', updateTimer);
  on('timer:paused', (data) => updateTimer({ ...data, is_paused: true }));
  on('timer:resumed', (data) => updateTimer({ ...data, is_paused: false }));

  return { update, updateState, updateTimer };
}

function escapeLeaderboardHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}
