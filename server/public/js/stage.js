/* ==========================================================================
   CODE CRACKER — BATTLE OF CHAMPIONS 2026
   Clean Stage / Projector Screen Controller
   (Zero Controls — Synchronized via Socket.IO & Wireless Presenter Clicker)
   ========================================================================== */

(function () {
  'use strict';

  let currentSlideIndex = 0;
  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;

  const header = document.getElementById('stage-header');
  const liveBadge = document.getElementById('live-status-badge');
  const livePhaseEl = document.getElementById('live-phase-val');
  const toast = document.getElementById('stage-toast');

  let socket = null;
  let cursorTimer = null;

  // Auto-fade toast after 4 seconds
  if (toast) {
    setTimeout(() => {
      toast.classList.add('fade');
      setTimeout(() => {
        toast.remove();
      }, 1200);
    }, 4000);
  }

  // Auto-hide cursor when mouse idle for 3 seconds
  function resetCursorTimer() {
    document.body.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => {
      document.body.classList.add('hide-cursor');
    }, 3000);
  }
  window.addEventListener('mousemove', resetCursorTimer);
  window.addEventListener('mousedown', resetCursorTimer);
  resetCursorTimer();

  // Slide Transitions
  function goToSlide(index, emitSocket = false) {
    if (index < 0 || index >= totalSlides) return;
    if (index === currentSlideIndex && slides[currentSlideIndex].classList.contains('active')) return;

    slides[currentSlideIndex].classList.remove('active');
    currentSlideIndex = index;
    slides[currentSlideIndex].classList.add('active');

    if (emitSocket && socket && socket.connected) {
      socket.emit('stage:set_slide', { slide: currentSlideIndex });
    }
  }

  function nextSlide(emit = false) {
    if (currentSlideIndex < totalSlides - 1) {
      goToSlide(currentSlideIndex + 1, emit);
    }
  }

  function prevSlide(emit = false) {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1, emit);
    }
  }

  // Fullscreen Toggle
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

  // Toggle Header (Shortcut: H)
  function toggleHeader() {
    if (header) {
      header.classList.toggle('hidden');
    }
  }

  // Physical Keyboard / Wireless Clicker Fallback Controls
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextSlide(true);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      prevSlide(true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToSlide(0, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToSlide(totalSlides - 1, true);
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      toggleHeader();
    }
  });

  // Socket.IO Integration
  if (typeof io !== 'undefined') {
    socket = io();

    socket.on('connect', () => {
      if (liveBadge) liveBadge.classList.add('connected');
      socket.emit('stage:get_slide');

      fetch('/api/state')
        .then((r) => r.json())
        .then((state) => handleServerState(state))
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      if (liveBadge) liveBadge.classList.remove('connected');
      if (livePhaseEl) livePhaseEl.textContent = 'STANDBY';
    });

    socket.on('stage:init', (data) => {
      if (data && typeof data.slide === 'number') {
        goToSlide(data.slide, false);
      }
    });

    socket.on('stage:slide', (data) => {
      if (data && typeof data.slide === 'number') {
        goToSlide(data.slide, false);
      }
    });

    socket.on('phase:changed', (data) => {
      handleServerState(data);
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

    function handleServerState(state) {
      if (!state || !state.phase || !livePhaseEl) return;
      const phaseLabel = state.phase.toUpperCase().replace(/_/g, ' ');
      livePhaseEl.textContent = phaseLabel;
    }
  }

  // Ensure first slide is activated initially
  goToSlide(0, false);
})();
