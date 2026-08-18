function initResolutionView() {
  let selected = null;

  function loadCandidates() {
    fetch('/api/state')
      .then((r) => r.json())
      .then(() => {
        const candidates = [
          { id: 'A', name: 'Kandidat Alpha', hint: 'Memiliki alibi di malam kejadian' },
          { id: 'B', name: 'Kandidat Beta', hint: 'Dikenal sebagai red herring' },
          { id: 'C', name: 'Kandidat Charlie', hint: 'Latar belakang teknologi & enkripsi' },
          { id: 'D', name: 'Kandidat Delta', hint: 'Sidik jarinya ditemukan di TKP' },
        ];

        const list = document.getElementById('candidate-list');
        list.innerHTML = candidates
          .map((c) => `<div class="candidate-option" data-id="${c.id}" onclick="window._selectCandidate('${c.id}')">
            <strong>${c.name}</strong><br><small>${c.hint}</small>
          </div>`)
          .join('');
      });
  }

  window._selectCandidate = function (id) {
    document.querySelectorAll('.candidate-option').forEach((el) => el.classList.remove('selected'));
    const el = document.querySelector(`.candidate-option[data-id="${id}"]`);
    if (el) el.classList.add('selected');
    selected = id;

    if (selected) {
      submitResolution();
    }
  };

  function submitResolution() {
    fetch('/api/submit-resolution', {
      method: 'POST',
      headers: teamApiHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ candidate: selected }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          return;
        }
        const feedback = document.createElement('p');
        feedback.textContent = data.is_correct
          ? 'Benar! +30 poin bonus'
          : 'Salah. 0 poin bonus';
        feedback.className = data.is_correct ? 'feedback-correct' : 'feedback-wrong';
        document.getElementById('candidate-list').appendChild(feedback);

        document.querySelectorAll('.candidate-option').forEach((el) => {
          el.style.pointerEvents = 'none';
        });
      });
  }

  on('timer:tick', (data) => {
    if (data.phase === 'resolution') {
      const mins = Math.floor(data.remaining_seconds / 60);
      const secs = data.remaining_seconds % 60;
      document.getElementById('resolution-timer').textContent =
        String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
      document.getElementById('header-timer').textContent =
        String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
      document.getElementById('header-timer').classList.remove('hidden');
    }
  });

  return { loadCandidates };
}
