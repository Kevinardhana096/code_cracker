/* ==========================================================================
   CODE CRACKER — BATTLE OF CHAMPIONS 2026
   MC / Stage Presentation Slide Deck Controller (Clean Version)
   ========================================================================== */

(function () {
  'use strict';

  let currentSlideIndex = 0;
  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;

  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const slideCounter = document.getElementById('slide-counter-val');
  const dotsContainer = document.getElementById('slide-dots');
  const jumpSelect = document.getElementById('jump-select');
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  const liveBadge = document.getElementById('live-status-badge');
  const livePhaseEl = document.getElementById('live-phase-val');
  const btnAutoSync = document.getElementById('btn-auto-sync');

  let autoSyncEnabled = false;

  // Map server game phases to corresponding slide indices
  const phaseToSlideMap = {
    'lobby': 0,
    'case_file': 4,
    'level_1': 5,
    'clue_1': 5,
    'level_2': 6,
    'clue_2': 6,
    'level_3': 7,
    'clue_3': 7,
    'resolution': 8,
    'finished': 9,
  };

  // Build Dots & Jump Options
  function initNav() {
    dotsContainer.innerHTML = '';
    jumpSelect.innerHTML = '';

    slides.forEach((slide, idx) => {
      // Dot
      const dot = document.createElement('div');
      dot.className = `slide-dot ${idx === 0 ? 'active' : ''}`;
      dot.title = `Slide ${idx + 1}`;
      dot.addEventListener('click', () => goToSlide(idx));
      dotsContainer.appendChild(dot);

      // Option
      const opt = document.createElement('option');
      opt.value = idx;
      const titleEl = slide.querySelector('.slide-title') || slide.querySelector('.hero-title');
      const titleText = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : `Slide ${idx + 1}`;
      opt.textContent = `${idx + 1}. ${titleText}`;
      jumpSelect.appendChild(opt);
    });

    updateSlideView();
  }

  function goToSlide(index) {
    if (index < 0 || index >= totalSlides) return;
    slides[currentSlideIndex].classList.remove('active');
    currentSlideIndex = index;
    slides[currentSlideIndex].classList.add('active');
    updateSlideView();
  }

  function nextSlide() {
    if (currentSlideIndex < totalSlides - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }

  function prevSlide() {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }

  function updateSlideView() {
    const pad = (n) => String(n).padStart(2, '0');
    slideCounter.textContent = `${pad(currentSlideIndex + 1)} / ${pad(totalSlides)}`;

    prevBtn.disabled = currentSlideIndex === 0;
    nextBtn.disabled = currentSlideIndex === totalSlides - 1;

    const dots = dotsContainer.querySelectorAll('.slide-dot');
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === currentSlideIndex);
    });

    jumpSelect.value = currentSlideIndex;
  }

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Fullscreen error: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // Toggle Auto Sync
  function toggleAutoSync() {
    autoSyncEnabled = !autoSyncEnabled;
    btnAutoSync.classList.toggle('active', autoSyncEnabled);
    btnAutoSync.innerHTML = autoSyncEnabled
      ? `<span>⚡</span> Auto-Sync: ON`
      : `<span>⚡</span> Auto-Sync: OFF`;
  }

  // Event Listeners
  prevBtn.addEventListener('click', prevSlide);
  nextBtn.addEventListener('click', nextSlide);
  jumpSelect.addEventListener('change', (e) => goToSlide(Number(e.target.value)));
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  btnAutoSync.addEventListener('click', toggleAutoSync);

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToSlide(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToSlide(totalSlides - 1);
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  // Socket.IO Integration for Live Status
  if (typeof io !== 'undefined') {
    const socket = io();

    socket.on('connect', () => {
      liveBadge.classList.add('connected');
      fetch('/api/state')
        .then((r) => r.json())
        .then((state) => handleServerState(state))
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      liveBadge.classList.remove('connected');
      livePhaseEl.textContent = 'STANDBY';
    });

    socket.on('phase:changed', (data) => {
      handleServerState(data);
    });

    socket.on('timer:tick', (data) => {
      const min = Math.floor(data.remaining_seconds / 60);
      const sec = data.remaining_seconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      const timeStr = `${pad(min)}:${pad(sec)}`;
      const phaseLabel = (data.phase || '').toUpperCase().replace(/_/g, ' ');
      livePhaseEl.textContent = `${phaseLabel} [${timeStr}]`;
    });

    function handleServerState(state) {
      if (!state || !state.phase) return;
      const phaseLabel = state.phase.toUpperCase().replace(/_/g, ' ');
      livePhaseEl.textContent = phaseLabel;

      if (autoSyncEnabled && phaseToSlideMap[state.phase] !== undefined) {
        goToSlide(phaseToSlideMap[state.phase]);
      }
    }
  }

  // Initialize
  initNav();
})();
