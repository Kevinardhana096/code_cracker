function initAdminView() {
  const ADMIN_SESSION_KEY = 'code-cracker-admin-token';
  let adminToken = null;
  const teamConnections = {};

  function saveAdminToken(token) {
    try {
      localStorage.setItem(ADMIN_SESSION_KEY, token);
    } catch (_) {}
  }

  function getSavedAdminToken() {
    try {
      return localStorage.getItem(ADMIN_SESSION_KEY);
    } catch (_) {
      return null;
    }
  }

  function clearAdminToken() {
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    } catch (_) {}
  }

  function activateAdminPanel(token) {
    adminToken = token;
    saveAdminToken(token);
    document.getElementById('admin-login').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    const err = document.getElementById('admin-error');
    if (err) err.classList.add('hidden');
    initAdminTabs();
    loadAdminState();
  }

  function logoutAdmin(message) {
    clearAdminToken();
    adminToken = null;
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('admin-login').classList.remove('hidden');
    const err = document.getElementById('admin-error');
    if (err) {
      if (message) {
        err.textContent = message;
        err.classList.remove('hidden');
      } else {
        err.classList.add('hidden');
      }
    }
    const pwd = document.getElementById('admin-password');
    if (pwd) pwd.value = '';
  }

  function showDecisionMessage(message, isError = false) {
    const box = document.getElementById('admin-decision-message');
    if (!box) return;
    box.textContent = message;
    box.classList.toggle('hidden', !message);
    box.classList.toggle('error-slot', isError);
  }

  function adminFetch(path, options = {}) {
    const url = path.startsWith('/') ? path : '/api/admin/' + path;
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken,
        ...(options.headers || {}),
      },
    }).then(async (r) => {
      if (r.status === 401) {
        logoutAdmin('Sesi admin telah kedaluwarsa. Silakan masukkan password kembali.');
        throw new Error('Sesi admin kedaluwarsa');
      }
      const contentType = r.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (r.status === 404) {
          throw new Error('Endpoint tidak ditemukan (404). Silakan restart server "npm start" di terminal Anda.');
        }
        throw new Error(`Server mengembalikan respon non-JSON (${r.status}). Silakan restart server.`);
      }
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || 'Permintaan gagal');
      return data;
    });
  }

  function postDecision(path, body, successMessage) {
    return adminFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
      .then((data) => {
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
        activateAdminPanel(data.token);
      })
      .catch(() => {
        document.getElementById('admin-error').textContent = 'Gagal terhubung ke server';
        document.getElementById('admin-error').classList.remove('hidden');
      });
  });

  function loadAdminState() {
    if (!adminToken) return;
    fetch('/api/admin/state', {
      headers: { 'X-Admin-Token': adminToken },
    })
      .then((r) => {
        if (r.status === 401) {
          logoutAdmin('Sesi admin telah kedaluwarsa. Silakan masukkan password kembali.');
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        document.getElementById('admin-phase').textContent =
          'Mode: ' + (data.mode || 'simulation').toUpperCase() + ' | Fase: ' + data.phase.toUpperCase();
        updateTimer(data);
        renderControls(data.phase, data.mode || 'simulation', Boolean(data.is_paused));
      })
      .catch(() => {});
  }

  function updateTimer(data) {
    const remaining = Math.max(0, Number(data.remaining_seconds) || 0);
    const total = Math.max(0, Number(data.total_seconds || data.level_duration_seconds) || 0);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timer = document.getElementById('admin-timer');
    const bar = document.getElementById('admin-timer-bar');
    if (timer) {
      timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (data.is_paused) {
        timer.classList.add('paused');
      } else {
        timer.classList.remove('paused');
      }
    }
    if (bar) {
      const pct = total > 0 ? (remaining / total) * 100 : 0;
      bar.style.width = pct + '%';
      bar.style.background = data.is_paused ? '#eab308' : (pct < 20 ? '#c62828' : '#ff6f00');
    }
  }

  function pauseTimer() {
    adminFetch('timer/pause', { method: 'POST', body: JSON.stringify({}) })
      .then((res) => {
        if (res && res.ok) {
          loadAdminState();
        }
      })
      .catch((err) => {
        alert('Gagal menjeda timer: ' + err.message);
        loadAdminState();
      });
  }

  function resumeTimer() {
    adminFetch('timer/resume', { method: 'POST', body: JSON.stringify({}) })
      .then((res) => {
        if (res && res.ok) {
          loadAdminState();
        }
      })
      .catch((err) => {
        alert('Gagal melanjutkan timer: ' + err.message);
        loadAdminState();
      });
  }

  const PHASE_LABELS = {
    lobby: 'Lobby',
    case_file: 'Case File',
    level_1: 'Level 1',
    clue_1: 'Clue 1',
    level_2: 'Level 2',
    clue_2: 'Clue 2',
    level_3: 'Level 3',
    clue_3: 'Clue 3',
    resolution: 'Final Case Resolution',
    finished: 'Selesai',
  };

  const PHASE_FLOW = ['case_file', 'level_1', 'clue_1', 'level_2', 'clue_2', 'level_3', 'clue_3', 'resolution'];

  function nextPhaseLabel(phase) {
    const index = PHASE_FLOW.indexOf(phase);
    if (index === -1) return null;
    return index + 1 < PHASE_FLOW.length ? PHASE_LABELS[PHASE_FLOW[index + 1]] : 'Leaderboard Final';
  }

  function renderControls(phase, mode, isPaused = false) {
    const container = document.getElementById('admin-controls');
    container.innerHTML = '';

    if (phase === 'lobby') {
      // LANGKAH 1 — pilih mode
      const step1 = document.createElement('div');
      step1.className = 'control-step';
      step1.innerHTML = '<p class="control-step-title">LANGKAH 1 — Pilih mode:</p>';
      const modeRow = document.createElement('div');
      modeRow.className = 'control-mode-row';
      [['simulation', 'Simulasi (latihan)'], ['official', 'Pertandingan Resmi']].forEach(([value, label]) => {
        const btn = document.createElement('button');
        btn.className = 'btn-control btn-mode' + (mode === value ? ' active' : '');
        btn.textContent = (mode === value ? '● ' : '○ ') + label;
        btn.addEventListener('click', () => { if (mode !== value) switchMode(value); });
        modeRow.appendChild(btn);
      });
      step1.appendChild(modeRow);
      const modeNote = document.createElement('p');
      modeNote.className = 'muted control-note';
      modeNote.textContent = 'Mode aktif: ' + mode.toUpperCase() + '. Mengganti mode mengosongkan hasil mode tujuan.';
      step1.appendChild(modeNote);
      container.appendChild(step1);

      // LANGKAH 2 — tombol utama
      const step2 = document.createElement('div');
      step2.className = 'control-step';
      step2.innerHTML = '<p class="control-step-title">LANGKAH 2 — Mulai jalannya pertandingan:</p>';
      const startBtn = document.createElement('button');
      startBtn.className = 'btn-control btn-start btn-primary-action';
      startBtn.textContent = '▶ MULAI CASE FILE';
      startBtn.addEventListener('click', () => startPhase('case_file'));
      step2.appendChild(startBtn);
      const flowNote = document.createElement('p');
      flowNote.className = 'muted control-note';
      flowNote.textContent = 'Setelah ditekan, seluruh fase berjalan otomatis: Case File → Level 1 → Clue → Level 2 → Clue → Level 3 → Clue → Resolution → Leaderboard. Tidak ada tombol lain yang perlu ditekan.';
      step2.appendChild(flowNote);
      container.appendChild(step2);

      container.appendChild(buildResetButton());
    } else if (phase === 'finished') {
      const done = document.createElement('p');
      done.className = 'control-status';
      done.textContent = 'Pertandingan selesai. Leaderboard final sudah tampil.';
      container.appendChild(done);

      const again = document.createElement('p');
      again.className = 'muted control-note';
      again.textContent = 'Untuk memulai sesi baru, kembali ke lobby dengan Reset, atau ganti mode.';
      container.appendChild(again);

      container.appendChild(buildResetButton());
    } else {
      // Pertandingan sedang berjalan
      const running = document.createElement('p');
      running.className = 'control-status control-running';
      running.textContent = 'SEDANG BERJALAN: ' + (PHASE_LABELS[phase] || phase);
      container.appendChild(running);

      const next = nextPhaseLabel(phase);
      const auto = document.createElement('p');
      auto.className = 'muted control-note';
      auto.textContent = next
        ? 'Fase berikutnya: ' + next + ' (otomatis saat timer habis — admin tidak perlu menekan apa pun).'
        : 'Fase berjalan otomatis — admin tidak perlu menekan apa pun.';
      container.appendChild(auto);

      // Kontrol Pause / Resume Timer
      const timerControlDiv = document.createElement('div');
      timerControlDiv.className = 'control-step control-timer-step';

      const pauseBtn = document.createElement('button');
      pauseBtn.className = 'btn-control ' + (isPaused ? 'btn-resume-timer' : 'btn-pause-timer');
      pauseBtn.innerHTML = isPaused ? '▶ LANJUTKAN TIMER (RESUME)' : '⏸ JEDA TIMER (PAUSE)';
      pauseBtn.addEventListener('click', () => {
        pauseBtn.disabled = true;
        if (isPaused) {
          resumeTimer();
        } else {
          pauseTimer();
        }
      });
      timerControlDiv.appendChild(pauseBtn);

      if (isPaused) {
        const pauseNotice = document.createElement('div');
        pauseNotice.className = 'admin-pause-banner';
        pauseNotice.innerHTML = '⏸ <strong>TIMER SEDANG DIJEDA</strong> — Pengiriman jawaban peserta dibekukan sementara.';
        timerControlDiv.appendChild(pauseNotice);
      }

      container.appendChild(timerControlDiv);

      container.appendChild(buildResetButton());
    }

    loadTeamStatus();
    loadQuestionCatalog(mode);
    loadQuestionBank();
    loadClueBank();
    loadTeamManagement();
  }

  // --- Manajemen Clue ---

  function loadClueBank() {
    const container = document.getElementById('admin-clues');
    if (!container) return;
    adminFetch('clues/full')
      .then((data) => renderClueBank(container, data))
      .catch((error) => { container.textContent = error.message; });
  }

  function renderClueBank(container, data) {
    container.innerHTML = '';

    if (data.locked) {
      const notice = document.createElement('p');
      notice.className = 'qbank-notice';
      notice.textContent = 'Clue sedang dikunci karena pertandingan berjalan. Reset ke lobby untuk mengubah.';
      container.appendChild(notice);
    }

    [1, 2, 3].forEach((level) => {
      const clues = data.clues.filter((c) => c.level === level);
      const section = document.createElement('div');
      section.className = 'qbank-level';

      const header = document.createElement('div');
      header.className = 'qbank-level-header';
      header.innerHTML = `<h3>Level ${level} <span class="muted">(${clues.length}/4 clue)</span></h3>`;
      if (!data.locked && clues.length < 4) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-control btn-start btn-qbank';
        addBtn.textContent = '+ Tambah Clue';
        addBtn.addEventListener('click', () => showClueForm(container, data, { level }));
        header.appendChild(addBtn);
      }
      section.appendChild(header);

      clues.forEach((clue) => {
        const row = document.createElement('div');
        row.className = 'qbank-item';
        const preview = clue.clue_text.length > 80 ? clue.clue_text.slice(0, 80) + '…' : clue.clue_text;
        row.innerHTML =
          `<div class="qbank-item-text"><code>clue_${clue.id}</code>` +
          ` <strong>${clue.min_correct}–${clue.max_correct} benar</strong>` +
          `<br><span class="muted">${escapeHtml(preview)}</span></div>`;
        if (!data.locked) {
          const actions = document.createElement('div');
          actions.className = 'qbank-item-actions';
          const editBtn = document.createElement('button');
          editBtn.className = 'btn-control btn-qbank';
          editBtn.textContent = 'Edit';
          editBtn.addEventListener('click', () => showClueForm(container, data, clue));
          const delBtn = document.createElement('button');
          delBtn.className = 'btn-control btn-reset btn-qbank';
          delBtn.textContent = 'Hapus';
          delBtn.addEventListener('click', () => deleteClue(clue));
          actions.appendChild(editBtn);
          actions.appendChild(delBtn);
          row.appendChild(actions);
        }
        section.appendChild(row);
      });

      container.appendChild(section);
    });
  }

  function showClueForm(container, bankData, clue) {
    const isEdit = Boolean(clue.id);

    const form = document.createElement('form');
    form.className = 'qbank-form';
    form.innerHTML = `
      <h3>${isEdit ? 'Edit Clue #' + clue.id : 'Tambah Clue — Level ' + clue.level}</h3>
      <label>Level</label>
      <select name="level" ${isEdit ? 'disabled' : ''}>
        ${[1, 2, 3].map((l) => `<option value="${l}" ${l === clue.level ? 'selected' : ''}>Level ${l}</option>`).join('')}
      </select>
      <label>Min benar</label>
      <input name="min_correct" type="number" min="0" max="5" value="${clue.min_correct || 0}" required>
      <label>Max benar</label>
      <input name="max_correct" type="number" min="0" max="5" value="${clue.max_correct || 5}" required>
      <label>Teks clue</label>
      <textarea name="clue_text" rows="3" required maxlength="500">${escapeHtml(clue.clue_text || '')}</textarea>
      <div class="qbank-form-actions">
        <button type="submit" class="btn-control btn-start">${isEdit ? 'Simpan Perubahan' : 'Tambah Clue'}</button>
        <button type="button" class="btn-control" data-cancel>Batal</button>
      </div>
      <p class="error-slot hidden" data-error></p>
    `;

    form.querySelector('[data-cancel]').addEventListener('click', () => loadClueBank());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const payload = {
        level: Number(fd.get('level')),
        min_correct: Number(fd.get('min_correct')),
        max_correct: Number(fd.get('max_correct')),
        clue_text: fd.get('clue_text'),
      };
      const request = isEdit
        ? adminFetch('clues/' + clue.id, { method: 'PUT', body: JSON.stringify(payload) })
        : adminFetch('clues', { method: 'POST', body: JSON.stringify(payload) });
      request
        .then(() => loadClueBank())
        .catch((error) => {
          const box = form.querySelector('[data-error]');
          box.textContent = error.message;
          box.classList.remove('hidden');
        });
    });

    container.innerHTML = '';
    container.appendChild(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteClue(clue) {
    const preview = clue.clue_text.length > 60 ? clue.clue_text.slice(0, 60) + '…' : clue.clue_text;
    if (!confirm(`Hapus clue #${clue.id} (Level ${clue.level})?\n\n"${preview}"`)) return;
    adminFetch('clues/' + clue.id, { method: 'DELETE' })
      .then(() => loadClueBank())
      .catch((error) => alert(error.message));
  }

  // --- Manajemen Soal ---

  function loadQuestionBank() {
    const container = document.getElementById('admin-qbank');
    if (!container) return;
    adminFetch('questions/full')
      .then((data) => renderQuestionBank(container, data))
      .catch((error) => { container.textContent = error.message; });
  }

  function renderQuestionBank(container, data) {
    container.innerHTML = '';

    if (data.locked) {
      const notice = document.createElement('p');
      notice.className = 'qbank-notice';
      notice.textContent = 'Soal sedang dikunci karena pertandingan berjalan. Reset ke lobby untuk mengubah.';
      container.appendChild(notice);
    }

    [1, 2, 3].forEach((level) => {
      const questions = data.questions.filter((q) => q.level === level);
      const section = document.createElement('div');
      section.className = 'qbank-level';

      const header = document.createElement('div');
      header.className = 'qbank-level-header';
      header.innerHTML = `<h3>Level ${level} <span class="muted">(${questions.length}/5 soal)</span></h3>`;
      if (!data.locked && questions.length < 5) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-control btn-start btn-qbank';
        addBtn.textContent = '+ Tambah Soal';
        addBtn.addEventListener('click', () => showQuestionForm(container, data, { level }));
        header.appendChild(addBtn);
      }
      section.appendChild(header);

      questions.forEach((q) => {
        const row = document.createElement('div');
        row.className = 'qbank-item';
        const preview = q.question_text.length > 90 ? q.question_text.slice(0, 90) + '…' : q.question_text;
        row.innerHTML =
          `<div class="qbank-item-text"><code>q_${q.id}</code> <strong>${escapeHtml(q.topic || '-')}</strong>` +
          ` · ${q.points} poin · kunci <strong>${escapeHtml(q.answer_key)}</strong>` +
          `<br><span class="muted">${escapeHtml(preview)}</span></div>`;
        if (!data.locked) {
          const actions = document.createElement('div');
          actions.className = 'qbank-item-actions';
          const editBtn = document.createElement('button');
          editBtn.className = 'btn-control btn-qbank';
          editBtn.textContent = 'Edit';
          editBtn.addEventListener('click', () => showQuestionForm(container, data, q));
          const delBtn = document.createElement('button');
          delBtn.className = 'btn-control btn-reset btn-qbank';
          delBtn.textContent = 'Hapus';
          delBtn.addEventListener('click', () => deleteQuestion(q));
          actions.appendChild(editBtn);
          actions.appendChild(delBtn);
          row.appendChild(actions);
        }
        section.appendChild(row);
      });

      container.appendChild(section);
    });
  }

  function showQuestionForm(container, bankData, question) {
    const isEdit = Boolean(question.id);
    const existingOptions = {};
    const optionsById = {};
    (question.options || []).forEach((o) => {
      existingOptions[o.id] = o;
      optionsById[o.id] = o.text;
    });

    const form = document.createElement('form');
    form.className = 'qbank-form';
    form.innerHTML = `
      <h3>${isEdit ? 'Edit Soal q_' + question.id : 'Tambah Soal — Level ' + question.level}</h3>
      <label>Level</label>
      <select name="level" ${isEdit ? 'disabled' : ''}>
        ${[1, 2, 3].map((l) => `<option value="${l}" ${l === question.level ? 'selected' : ''}>Level ${l}</option>`).join('')}
      </select>
      <label>Topik</label>
      <input name="topic" type="text" value="${escapeHtml(question.topic || '')}" placeholder="Contoh: Aljabar">
      <label>Teks soal</label>
      <textarea name="question_text" rows="3" required>${escapeHtml(question.question_text || '')}</textarea>
      ${['A', 'B', 'C', 'D', 'E'].map((id) => {
        const opt = existingOptions[id];
        const existingImg = opt && opt.image_url;
        return `
        <fieldset class="qbank-option">
          <legend>Opsi ${id} <label class="qbank-key-label"><input type="radio" name="answer_key" value="${id}" ${question.answer_key === id ? 'checked' : ''} required> kunci</label></legend>
          <input name="opt_${id}" type="text" value="${escapeHtml(optionsById[id] || '')}" placeholder="Teks opsi ${id} (kosongkan jika hanya gambar)">
          <label class="qbank-option-image-label">Gambar opsi ${id} (opsional)</label>
          ${existingImg ? `
            <div class="qbank-existing-image" style="margin: 4px 0 8px;">
              <img src="${escapeHtml(existingImg)}" alt="Gambar opsi ${id}" style="max-height: 70px; max-width: 140px; object-fit: contain; border-radius: 4px; border: 1px solid var(--color-border-subtle, #333); display: block; margin-bottom: 4px;">
              <label style="font-size: 12px; color: var(--color-danger, #ff6b6b); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                <input type="checkbox" name="opt_${id}_remove_image" value="1"> Hapus gambar opsi ${id}
              </label>
            </div>
          ` : ''}
          <input name="opt_${id}_image" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.avif">
          <div class="qbank-image-preview hidden" data-option-preview="${id}"></div>
        </fieldset>
      `;
      }).join('')}
      <label>Poin</label>
      <input name="points" type="number" min="1" value="${question.points || 10}" required>
      <label>Gambar soal (opsional, maks 5 MB — png/jpg/webp/gif/avif)</label>
      <input name="image_file" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.avif">
      <p class="muted qbank-image-note" data-image-note>${isEdit
        ? 'Kosongkan jika gambar tidak berubah. Gambar disimpan setelah soal tersimpan.'
        : 'Gambar diunggah setelah soal dibuat (ID soal diperlukan untuk penamaan file).'}</p>
      <div class="qbank-image-preview hidden" data-image-preview></div>
      <div class="qbank-form-actions">
        <button type="submit" class="btn-control btn-start">${isEdit ? 'Simpan Perubahan' : 'Tambah Soal'}</button>
        <button type="button" class="btn-control" data-cancel>Batal</button>
      </div>
      <p class="error-slot hidden" data-error></p>
    `;

    // Preview lokal untuk gambar soal dan gambar tiap opsi
    const fileInput = form.querySelector('input[name="image_file"]');
    const preview = form.querySelector('[data-image-preview]');
    const bindPreview = (input, box) => {
      input.addEventListener('change', () => {
        const file = input.files[0];
        box.classList.toggle('hidden', !file);
        box.innerHTML = '';
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            box.innerHTML = '';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'Preview gambar: ' + file.name;
            box.appendChild(img);
          };
          reader.readAsDataURL(file);
        }
      });
    };
    bindPreview(fileInput, preview);
    ['A', 'B', 'C', 'D', 'E'].forEach((id) => {
      bindPreview(
        form.querySelector(`input[name="opt_${id}_image"]`),
        form.querySelector(`[data-option-preview="${id}"]`)
      );
    });

    form.querySelector('[data-cancel]').addEventListener('click', () => loadQuestionBank());
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const payload = {
        level: isEdit ? Number(question.level) : Number(fd.get('level')),
        topic: fd.get('topic'),
        question_text: fd.get('question_text'),
        answer_key: fd.get('answer_key'),
        options: {},
        points: Number(fd.get('points')),
      };
      ['A', 'B', 'C', 'D', 'E'].forEach((id) => {
        const optFileInput = form.querySelector(`input[name="opt_${id}_image"]`);
        const hasNewFile = optFileInput && optFileInput.files && optFileInput.files[0];
        const removeExisting = form.querySelector(`input[name="opt_${id}_remove_image"]`)?.checked;
        const currentUrl = (!removeExisting && existingOptions[id] && existingOptions[id].image_url) || null;
        payload.options[id] = {
          text: fd.get('opt_' + id),
          image_url: currentUrl || (hasNewFile ? 'pending_upload' : null),
        };
      });
      const saveRequest = isEdit
        ? adminFetch('questions/' + question.id, { method: 'PUT', body: JSON.stringify(payload) })
        : adminFetch('questions', { method: 'POST', body: JSON.stringify(payload) })
            .then(() => adminFetch('questions/full'))
            .then((fresh) => {
              const created = fresh.questions
                .filter((q) => q.level === payload.level)
                .sort((a, b) => b.id - a.id)[0];
              return { createdId: created && created.id };
            });

      saveRequest
        .then((result) => {
          const targetId = isEdit ? question.id : (result && result.createdId);
          if (!targetId) return null;
          // Kumpulkan semua upload: gambar soal + gambar tiap opsi yang dipilih
          const uploads = [];
          const file = fileInput.files[0];
          if (file) {
            uploads.push(
              readFileAsBase64(file).then((dataBase64) =>
                adminFetch('questions/' + targetId + '/image', {
                  method: 'POST',
                  body: JSON.stringify({ extension: file.name.split('.').pop(), data_base64: dataBase64 }),
                })
              )
            );
          }
          ['A', 'B', 'C', 'D', 'E'].forEach((id) => {
            const optFile = form.querySelector(`input[name="opt_${id}_image"]`).files[0];
            if (optFile) {
              uploads.push(
                readFileAsBase64(optFile).then((dataBase64) =>
                  adminFetch(`questions/${targetId}/options/${id}/image`, {
                    method: 'POST',
                    body: JSON.stringify({ extension: optFile.name.split('.').pop(), data_base64: dataBase64 }),
                  })
                )
              );
            }
          });
          return Promise.all(uploads);
        })
        .then(() => { loadQuestionBank(); loadQuestionCatalog(bankData.mode); })
        .catch((error) => {
          const box = form.querySelector('[data-error]');
          box.textContent = error.message;
          box.classList.remove('hidden');
        });
    });

    container.innerHTML = '';
    container.appendChild(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
      reader.readAsDataURL(file);
    });
  }

  function deleteQuestion(question) {
    const preview = question.question_text.length > 60 ? question.question_text.slice(0, 60) + '…' : question.question_text;
    if (!confirm(`Hapus soal q_${question.id} (Level ${question.level})?\n\n"${preview}"`)) return;
    adminFetch('questions/' + question.id, { method: 'DELETE' })
      .then(() => loadQuestionBank())
      .catch((error) => alert(error.message));
  }

  function buildResetButton() {
    const wrap = document.createElement('div');
    wrap.className = 'control-reset-row';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-control btn-reset btn-reset-small';
    resetBtn.textContent = 'Reset (darurat)';
    resetBtn.addEventListener('click', resetGame);
    wrap.appendChild(resetBtn);
    return wrap;
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
        <thead><tr><th>#</th><th>Tim</th><th>Status</th><th>Total Skor</th><th>Benar L1</th><th>Benar L2</th><th>Benar L3</th></tr></thead>
        <tbody>
          ${data.leaderboard.map((t) => `<tr>
            <td>${t.rank || '-'}</td>
            <td>${escapeHtml(t.name)}</td>
            <td>${t.status === 'DISQUALIFIED' ? 'DISQUALIFIED' : t.status === 'TIED'
    ? 'TIED' : (teamConnections[t.team_id] || 'BELUM TERDETEKSI')}</td>
            <td><strong>${t.total}</strong></td>
            <td>${t.l1_correct || 0} benar</td>
            <td>${t.l2_correct || 0} benar</td>
            <td>${t.l3_correct || 0} benar</td>
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

  // --- Tab Navigasi Admin ---
  let activeAdminTab = 'control';

  function initAdminTabs() {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) switchAdminTab(tab);
      });
    });
  }

  function switchAdminTab(tabName) {
    activeAdminTab = tabName;
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    tabButtons.forEach((btn) => {
      const isTarget = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    const panes = {
      control: document.getElementById('admin-pane-control'),
      teams: document.getElementById('admin-pane-teams'),
      questions: document.getElementById('admin-pane-questions'),
      decisions: document.getElementById('admin-pane-decisions'),
    };

    Object.entries(panes).forEach(([name, pane]) => {
      if (pane) pane.classList.toggle('hidden', name !== tabName);
    });

    if (tabName === 'teams') {
      loadTeamManagement();
    } else if (tabName === 'questions') {
      loadQuestionBank();
      loadClueBank();
    } else if (tabName === 'decisions') {
      loadTeamStatus();
    } else if (tabName === 'control') {
      loadTeamStatus();
    }
  }

  // --- Manajemen Tim & Kredensial Login ---
  let currentTeamsList = [];

  function showTeamManagementMessage(message, isError = false) {
    const box = document.getElementById('admin-teams-management-msg');
    if (!box) return;
    box.textContent = message;
    box.classList.toggle('hidden', !message);
    box.classList.toggle('error-slot', isError);
    box.classList.toggle('success-slot', !isError);
  }

  function loadTeamManagement() {
    const tbody = document.getElementById('admin-teams-management-body');
    if (!tbody) return;
    adminFetch('teams')
      .then((data) => {
        currentTeamsList = data.teams || [];
        renderTeamManagement(data.teams || [], data.locked);
      })
      .catch((err) => {
        showTeamManagementMessage(err.message, true);
      });
  }

  function renderTeamManagement(teams, locked) {
    const tbody = document.getElementById('admin-teams-management-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const regenBtn = document.getElementById('btn-regenerate-team-codes');
    if (regenBtn) regenBtn.disabled = locked;

    teams.forEach((t) => {
      const tr = document.createElement('tr');
      tr.id = `team-row-${t.id}`;
      tr.innerHTML = `
        <td><strong>#${t.id}</strong></td>
        <td>
          <input type="text" class="team-input team-name-input" id="team-name-${t.id}" value="${escapeHtml(t.name)}" ${locked ? 'disabled' : ''} maxlength="100" />
        </td>
        <td>
          <input type="text" class="team-input team-code-input" id="team-code-${t.id}" value="${escapeHtml(t.login_code)}" ${locked ? 'disabled' : ''} maxlength="32" style="font-family: monospace; font-weight: bold; letter-spacing: 1px;" />
        </td>
        <td>
          <button type="button" class="btn-control btn-start btn-team-save" data-team-id="${t.id}" ${locked ? 'disabled' : ''}>
            Simpan
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-team-save').forEach((btn) => {
      btn.addEventListener('click', () => {
        const teamId = btn.getAttribute('data-team-id');
        saveTeamRow(teamId, btn);
      });
    });
  }

  function saveTeamRow(teamId, btn) {
    const nameInput = document.getElementById(`team-name-${teamId}`);
    const codeInput = document.getElementById(`team-code-${teamId}`);
    if (!nameInput || !codeInput) return;

    const name = nameInput.value.trim();
    const login_code = codeInput.value.trim().toUpperCase();

    if (!name) {
      showTeamManagementMessage('Nama tim tidak boleh kosong', true);
      nameInput.focus();
      return;
    }
    if (!login_code || login_code.length < 6) {
      showTeamManagementMessage('Kode login minimal 6 karakter', true);
      codeInput.focus();
      return;
    }

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';

    adminFetch(`teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, login_code }),
    })
      .then(() => {
        showTeamManagementMessage(`Data Tim #${teamId} (${name}) berhasil disimpan.`);
        btn.textContent = 'Tersimpan ✓';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = originalText;
        }, 1500);
        loadTeamStatus();
      })
      .catch((err) => {
        btn.disabled = false;
        btn.textContent = originalText;
        showTeamManagementMessage(err.message, true);
      });
  }

  const copyCredsBtn = document.getElementById('btn-copy-team-creds');
  if (copyCredsBtn) {
    copyCredsBtn.addEventListener('click', () => {
      if (!currentTeamsList.length) {
        showTeamManagementMessage('Daftar tim belum dimuat', true);
        return;
      }
      const text = currentTeamsList.map((t) => `${t.name}: ${t.login_code}`).join('\n');
      const copySuccess = () => {
        showTeamManagementMessage('Daftar nama dan kode login tim berhasil disalin ke clipboard! Siap dibagikan.');
        const orig = copyCredsBtn.textContent;
        copyCredsBtn.textContent = 'Tersalin ✓';
        setTimeout(() => { copyCredsBtn.textContent = orig; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(copySuccess).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    });
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showTeamManagementMessage('Daftar nama dan kode login tim berhasil disalin ke clipboard!');
    } catch {
      showTeamManagementMessage('Gagal menyalin otomatis. Silakan salin manual.', true);
    }
    document.body.removeChild(ta);
  }

  const regenCodesBtn = document.getElementById('btn-regenerate-team-codes');
  if (regenCodesBtn) {
    regenCodesBtn.addEventListener('click', () => {
      if (!confirm('Peringatan: Seluruh kode login tim akan diacak ulang dengan kode 8 karakter baru!\n\nApakah Anda yakin ingin melanjutkan?')) return;
      adminFetch('teams/regenerate-codes', { method: 'POST' })
        .then((data) => {
          showTeamManagementMessage(data.message || 'Kode login berhasil diacak ulang.');
          loadTeamManagement();
        })
        .catch((err) => {
          showTeamManagementMessage(err.message, true);
        });
    });
  }

  on('phase:changed', () => {
    if (adminToken) loadAdminState();
  });

  on('timer:tick', (data) => {
    if (adminToken) updateTimer(data);
  });

  on('timer:paused', () => {
    if (adminToken) loadAdminState();
  });

  on('timer:resumed', () => {
    if (adminToken) loadAdminState();
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

  const verifyCodeForm = document.getElementById('admin-verify-code-form');
  if (verifyCodeForm) {
    verifyCodeForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = document.getElementById('admin-verify-code-input');
      const resultBox = document.getElementById('admin-verify-result');
      const submitBtn = document.getElementById('btn-admin-verify-submit');
      if (!input || !resultBox) return;

      const code = input.value.trim().toUpperCase();
      if (!code || code.length !== 8) {
        resultBox.className = 'error-slot';
        resultBox.textContent = 'Kode harus terdiri dari 8 karakter.';
        resultBox.classList.remove('hidden');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Memeriksa...';

      adminFetch('verify-code', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
        .then((data) => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Validasi';
          resultBox.classList.remove('hidden');

          if (data.matched) {
            resultBox.className = 'success-slot';
            resultBox.style.padding = '14px 18px';
            resultBox.style.borderRadius = '6px';
            resultBox.style.lineHeight = '1.6';
            const b = data.breakdown;
            resultBox.innerHTML = `
              <div style="font-size: 15px; font-weight: bold; margin-bottom: 6px;">
                ✓ KODE ASLI &amp; TERVERIFIKASI
              </div>
              <div><strong>Tim:</strong> #${data.team.id} ${escapeHtml(data.team.name)} <span class="badge" style="font-size: 11px; margin-left: 6px;">Mode: ${escapeHtml(data.mode)}</span></div>
              <div><strong>Total Skor Sah:</strong> <span style="font-size: 18px; font-weight: bold; color: var(--color-success, #22c55e);">${data.total_score} poin</span></div>
              <div style="margin-top: 6px; font-size: 13px; color: var(--color-text-subtle, #a0aec0);">
                • Level 1: ${b.level_1.score} poin (${b.level_1.correct}/${b.level_1.total_questions} benar)<br>
                • Level 2: ${b.level_2.score} poin (${b.level_2.correct}/${b.level_2.total_questions} benar)<br>
                • Level 3: ${b.level_3.score} poin (${b.level_3.correct}/${b.level_3.total_questions} benar)<br>
                • Final Resolution: ${b.final_resolution ? b.final_resolution.bonus : 0} bonus (pilihan: ${b.final_resolution ? escapeHtml(b.final_resolution.chosen) : '-'})
              </div>
            `;
          } else {
            resultBox.className = 'error-slot';
            resultBox.style.padding = '14px 18px';
            resultBox.style.borderRadius = '6px';
            resultBox.innerHTML = `
              <div style="font-size: 15px; font-weight: bold; margin-bottom: 4px;">
                ✗ KODE TIDAK VALID
              </div>
              <div>Kode <code>${escapeHtml(code)}</code> tidak cocok dengan data tim atau skor manapun di sistem.</div>
              <div style="font-size: 12px; margin-top: 4px; opacity: 0.85;">
                Kemungkinan besar tampilan hasil di layar peserta telah dimanipulasi (misalnya diedit via <em>Inspect Element</em>).
              </div>
            `;
          }
        })
        .catch((err) => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Validasi';
          resultBox.className = 'error-slot';
          resultBox.classList.remove('hidden');
          resultBox.textContent = 'Gagal memvalidasi: ' + err.message;
        });
    });
  }

  const logoutBtn = document.getElementById('btn-admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin keluar dari sesi admin?')) {
        logoutAdmin();
      }
    });
  }

  // Restore saved admin session if present
  const savedToken = getSavedAdminToken();
  if (savedToken) {
    adminToken = savedToken;
    fetch('/api/admin/state', {
      headers: { 'X-Admin-Token': savedToken },
    })
      .then((r) => {
        if (r.ok) {
          activateAdminPanel(savedToken);
        } else {
          logoutAdmin();
        }
      })
      .catch(() => {
        logoutAdmin();
      });
  }
}
