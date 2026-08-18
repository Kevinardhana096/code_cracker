function initLogin(teamInfo, onSuccess) {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('login-code').value.trim();
    if (!code) return;

    errorEl.classList.add('hidden');
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = '...';

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then((res) => res.json())
      .then((data) => {
        btn.disabled = false;
        btn.textContent = 'Bergabung';

        if (data.error) {
          errorEl.textContent = data.error;
          errorEl.classList.remove('hidden');
          return;
        }

        teamInfo.id = data.team_id;
        teamInfo.name = data.name;
        teamInfo.code = data.code;
        teamInfo.token = data.token;

        try {
          localStorage.setItem('code-cracker-team-session', JSON.stringify({
            id: data.team_id,
            name: data.name,
            code: data.code,
            token: data.token,
          }));
        } catch (_) {
          // Session recovery is best-effort; the server remains authoritative.
        }

        document.getElementById('header-team-name').textContent = data.name;
        const teamBadge = document.getElementById('header-team-badge');
        if (teamBadge) teamBadge.classList.remove('hidden');
        document.getElementById('waiting-team-label').textContent = `Tim: ${data.name}`;

        emit('auth', { team_id: data.team_id, token: data.token });

        if (onSuccess) onSuccess(data);
      })
      .catch(() => {
        btn.disabled = false;
        btn.textContent = 'Bergabung';
        errorEl.textContent = 'Gagal terhubung ke server';
        errorEl.classList.remove('hidden');
      });
  });
}
