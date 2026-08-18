function initInvestigationView() {
  function loadClues() {
    fetch('/api/clues', {
      headers: teamApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        const list = document.getElementById('clue-list');
        if (!data.clues || data.clues.length === 0) {
          list.innerHTML = '<p class="subtitle">Belum ada clue yang terbuka.</p>';
          return;
        }

        list.innerHTML = data.clues
          .map((c) => {
            const labels = { 1: 'Crime Scene', 2: 'Evidence', 3: 'Deduction' };
            return `<div class="clue-item">
              <div class="clue-level">Clue Level ${c.level} — ${labels[c.level] || ''}</div>
              <div class="clue-text">${escapeClueHtml(c.clue_text)}</div>
            </div>`;
          })
          .join('');
      });
  }

  on('clue:unlocked', (data) => {
    if (data.team_id === teamInfo.id) {
      loadClues();
    }
  });

  return { loadClues };
}

function escapeClueHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));
}
