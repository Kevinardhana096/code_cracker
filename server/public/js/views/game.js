function initGameView() {
  let questions = [];
  let currentQ = 0;
  let levelInfo = null;
  let modeInfo = null;
  let finalized = false;
  let draftAnswers = {};
  let saveTimer = null;

  function draftStorageKey() {
    return `code-cracker-level-draft-${teamInfo.id}-${modeInfo || 'unknown'}-${levelInfo || 'unknown'}`;
  }

  function readLocalDraft() {
    try {
      const value = localStorage.getItem(draftStorageKey());
      const parsed = value ? JSON.parse(value) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeLocalDraft() {
    try {
      localStorage.setItem(draftStorageKey(), JSON.stringify(draftAnswers));
    } catch (_) {
      // Local draft is only a recovery aid; server state remains authoritative.
    }
  }

  function setDraftStatus(message, className = '') {
    const status = document.getElementById('answer-draft-status');
    if (!status) return;
    status.textContent = message;
    status.className = `draft-status ${className}`.trim();
  }

  function selectedCount() {
    return Object.keys(draftAnswers).length;
  }

  function renderMathText(container, value) {
    container.replaceChildren();
    const source = String(value || '');
    const pattern = /(\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;
    let cursor = 0;
    let match;

    while ((match = pattern.exec(source)) !== null) {
      if (match.index > cursor) {
        container.appendChild(document.createTextNode(source.slice(cursor, match.index)));
      }

      const token = match[0];
      const displayMode = token.startsWith('$$') || token.startsWith('\\[');
      const latex = displayMode
        ? token.replace(/^\$\$|\$\$$/g, '').replace(/^\\\[|\\\]$/g, '')
        : token.replace(/^\\\(|\\\)$/g, '');
      const math = document.createElement(displayMode ? 'div' : 'span');
      if (window.katex) {
        window.katex.render(latex, math, { displayMode, throwOnError: false });
      } else {
        math.textContent = token;
      }
      container.appendChild(math);
      cursor = match.index + token.length;
    }

    if (cursor < source.length) {
      container.appendChild(document.createTextNode(source.slice(cursor)));
    }
  }

  function loadQuestions() {
    fetch('/api/questions', {
      headers: teamApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setDraftStatus(data.error, 'draft-error');
          return;
        }

        const isNewLevel = levelInfo !== data.level || modeInfo !== data.mode;
        if (isNewLevel) {
          currentQ = 0;
        }

        questions = data.questions || [];
        levelInfo = data.level;
        modeInfo = data.mode;
        finalized = Boolean(data.finalized);
        const serverDraft = {};
        questions.forEach((q) => {
          if (q.selected_option) serverDraft[String(q.id)] = q.selected_option;
        });
        const localDraft = readLocalDraft();
        draftAnswers = data.draft_updated_at
          ? serverDraft
          : { ...localDraft, ...serverDraft };

        renderNav();
        showQuestion(Math.min(currentQ, Math.max(questions.length - 1, 0)));
        updateLevelBadge(data.level);
        fetchScore();

        if (typeof data.remaining_seconds === 'number') {
          const rem = Math.max(0, data.remaining_seconds);
          const mins = Math.floor(rem / 60);
          const secs = rem % 60;
          const gameTimer = document.getElementById('game-timer');
          if (gameTimer) gameTimer.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        }

        if (finalized) {
          setDraftStatus('Level sudah difinalisasi oleh server.', 'draft-finalized');
        } else {
          setDraftStatus(`${selectedCount()} dari ${questions.length} opsi dipilih. Pilihan dapat diubah selama timer aktif.`);
        }
      })
      .catch(() => setDraftStatus('Soal tidak dapat dimuat. Coba sambungkan kembali.', 'draft-error'));
  }

  function renderNav() {
    const nav = document.getElementById('question-nav');
    nav.innerHTML = '';
    questions.forEach((q, i) => {
      const btn = document.createElement('button');
      btn.className = 'question-nav-btn';
      btn.type = 'button';
      btn.textContent = i + 1;
      if (i === currentQ) btn.classList.add('active');
      if (draftAnswers[String(q.id)]) btn.classList.add('answered');
      btn.addEventListener('click', () => showQuestion(i));
      nav.appendChild(btn);
    });
  }

  function renderOptions(question) {
    const container = document.getElementById('answer-options');
    container.innerHTML = '';

    (question.options || []).forEach((option) => {
      const label = document.createElement('label');
      label.className = 'option-choice' + (option.image_url ? ' has-image' : '');

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `level-option-${question.id}`;
      input.value = option.id;
      input.checked = draftAnswers[String(question.id)] === option.id;
      input.disabled = finalized;

      const letter = document.createElement('span');
      letter.className = 'option-letter';
      letter.textContent = option.id;

      const content = document.createElement('div');
      content.className = 'option-content';

      if (option.text) {
        const text = document.createElement('span');
        text.className = 'option-text';
        renderMathText(text, option.text);
        content.appendChild(text);
      }

      if (option.image_url) {
        const image = document.createElement('img');
        image.className = 'option-image';
        image.src = option.image_url;
        image.alt = `Gambar opsi ${option.id}`;
        image.onerror = () => {
          image.remove();
          label.classList.remove('has-image');
        };
        content.appendChild(image);
      }

      input.addEventListener('change', () => {
        if (finalized) return;
        draftAnswers[String(question.id)] = option.id;
        writeLocalDraft();
        renderNav();
        setDraftStatus(`${selectedCount()} dari ${questions.length} opsi dipilih. Menyimpan draft level...`);
        scheduleDraftSave();
      });

      label.appendChild(input);
      label.appendChild(letter);
      label.appendChild(content);
      container.appendChild(label);
    });
  }

  function showQuestion(index) {
    if (!questions[index]) return;
    currentQ = index;
    const q = questions[index];
    document.getElementById('question-number').textContent = `Soal ${index + 1} dari ${questions.length} · ${q.topic} · ${q.points} poin`;
    renderMathText(document.getElementById('question-text'), q.question_text);

    const imageWrap = document.getElementById('question-image-wrap');
    const image = document.getElementById('question-image');
    image.onload = () => imageWrap.classList.remove('hidden');
    image.onerror = () => imageWrap.classList.add('hidden');
    if (q.image_url) {
      image.alt = `Ilustrasi soal ${index + 1}`;
      image.src = q.image_url;
    } else {
      image.removeAttribute('src');
      imageWrap.classList.add('hidden');
    }

    renderOptions(q);
    renderNav();
    updateNavButtons();
  }

  function updateNavButtons() {
    const prevBtn = document.getElementById('btn-prev-question');
    const nextBtn = document.getElementById('btn-next-question');
    const indicator = document.getElementById('question-nav-indicator');

    const total = questions.length;
    if (prevBtn) {
      prevBtn.disabled = currentQ <= 0 || total === 0;
    }
    if (nextBtn) {
      nextBtn.disabled = currentQ >= total - 1 || total === 0;
    }
    if (indicator) {
      indicator.textContent = total > 0 ? `${currentQ + 1} / ${total}` : '- / -';
    }
  }

  function prevQuestion() {
    if (currentQ > 0) {
      showQuestion(currentQ - 1);
    }
  }

  function nextQuestion() {
    if (currentQ < questions.length - 1) {
      showQuestion(currentQ + 1);
    }
  }

  const prevBtn = document.getElementById('btn-prev-question');
  const nextBtn = document.getElementById('btn-next-question');
  if (prevBtn) prevBtn.addEventListener('click', prevQuestion);
  if (nextBtn) nextBtn.addEventListener('click', nextQuestion);

  document.addEventListener('keydown', (e) => {
    const gameSection = document.getElementById('view-game');
    if (!gameSection || gameSection.classList.contains('hidden')) return;

    const activeEl = document.activeElement;
    if (activeEl) {
      const tag = activeEl.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    }

    if (e.key === 'ArrowLeft') {
      prevQuestion();
    } else if (e.key === 'ArrowRight') {
      nextQuestion();
    }
  });

  updateNavButtons();

  function scheduleDraftSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 250);
  }

  function saveDraft() {
    if (finalized) return;
    fetch('/api/level-draft', {
      method: 'POST',
      headers: teamApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ answers: draftAnswers }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setDraftStatus(data.error, 'draft-error');
          return;
        }
        setDraftStatus(`${data.selected_count} dari ${data.total_questions} opsi dipilih. Draft tersimpan.`);
      })
      .catch(() => setDraftStatus('Draft lokal tersimpan; sinkronisasi server menunggu koneksi.', 'draft-warning'));
  }

  function disableOptions() {
    document.querySelectorAll('#answer-options input').forEach((input) => {
      input.disabled = true;
    });
    setDraftStatus('Waktu habis. Jawaban level sedang difinalisasi oleh server.', 'draft-finalized');
    try {
      localStorage.removeItem(draftStorageKey());
    } catch (_) {
      // Ignore local storage failures.
    }
  }

  on('timer:expired', (data) => {
    if (data.phase === `level_${levelInfo}`) disableOptions();
  });

  on('score:updated', (data) => {
    if (data.team_id === teamInfo.id) fetchScore();
  });

  on('leaderboard:update', () => fetchScore());

  function fetchScore() {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => {
        const me = data.leaderboard.find((t) => t.team_id === teamInfo.id);
        if (me) document.getElementById('game-score').textContent = me.total;
      });
  }

  function updateLevelBadge(level) {
    const badge = document.getElementById('game-level-badge');
    const names = { 1: 'LEVEL 1 · CRIME SCENE', 2: 'LEVEL 2 · EVIDENCE', 3: 'LEVEL 3 · DEDUCTION' };
    badge.textContent = names[level] || 'LEVEL ' + level;
  }

  return { loadQuestions, fetchScore, showQuestion, prevQuestion, nextQuestion, getCurrentQ: () => currentQ };
}
