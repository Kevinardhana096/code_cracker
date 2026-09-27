function initResultsView() {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function loadResults() {
    fetch('/api/results', {
      headers: teamApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        const b = data.breakdown;
        const total = b.level_1.score + b.level_2.score + b.level_3.score + (b.final_resolution ? b.final_resolution.bonus : 0);
        const totalCorrect = (b.level_1.correct || 0) + (b.level_2.correct || 0) + (b.level_3.correct || 0);
        const totalQuestions = (b.level_1.total_questions || 0) + (b.level_2.total_questions || 0) + (b.level_3.total_questions || 0);

        const html = `
          <div class="results-score-hero">
            <div class="results-score-label">TOTAL SKOR AKHIR</div>
            <div class="results-score-value">${total} <span class="results-score-unit">POIN</span></div>
            <div class="results-score-meta">
              ${escapeHtml(data.team_name || 'Tim')} · ${totalCorrect} dari ${totalQuestions} soal terjawab benar
            </div>
          </div>

          <div class="results-table-wrap">
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>BABAK / LEVEL</th>
                  <th>KETEPATAN</th>
                  <th style="text-align: right;">POIN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Level 1</strong></td>
                  <td>${b.level_1.correct}/${b.level_1.total_questions} benar</td>
                  <td style="text-align: right;"><strong>${b.level_1.score}</strong> poin</td>
                </tr>
                <tr>
                  <td><strong>Level 2</strong></td>
                  <td>${b.level_2.correct}/${b.level_2.total_questions} benar</td>
                  <td style="text-align: right;"><strong>${b.level_2.score}</strong> poin</td>
                </tr>
                <tr>
                  <td><strong>Level 3</strong></td>
                  <td>${b.level_3.correct}/${b.level_3.total_questions} benar</td>
                  <td style="text-align: right;"><strong>${b.level_3.score}</strong> poin</td>
                </tr>
                <tr>
                  <td><strong>Final Resolution</strong></td>
                  <td>Kandidat ${b.final_resolution ? escapeHtml(b.final_resolution.chosen) : '-'}</td>
                  <td style="text-align: right;">+${b.final_resolution ? b.final_resolution.bonus : 0} bonus</td>
                </tr>
                <tr class="results-total-row">
                  <td><strong>TOTAL SKOR</strong></td>
                  <td><strong>${totalCorrect}/${totalQuestions} benar</strong></td>
                  <td style="text-align: right;"><strong>${total} POIN</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
        document.getElementById('results-content').innerHTML = html;
        const verifEl = document.getElementById('verification-code');
        if (verifEl) verifEl.textContent = data.verification_code;
      });
  }

  return { loadResults };
}
