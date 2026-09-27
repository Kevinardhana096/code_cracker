function initResolutionView() {
  let selected = null;
  let isLocked = false;

  const candidates = [
    { id: 'A', name: 'Kandidat Alpha', hint: 'Memiliki alibi di malam kejadian' },
    { id: 'B', name: 'Kandidat Beta', hint: 'Dikenal sebagai red herring' },
    { id: 'C', name: 'Kandidat Charlie', hint: 'Latar belakang teknologi & enkripsi' },
    { id: 'D', name: 'Kandidat Delta', hint: 'Sidik jarinya ditemukan di TKP' },
  ];

  function setStatus(message, type = 'active') {
    const statusEl = document.getElementById('resolution-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `resolution-status-box ${type}`;
  }

  function renderCandidates() {
    const list = document.getElementById('candidate-list');
    if (!list) return;
    list.innerHTML = candidates
      .map((c) => {
        const isSelected = selected === c.id;
        return `<div class="candidate-option ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}" data-id="${c.id}" onclick="window._selectCandidate('${c.id}')">
          <strong>${c.name}</strong><br><small>${c.hint}</small>
        </div>`;
      })
      .join('');
  }

  function lockUI(message) {
    isLocked = true;
    renderCandidates();
    document.querySelectorAll('.candidate-option').forEach((el) => {
      el.style.pointerEvents = 'none';
    });
    if (message) {
      setStatus(message, 'locked');
    }
  }

  function unlockUI() {
    isLocked = false;
    renderCandidates();
    document.querySelectorAll('.candidate-option').forEach((el) => {
      el.style.pointerEvents = 'auto';
    });
  }

  function loadCandidates() {
    fetch('/api/resolution', {
      headers: teamApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        selected = data.chosen_candidate || null;
        if (data.is_locked) {
          lockUI(
            selected
              ? `Babak akhir telah selesai. Pilihan tim terkunci: Kandidat ${selected}. Menunggu pengumuman hasil akhir.`
              : 'Babak akhir telah selesai. Waktu habis dan jawaban telah dikunci.'
          );
        } else {
          unlockUI();
          if (selected) {
            const cand = candidates.find((c) => c.id === selected);
            setStatus(
              `✓ Pilihan tersimpan: Kandidat ${selected} (${cand ? cand.name : ''}). Kamu dapat mengubah pilihan kapan saja selama waktu masih ada.`,
              'active'
            );
          } else {
            setStatus('Pilih kandidat yang menurut tim kamu adalah The Lost Champion. Pilihan dapat diubah bebas selama waktu deduksi masih berjalan.', 'active');
          }
        }
      })
      .catch(() => {
        renderCandidates();
      });
  }

  window._selectCandidate = function (id) {
    if (isLocked) return;

    selected = id;
    renderCandidates();
    const cand = candidates.find((c) => c.id === id);
    setStatus(`Menyimpan pilihan: Kandidat ${id} (${cand ? cand.name : ''})...`, 'active');

    submitResolution(id);
  };

  function submitResolution(candidateId) {
    fetch('/api/submit-resolution', {
      method: 'POST',
      headers: teamApiHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ candidate: candidateId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          if (data.error.includes('Waktu') || data.error.includes('Not in resolution')) {
            lockUI('Waktu babak akhir telah habis. Pilihan terakhir telah dikunci oleh server.');
          } else {
            setStatus(data.error, 'error');
          }
          return;
        }

        const cand = candidates.find((c) => c.id === candidateId);
        setStatus(
          `✓ Pilihan tersimpan: Kandidat ${candidateId} (${cand ? cand.name : ''}). Pilihan dapat diubah bebas selama waktu masih berjalan.`,
          'active'
        );
      })
      .catch(() => {
        setStatus('Koneksi terganggu saat menyimpan pilihan. Silakan klik ulang untuk memastikan pilihan tersimpan.', 'error');
      });
  }

  on('timer:tick', (data) => {
    if (data.phase === 'resolution') {
      const mins = Math.floor(data.remaining_seconds / 60);
      const secs = data.remaining_seconds % 60;
      const timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
      const timerEl = document.getElementById('resolution-timer');
      if (timerEl) timerEl.textContent = timeStr;
      const headerTimer = document.getElementById('header-timer');
      if (headerTimer) {
        headerTimer.textContent = timeStr;
        headerTimer.classList.remove('hidden');
      }
    }
  });

  on('timer:expired', (data) => {
    if (data && data.phase === 'resolution') {
      const timerEl = document.getElementById('resolution-timer');
      if (timerEl) timerEl.textContent = '00:00';
      lockUI(
        selected
          ? `Waktu babak akhir telah habis. Pilihan tim (Kandidat ${selected}) telah dikunci oleh server.`
          : 'Waktu babak akhir telah habis. Jawaban telah dikunci.'
      );
    }
  });

  return { loadCandidates };
}
