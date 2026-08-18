function initAdminView() {
  let adminToken = null;
  const teamConnections = {};

  function showDecisionMessage(message, isError = false) {
    const box = document.getElementById('admin-decision-message');
    if (!box) return;
    box.textContent = message;
    box.classList.toggle('hidden', !message);
    box.classList.toggle('error-slot', isError);
  }

  function postDecision(path, body, successMessage) {
    return fetch('/api/admin/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
      },
      body: JSON.stringify(body),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || data.error) throw new Error(data.error || 'Tindakan admin gagal');
        showDecisionMessage(successMessage);
        loadTeamStatus();
        return data;
      })
      .catch((error) => {
        showDecisionMessage(error.message, true);
        throw error;
      });
  }

  document.getElementById('admin-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          document.getElementById('admin-error').textContent = data.error;
          document.getElementById('admin-error').classList.remove('hidden');
          return;
        }
        adminToken = data.token;
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminState();
      });
  });

  function loadAdminState() {
    fetch('/api/admin/state', {
      headers: { 'X-Admin-Token': adminToken },
    })
      .then((r) => r.json())
      .then((data) => {
        document.getElementById('admin-phase').textContent =
          'Mode: ' + (data.mode || 'simulation').toUpperCase() + ' | Fase: ' + data.phase.toUpperCase();
        updateTimer(data);
        renderControls(data.phase, data.mode || 'simulation');
      });
  }

  function updateTimer(data) {
    const remaining = Math.max(0, Number(data.remaining_seconds) || 0);
    const total = Math.max(0, Number(data.total_seconds || data.level_duration_seconds) || 0);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timer = document.getElementById('admin-timer');
    const bar = document.getElementById('admin-timer-bar');
    if (timer) timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (bar) {
      const pct = total > 0 ? (remaining / total) * 100 : 0;
      bar.style.width = pct + '%';
      bar.style.background = pct < 20 ? '#c62828' : '#ff6f00';
    }
  }

  function renderControls(phase, mode) {
    const transitions = {
      lobby: { next: 'case_file', label: 'Mulai Case File (2 menit)' },
    };

    const container = document.getElementById('admin-controls');
    container.innerHTML = '';

    const modeTitle = document.createElement('p');
    modeTitle.textContent = 'Pilih mode (memulai mode akan mengosongkan hasil mode tersebut):';
    container.appendChild(modeTitle);

    ['simulation', 'official'].forEach((targetMode) => {
      const modeBtn = document.createElement('button');
      modeBtn.className = 'btn-control btn-start';
      modeBtn.textContent = targetMode === 'simulation' ? 'Mulai Simulasi' : 'Mulai Pertandingan Resmi';
      modeBtn.disabled = mode === targetMode && phase !== 'finished';
      modeBtn.addEventListener('click', () => switchMode(targetMode));
      container.appendChild(modeBtn);
    });

    if (transitions[phase]) {
      const btn = document.createElement('button');
      btn.className = 'btn-control btn-start';
      btn.textContent = transitions[phase].label;
      btn.addEventListener('click', () => startPhase(transitions[phase].next));
      container.appendChild(btn);
    }

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-control btn-reset';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', resetGame);
    container.appendChild(resetBtn);

    loadTeamStatus();
    loadQuestionCatalog(mode);
  }

  function switchMode(mode) {
    const label = mode === 'simulation' ? 'SIMULASI' : 'PERTANDINGAN RESMI';
    if (!confirm(`Beralih ke ${label}? Hasil mode tersebut akan dimulai dari awal.`)) return;

    fetch('/api/admin/mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
      },
      body: JSON.stringify({ mode }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) loadAdminState();
        else alert(data.error);
      });
  }

  function startPhase(phase) {
    fetch('/api/admin/start/' + phase, {
      method: 'POST',
      headers: { 'X-Admin-Token': adminToken },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) loadAdminState();
        else alert(data.error);
      });
  }

  function resetGame() {
    if (!confirm('Reset semua data permainan?')) return;
    fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'X-Admin-Token': adminToken },
    })
      .then((r) => r.json())
      .then(() => loadAdminState());
  }

  function renderTeamTable(data) {
    const container = document.getElementById('admin-teams');
    if (!data || !data.leaderboard) return;
    container.innerHTML = `
          <table>
        <thead><tr><th>#</th><th>Tim</th><th>Status</th><th>Skor</th><th>L1</th><th>L2</th><th>L3</th></tr></thead>
        <tbody>
          ${data.leaderboard.map((t) => `<tr>
            <td>${t.rank || '-'}</td>
            <td>${escapeHtml(t.name)}</td>
            <td>${t.status === 'DISQUALIFIED' ? 'DISQUALIFIED' : t.status === 'TIED'
    ? 'TIED' : (teamConnections[t.team_id] || 'BELUM TERDETEKSI')}</td>
            <td>${t.total}</td>
            <td>${t.l1_correct || 0}</td>
            <td>${t.l2_correct || 0}</td>
            <td>${t.l3_correct || 0}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  function loadTeamStatus() {
    fetch('/api/admin/competition', {
      headers: { 'X-Admin-Token': adminToken },
    })
      .then((r) => r.json())
      .then((data) => {
        renderTeamTable(data);
        renderAudit(data.audit_log || []);
      });
  }

  function renderAudit(entries) {
    const container = document.getElementById('admin-audit');
    if (!container) return;
    if (!entries.length) {
      container.textContent = 'Belum ada catatan audit.';
      return;
    }
    container.innerHTML = '<ul class="audit-list">' + entries.slice(0, 20).map((entry) => {
      const details = JSON.stringify(entry.details || {});
      return '<li><strong>' + escapeHtml(entry.action) + '</strong>'
        + ' · Tim: ' + escapeHtml(entry.team_id === null ? '-' : entry.team_id)
        + ' · ' + escapeHtml(entry.created_at || '')
        + '<br><small>' + escapeHtml(details) + '</small></li>';
    }).join('') + '</ul>';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[character]));
  }

  function loadQuestionCatalog(mode) {
    fetch('/api/admin/questions?mode=' + encodeURIComponent(mode), {
      headers: { 'X-Admin-Token': adminToken },
    })
      .then((r) => r.json())
      .then((data) => {
        const container = document.getElementById('admin-questions');
        if (data.error) {
          container.textContent = data.error;
          return;
        }

        const rows = data.questions.map((question) => {
          const image = question.image;
          let status = '<span class="image-status image-missing">Belum ada</span>';
          if (image && image.valid) {
            status = '<span class="image-status image-valid">' + escapeHtml(image.filename)
              + ' (' + image.width + 'x' + image.height + ')</span>';
          } else if (image) {
            status = '<span class="image-status image-invalid">Tidak valid: '
              + escapeHtml(image.issues.join(', ')) + '</span>';
          }

          return '<tr>'
            + '<td><code>q_' + question.id + '</code></td>'
            + '<td>Level ' + question.level + '</td>'
            + '<td>' + escapeHtml(question.topic) + '</td>'
            + '<td>' + status + '</td>'
            + '</tr>';
        }).join('');

        const warning = data.unrecognized_images.length
          ? '<p class="image-warning">File tidak terpakai: '
            + data.unrecognized_images.map((image) => escapeHtml(image.filename)).join(', ') + '</p>'
          : '';
        container.innerHTML = warning
          + '<p class="image-limits">Batas: ' + (data.limits.max_file_size_bytes / 1024 / 1024)
          + ' MB dan ' + data.limits.max_image_dimension + 'px.</p>'
          + '<div class="table-wrap"><table class="question-image-table">'
          + '<thead><tr><th>ID</th><th>Level</th><th>Topik</th><th>Gambar</th></tr></thead>'
          + '<tbody>' + rows + '</tbody></table></div>';
      })
      .catch(() => {
        document.getElementById('admin-questions').textContent = 'Daftar soal tidak dapat dimuat.';
      });
  }

  on('phase:changed', () => {
    if (adminToken) loadAdminState();
  });

  on('timer:tick', (data) => {
    if (adminToken) updateTimer(data);
  });

  on('mode:changed', () => {
    if (adminToken) loadAdminState();
  });

  on('leaderboard:update', (data) => {
    if (adminToken) renderTeamTable(data);
  });

  on('team:connected', (data) => {
    teamConnections[data.team_id] = 'TERHUBUNG';
    if (adminToken) loadTeamStatus();
  });

  on('team:disconnected', (data) => {
    teamConnections[data.team_id] = 'TERPUTUS';
    if (adminToken) loadTeamStatus();
  });

  document.getElementById('admin-disqualify-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const teamId = Number(document.getElementById('admin-dq-team').value);
    const reason = document.getElementById('admin-dq-reason').value.trim();
    postDecision('disqualify', { team_id: teamId, reason }, `Tim ${teamId} didiskualifikasi dan tercatat di audit.`)
      .then(() => event.target.reset())
      .catch(() => {});
  });

  document.getElementById('admin-reinstate-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const teamId = Number(document.getElementById('admin-reinstate-team').value);
    postDecision('reinstate', { team_id: teamId }, `Status Tim ${teamId} dipulihkan.`)
      .then(() => event.target.reset())
      .catch(() => {});
  });

  document.getElementById('admin-playoff-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const orderedTeamIds = document.getElementById('admin-playoff-order').value
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value));
    const notes = document.getElementById('admin-playoff-notes').value.trim();
    postDecision('playoff', { ordered_team_ids: orderedTeamIds, notes }, 'Hasil play-off tersimpan dan leaderboard diperbarui.')
      .then(() => event.target.reset())
      .catch(() => {});
  });
}
