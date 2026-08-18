function initResultsView() {
  function loadResults() {
    fetch('/api/results', {
      headers: teamApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        const b = data.breakdown;
        const html = `
          <table class="leaderboard-table">
            <tr><td><strong>Level 1</strong></td><td>${b.level_1.correct}/${b.level_1.total_questions} benar</td><td>${b.level_1.score} poin</td></tr>
            <tr><td><strong>Level 2</strong></td><td>${b.level_2.correct}/${b.level_2.total_questions} benar</td><td>${b.level_2.score} poin</td></tr>
            <tr><td><strong>Level 3</strong></td><td>${b.level_3.correct}/${b.level_3.total_questions} benar</td><td>${b.level_3.score} poin</td></tr>
            <tr><td><strong>Final Resolution</strong></td><td>${b.final_resolution ? b.final_resolution.chosen : '-'}</td><td>${b.final_resolution ? b.final_resolution.bonus : 0} bonus</td></tr>
            <tr style="font-weight:700;background:#e8eaf6"><td><strong>TOTAL</strong></td><td></td><td>${b.level_1.score + b.level_2.score + b.level_3.score + (b.final_resolution ? b.final_resolution.bonus : 0)}</td></tr>
          </table>
          <div class="verification-code">Kode Verifikasi: ${data.verification_code}</div>
        `;
        document.getElementById('results-content').innerHTML = html;
      });
  }

  return { loadResults };
}
