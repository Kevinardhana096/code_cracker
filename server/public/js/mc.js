/* ==========================================================================
   CODE CRACKER — BATTLE OF CHAMPIONS 2026
   MC / Operator Remote Controller Script
   (Interactive Cue Card System & Stage Screen Synchronizer)
   ========================================================================== */

(function () {
  'use strict';

  // 10 Slides Complete Metadata & Cue Cards for MC
  const slidesData = [
    {
      id: 0,
      title: 'Cover — Case File #001: The Lost Champion',
      shortTitle: 'Cover Kasus',
      summary: 'Judul resmi Code Cracker: The Investigation Ladder & pengenalan tema detektif.',
      phaseMap: 'lobby',
      objective: 'Membuka babak dengan energi tinggi, membakar antusiasme 15 tim detektif, dan memaparkan tema misteri The Lost Champion.',
      points: [
        'Sapa hangat seluruh juri, panitia, dan 15 tim detektif terbaik yang berhasil lolos dari Tahap II (Suspect Dossier).',
        'Sampaikan premis kasus: Tepat 24 jam sebelum Grand Final Battle of Champions, rekam jejak juara bertahan menghilang misterius dari basis data.',
        'Jelaskan bahwa misi setiap tim hari ini adalah menyelesaikan 3 tingkat tantangan matematika untuk mengumpulkan petunjuk bukti forensik.'
      ],
      tips: 'Tunggu seluruh tim berada di meja masing-masing dengan perangkat aktif sebelum melangkah ke slide gambaran umum.'
    },
    {
      id: 1,
      title: 'Gambaran Umum — Misi Tim Investigator',
      shortTitle: 'Gambaran Umum',
      summary: '15 Tim, 3 Level Matematika (Easy-Medium-Hard), dan Bonus Investigasi +30 Poin.',
      objective: 'Menjelaskan konsep penilaian ganda: keakuratan matematika sebagai poin fondasi dan ketajaman deduksi sebagai penentu.',
      points: [
        'Jelaskan bahwa peserta bertindak sebagai tim detektif investigasi khusus.',
        'Ada 3 level matematika bertingkat: Easy (TKP) ➔ Medium (Dekode) ➔ Hard (Deduksi). Jawaban benar menghasilkan poin sekaligus membuka clue.',
        'Tegaskan: Penilaian utama adalah akumulasi poin matematika, namun jawaban deduksi akhir yang tepat bernilai +30 poin krusial penentu kemenangan!'
      ],
      tips: 'Tekankan kalimat: "Semakin banyak soal yang dijawab benar, semakin spesifik petunjuk bukti yang kalian dapatkan di Investigation Board."'
    },
    {
      id: 2,
      title: 'Regulasi & Tata Tertib Pelaksanaan',
      shortTitle: 'Tata Tertib',
      summary: '1 Akun & 1 Perangkat per tim, Jaringan Offline Hotspot Lokal, Sanksi Diskualifikasi (DQ).',
      objective: 'Menegaskan aturan main resmi demi menjamin integritas dan keadilan kompetisi tingkat tinggi.',
      points: [
        'Aturan Perangkat: Tiap tim (3 orang) HANYA diperbolehkan menggunakan 1 perangkat aktif resmi yang sudah disetujui panitia.',
        'Koneksi: Wajib terhubung ke Hotspot Lokal Panitia. Seluruh perangkat WAJIB Mode Pesawat (Airplane Mode on, WiFi only).',
        'Mulai Serentak: Sistem server akan membuka dan mengunci setiap level serentak secara otomatis.',
        'Sanksi Tegas: Diskualifikasi langsung bagi tim yang bekerja sama antartim, menerima bantuan dari luar, atau berselancar di internet liar.'
      ],
      tips: 'Bacakan aturan diskualifikasi dengan intonasi tegas dan berwibawa.'
    },
    {
      id: 3,
      title: 'Peta Alur Permainan (10 Tahapan)',
      shortTitle: 'Peta 10 Alur',
      summary: 'Roadmap investigasi berurutan dari Briefing hingga Pengumuman Leaderboard Top 5.',
      objective: 'Memberikan gambaran alur waktu yang jelas agar tim dapat mengatur ritme dan strategi kerja sama internal.',
      points: [
        'Paparkan bahwa kompetisi berjalan dalam 10 etape terstruktur.',
        'Ritme pengerjaan: Level 1 (5 mnt) ➔ Baca Clue 1 (30 dtk) ➔ Level 2 (7 mnt) ➔ Baca Clue 2 (30 dtk) ➔ Level 3 (8 mnt) ➔ Baca Clue 3 (30 dtk) ➔ Final Resolution (3 mnt).',
        'Ingatkan peserta bahwa waktu membaca clue sangat singkat (30 detik), sehingga tim harus segera mencocokkan petunjuk dengan berkas kasus.'
      ],
      tips: 'Ajak tim membagi tugas: siapa yang fokus kalkulator/oret-oretan, siapa yang menganalisis petunjuk investigasi.'
    },
    {
      id: 4,
      title: 'Berkas Kasus — Case File #001 (Tabel Kandidat)',
      shortTitle: 'Case File #001',
      summary: 'Tabel 4 Kandidat Terduga: Alpha Team, Atlas Team, Aether Team, dan Aurora Team.',
      phaseMap: 'case_file',
      objective: 'Mengarahkan tim untuk meneliti lembar fisik kasus dan memahami 4 kandidat terduga Champion.',
      points: [
        'Instruksikan seluruh tim membuka berkas fisik "Case File #001: The Lost Champion" yang telah disediakan di atas meja.',
        'Tunjukkan tabel 4 kandidat terduga di layar: Alpha Team, Atlas Team, Aether Team, dan Aurora Team.',
        'Perhatikan detail parameter: Divisi asal, Rata-rata Skor (92, 90, 88), Status Juara Logika, dan Status Juara Bahasa Inggris.',
        'Petunjuk yang dibuka di setiap level nantinya akan mengeliminasi kandidat hingga tersisa 1 Champion sejati.'
      ],
      tips: 'Beri waktu 2 menit bagi tim untuk membaca berkas fisik sebelum tombol Level 1 diaktifkan oleh admin.'
    },
    {
      id: 5,
      title: 'Level 1: Analisis TKP (Crime Scene Analysis)',
      shortTitle: 'Level 1: TKP',
      summary: '5 Soal Easy, Durasi 5 Menit. Benar: +10, Salah: -2, Kosong: -1. Maksimal 50 Poin.',
      phaseMap: 'level_1',
      objective: 'Memandu dimulainya tantangan Level 1 matematika tingkat dasar dan mengingatkan skema penalti.',
      points: [
        'Umumkan: Level 1 resmi dimulai! Durasi 5 menit dengan 5 soal pilihan ganda (Easy).',
        'Ingatkan aturan skor: Jawaban Benar bernilai +10 poin, Salah terkena penalti -2 poin, Tidak Menjawab terkena -1 poin.',
        'Waktu berjalan serentak di layar perangkat tim dan akan terkunci otomatis saat waktu habis.',
        'Setelah level 1 selesai, sistem akan langsung membuka Clue 1 di Investigation Board!'
      ],
      tips: 'Ingatkan peserta untuk tidak membiarkan soal kosong tanpa strategi karena kosong tetap terkena penalti -1.'
    },
    {
      id: 6,
      title: 'Level 2: Dekode Bukti (Evidence Decoding)',
      shortTitle: 'Level 2: Dekode',
      summary: '5 Soal Medium, Durasi 7 Menit. Benar: +20, Salah: -4, Kosong: -2. Maksimal 100 Poin.',
      phaseMap: 'level_2',
      objective: 'Memandu masuknya tim ke level tantangan menengah dengan bobot poin ganda.',
      points: [
        'Umumkan: Selamat datang di Level 2! Tingkat kesulitan meningkat menjadi Medium (Aljabar, Barisan, Persamaan).',
        'Durasi pengerjaan: 7 Menit untuk 5 soal pilihan ganda.',
        'Skema poin berlipat: Jawaban Benar +20 poin, Salah -4 poin, Kosong -2 poin. Maksimal 100 poin!',
        'Arahkan tim menggabungkan petunjuk Clue 1 dan Clue 2 untuk mulai mencoret kandidat yang mustahil.'
      ],
      tips: 'Pantau timer di konsol MC ini; jika tersisa 1 menit, berikan peringatan hitung mundur suara.'
    },
    {
      id: 7,
      title: 'Level 3: Deduksi Akhir (Final Deduction)',
      shortTitle: 'Level 3: Deduksi',
      summary: '5 Soal Hard HOTS, Durasi 8 Menit. Benar: +30, Salah: -6, Kosong: -3. Maksimal 150 Poin.',
      phaseMap: 'level_3',
      objective: 'Membangun tensi klimaks: tantangan penalaran tertinggi dan kesempatan terakhir mendulang poin matematika.',
      points: [
        'Umumkan babak matematika penentu: Level 3 Hard / HOTS resmi dibuka!',
        'Durasi: 8 Menit dengan bobot tertinggi sepanjang kompetisi.',
        'Skema skor taruhan tinggi: Benar +30 poin, Salah -6 poin, Kosong -3 poin. Maksimal 150 poin!',
        'Ini adalah kesempatan emas untuk membalikkan posisi klasemen dan membuka Clue 3 pamungkas.'
      ],
      tips: 'Beri semangat pada tim yang tertinggal karena 1 soal benar di Level 3 setara dengan 3 soal benar di Level 1!'
    },
    {
      id: 8,
      title: 'Final Case Resolution (Babak Penentuan Champion)',
      shortTitle: 'Final Resolution',
      summary: '3 Menit Diskusi Tim. Pilih 1 dari 4 Kandidat. Benar: +30 Poin, Salah: 0 (Tanpa Penalti).',
      phaseMap: 'resolution',
      objective: 'Memandu sesi pemecahan kasus utama: mengunci tebakan identitas The Lost Champion.',
      points: [
        'Waktu matematika selesai! Kini saatnya menguji ketajaman deduksi tim detektif.',
        'Pertanyaan Resmi: Berdasarkan seluruh hasil investigasi, siapakah Champion Battle of Champions yang sebenarnya?',
        'Kandidat: [A] Alpha Team, [B] Atlas Team, [C] Aether Team, atau [D] Aurora Team.',
        'Setiap tim memiliki 3 MENIT untuk berdiskusi dan mengunci 1 pilihan akhir di perangkat masing-masing.',
        'Bonus Benar: +30 Poin langsung ditambahkan ke total skor! Jawaban salah bernilai 0 (tanpa penalti).'
      ],
      tips: 'Hitung mundur 10 detik terakhir sesi resolusi bersama seluruh audiens aula.'
    },
    {
      id: 9,
      title: 'Penentuan Kelolosan & Leaderboard Final',
      shortTitle: 'Leaderboard & Top 5',
      summary: 'Hanya TOP 5 yang lolos ke babak selanjutnya. Dilengkapi Kode Hash Verifikasi Digital.',
      phaseMap: 'finished',
      objective: 'Mengumumkan 5 tim terbaik yang lolos kualifikasi serta menjelaskan transparansi audit skor.',
      points: [
        'Umumkan bahwa seluruh jawaban telah diverifikasi dan dikalkulasi secara instan oleh sistem server.',
        'Kualifikasi Ketat: Hanya TOP 5 tim dengan total akumulasi poin tertinggi yang berhak melaju ke babak berikutnya!',
        'Transparansi Digital: Setiap tim dapat melihat Kode Verifikasi Digital (Hash) di layar perangkatnya sebagai bukti keaslian audit.',
        'Jika terdapat total poin sama, sistem menerapkan hierarki Tie-Breaker: (1) Total benar terbanyak, (2) Benar di Level 3 terbanyak, (3) Waktu submit tercepat.'
      ],
      tips: 'Arahkan perhatian audiens ke layar proyektor leaderboard panggung sebelum menyebutkan nama 5 tim pemenang.'
    }
  ];

  let currentSlideIndex = 0;
  const totalSlides = slidesData.length;
  let socket = null;
  let autoSyncWithGame = false;

  // DOM Elements
  const connStatusEl = document.getElementById('conn-status');
  const connTextEl = document.getElementById('conn-text');
  const livePhaseEl = document.getElementById('live-phase-display');
  const slideNumTextEl = document.getElementById('slide-num-text');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const jumpSelect = document.getElementById('jump-select');
  const syncCheckbox = document.getElementById('sync-checkbox');

  // Cue card elements
  const cueSlideTitleEl = document.getElementById('cue-slide-title');
  const cueObjectiveEl = document.getElementById('cue-objective-text');
  const cuePointsListEl = document.getElementById('cue-points-list');
  const cueTipsEl = document.getElementById('cue-tips-text');

  // Previews
  const currentPreviewEl = document.getElementById('current-slide-preview');
  const nextPreviewEl = document.getElementById('next-slide-preview');
  const slidesGridEl = document.getElementById('slides-grid');

  // Phase to slide index map
  const phaseMap = {
    'lobby': 0,
    'case_file': 4,
    'level_1': 5,
    'clue_1': 5,
    'level_2': 6,
    'clue_2': 6,
    'level_3': 7,
    'clue_3': 7,
    'resolution': 8,
    'finished': 9
  };

  // Build Jump Dropdown and 10 Slides Grid
  function initNavComponents() {
    jumpSelect.innerHTML = '';
    slidesGridEl.innerHTML = '';

    slidesData.forEach((s, idx) => {
      // Option in dropdown
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Slide ${idx + 1}: ${s.shortTitle}`;
      jumpSelect.appendChild(opt);

      // Card item in grid
      const item = document.createElement('div');
      item.className = `slide-grid-item ${idx === 0 ? 'active' : ''}`;
      item.id = `grid-item-${idx}`;
      item.innerHTML = `
        <div class="grid-item-num">SLIDE 0${idx + 1}</div>
        <div class="grid-item-title">${s.shortTitle}</div>
      `;
      item.addEventListener('click', () => {
        changeSlide(idx, true);
      });
      slidesGridEl.appendChild(item);
    });

    renderCurrentState();
  }

  // Change Slide and optionally emit to Socket
  function changeSlide(index, emitSocket = true) {
    if (index < 0 || index >= totalSlides) return;
    currentSlideIndex = index;
    renderCurrentState();

    if (emitSocket && socket && socket.connected) {
      socket.emit('stage:set_slide', { slide: currentSlideIndex });
    }
  }

  // Update All UI Views based on currentSlideIndex
  function renderCurrentState() {
    const pad = (n) => String(n).padStart(2, '0');
    const slide = slidesData[currentSlideIndex];
    const nextSlide = currentSlideIndex < totalSlides - 1 ? slidesData[currentSlideIndex + 1] : null;

    // Header / Indicator
    slideNumTextEl.textContent = `SLIDE ${pad(currentSlideIndex + 1)} / ${pad(totalSlides)} — ${slide.shortTitle}`;

    // Prev / Next button states
    btnPrev.disabled = currentSlideIndex === 0;
    btnNext.disabled = currentSlideIndex === totalSlides - 1;

    // Dropdown value
    jumpSelect.value = currentSlideIndex;

    // Grid active state
    document.querySelectorAll('.slide-grid-item').forEach((item, idx) => {
      item.classList.toggle('active', idx === currentSlideIndex);
    });

    // Cue Card Details
    cueSlideTitleEl.textContent = `Slide ${currentSlideIndex + 1}: ${slide.title}`;
    cueObjectiveEl.textContent = slide.objective;
    cueTipsEl.textContent = slide.tips;

    cuePointsListEl.innerHTML = '';
    slide.points.forEach((pt) => {
      const li = document.createElement('li');
      li.textContent = pt;
      cuePointsListEl.appendChild(li);
    });

    // Stage Previews
    currentPreviewEl.innerHTML = `
      <div class="preview-title">Slide ${currentSlideIndex + 1}: ${slide.title}</div>
      <div class="preview-desc">${slide.summary}</div>
    `;

    if (nextSlide) {
      nextPreviewEl.innerHTML = `
        <div class="preview-title" style="color: var(--teal-light);">Slide ${nextSlide.id + 1}: ${nextSlide.title}</div>
        <div class="preview-desc">${nextSlide.summary}</div>
      `;
    } else {
      nextPreviewEl.innerHTML = `
        <div class="preview-title" style="color: var(--text-low);">Akhir Slide Deck</div>
        <div class="preview-desc">Tidak ada slide berikutnya (Sesi Selesai).</div>
      `;
    }
  }

  // Button Listeners
  btnPrev.addEventListener('click', () => {
    if (currentSlideIndex > 0) {
      changeSlide(currentSlideIndex - 1, true);
    }
  });

  btnNext.addEventListener('click', () => {
    if (currentSlideIndex < totalSlides - 1) {
      changeSlide(currentSlideIndex + 1, true);
    }
  });

  jumpSelect.addEventListener('change', (e) => {
    changeSlide(Number(e.target.value), true);
  });

  syncCheckbox.addEventListener('change', (e) => {
    autoSyncWithGame = e.target.checked;
  });

  // Keyboard navigation on controller
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      if (currentSlideIndex < totalSlides - 1) changeSlide(currentSlideIndex + 1, true);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      if (currentSlideIndex > 0) changeSlide(currentSlideIndex - 1, true);
    }
  });

  // Socket.IO Setup
  if (typeof io !== 'undefined') {
    socket = io();

    socket.on('connect', () => {
      connStatusEl.className = 'conn-pill online';
      connTextEl.textContent = 'ONLINE';

      // Ask for latest slide
      socket.emit('stage:get_slide');

      // Fetch initial game state
      fetch('/api/state')
        .then((r) => r.json())
        .then((state) => handleGameState(state))
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      connStatusEl.className = 'conn-pill offline';
      connTextEl.textContent = 'OFFLINE';
    });

    socket.on('stage:init', (data) => {
      if (data && typeof data.slide === 'number') {
        changeSlide(data.slide, false);
      }
    });

    socket.on('stage:slide', (data) => {
      if (data && typeof data.slide === 'number') {
        changeSlide(data.slide, false);
      }
    });

    socket.on('phase:changed', (data) => {
      handleGameState(data);
    });

    socket.on('timer:tick', (data) => {
      if (!livePhaseEl) return;
      const min = Math.floor(data.remaining_seconds / 60);
      const sec = data.remaining_seconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      const timeStr = `${pad(min)}:${pad(sec)}`;
      const phaseLabel = (data.phase || '').toUpperCase().replace(/_/g, ' ');
      livePhaseEl.textContent = `${phaseLabel} [${timeStr}]`;
    });

    function handleGameState(state) {
      if (!state || !state.phase) return;
      const phaseLabel = state.phase.toUpperCase().replace(/_/g, ' ');
      livePhaseEl.textContent = phaseLabel;

      if (autoSyncWithGame && phaseMap[state.phase] !== undefined) {
        changeSlide(phaseMap[state.phase], true);
      }
    }
  }

  // Initialize
  initNavComponents();
})();
