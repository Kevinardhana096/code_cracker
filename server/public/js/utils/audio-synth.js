/* ==========================================================================
   CODE CRACKER — BATTLE OF CHAMPIONS 2026
   Synthesized Web Audio Engine (Zero Dependencies, Offline-Ready, Low-Latency)
   Provides procedural sound effects for timer ticks, urgent countdowns,
   buzzers, pause, and game phase transitions.
   ========================================================================== */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AudioSynth = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let ctx = null;
  let masterGain = null;
  let isMuted = false;
  let volume = 0.8;
  let isUnlocked = false;
  let lastPlayedSecond = null;
  let lastPhaseStarted = null;

  // Read saved mute setting if in browser
  if (typeof localStorage !== 'undefined') {
    const savedMute = localStorage.getItem('cc_audio_muted');
    if (savedMute !== null) {
      isMuted = savedMute === 'true';
    }
  }

  function getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
    }
    return ctx;
  }

  // Ensure AudioContext is running after user gesture
  function unlock() {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        isUnlocked = true;
      }).catch(() => {});
    } else {
      isUnlocked = true;
    }
  }

  // Auto-unlock on window events
  if (typeof window !== 'undefined') {
    const unlockHandler = () => {
      unlock();
      window.removeEventListener('click', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      window.removeEventListener('touchstart', unlockHandler);
    };
    window.addEventListener('click', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true });
  }

  function setMuted(muted) {
    isMuted = Boolean(muted);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cc_audio_muted', String(isMuted));
    }
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
    }
    return isMuted;
  }

  function toggleMute() {
    return setMuted(!isMuted);
  }

  function setVolume(val) {
    volume = Math.max(0, Math.min(1, Number(val) || 0.8));
    if (masterGain && ctx && !isMuted) {
      masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    }
  }

  // Helper to create a single tone with ADSR envelope
  function playTone({ type = 'sine', freq = 440, duration = 0.1, gain = 0.5, attack = 0.005, decay = 0.08, dest = masterGain }) {
    if (isMuted) return;
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const env = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(gain, now + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attack + 0.01, duration));

      osc.connect(env);
      env.connect(dest);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch (_) {}
  }

  /* --------------------------------------------------------------------------
     SOUND PRESETS
     -------------------------------------------------------------------------- */

  // 1. Tension Tick (Detak detik 10 s.d. 6)
  function playTick() {
    if (isMuted) return;
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      const now = audioCtx.currentTime;
      // High-passed click + woody pop
      playTone({ type: 'sine', freq: 580, duration: 0.04, gain: 0.35, attack: 0.002 });
      playTone({ type: 'triangle', freq: 1160, duration: 0.02, gain: 0.15, attack: 0.001 });
    } catch (_) {}
  }

  // 2. Urgent Beep (Detik 5, 4, 3, 2, 1 — nada menaik)
  function playUrgentTick(secondRemaining = 5) {
    if (isMuted) return;
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      // Escalating frequency scale: 5 -> 880Hz, 4 -> 988Hz, 3 -> 1046Hz, 2 -> 1175Hz, 1 -> 1318Hz
      const freqMap = {
        5: 880,
        4: 988,
        3: 1046,
        2: 1175,
        1: 1318
      };
      const freq = freqMap[secondRemaining] || 880;

      // Double-layer sharp alert beep
      playTone({ type: 'square', freq: freq, duration: 0.08, gain: 0.3, attack: 0.003 });
      playTone({ type: 'sine', freq: freq * 2, duration: 0.05, gain: 0.2, attack: 0.002 });
    } catch (_) {}
  }

  // 3. Time's Up Buzzer / Lockout Horn (Saat 00:00)
  function playTimesUp() {
    if (isMuted) return;
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      const now = audioCtx.currentTime;
      const duration = 1.1;

      // Heavy dual-oscillator sawtooth buzzer (160 Hz + 225 Hz)
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const env = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + duration);

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(160, now);
      osc1.frequency.exponentialRampToValueAtTime(140, now + duration);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(225, now);
      osc2.frequency.exponentialRampToValueAtTime(195, now + duration);

      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.7, now + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(env);
      env.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.1);
      osc2.stop(now + duration + 0.1);
    } catch (_) {}
  }

  // 4. Resume Countdown Tick (5..1 detik saat unpause)
  function playResumeTick(secondRemaining = 5) {
    if (isMuted) return;
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      // Pleasant ping
      const freq = 440 + (5 - secondRemaining) * 40;
      playTone({ type: 'triangle', freq: freq, duration: 0.08, gain: 0.4, attack: 0.005 });
    } catch (_) {}
  }

  // 5. Resume Finished / Game Go Chime
  function playResumeDone() {
    if (isMuted) return;
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      const now = audioCtx.currentTime;
      playTone({ type: 'triangle', freq: 523.25, duration: 0.12, gain: 0.4 }); // C5
      setTimeout(() => {
        playTone({ type: 'triangle', freq: 659.25, duration: 0.15, gain: 0.45 }); // E5
      }, 70);
      setTimeout(() => {
        playTone({ type: 'triangle', freq: 783.99, duration: 0.25, gain: 0.5 }); // G5
      }, 140);
    } catch (_) {}
  }

  // 6. Pause Sound (Frekuensi menurun)
  function playPauseSound() {
    if (isMuted) return;
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const env = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.18);

      env.gain.setValueAtTime(0.35, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(env);
      env.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (_) {}
  }

  // 7. Level Start Fanfare / Rising Chime
  function playLevelStart() {
    if (isMuted) return;
    const audioCtx = getAudioContext();
    if (!audioCtx || audioCtx.state === 'suspended') return;

    try {
      const notes = [
        { f: 392.00, t: 0 },    // G4
        { f: 523.25, t: 80 },   // C5
        { f: 659.25, t: 160 },  // E5
        { f: 783.99, t: 240 },  // G5
        { f: 1046.50, t: 340 }, // C6 (panjang)
      ];

      notes.forEach((n, i) => {
        setTimeout(() => {
          const dur = i === notes.length - 1 ? 0.4 : 0.12;
          playTone({ type: 'triangle', freq: n.f, duration: dur, gain: 0.45, attack: 0.008 });
        }, n.t);
      });
    } catch (_) {}
  }

  const api = {
    getAudioContext,
    unlock,
    isUnlocked: () => isUnlocked,
    isMuted: () => isMuted,
    setMuted,
    toggleMute,
    setVolume,
    playTone,
    playTick,
    playUrgentTick,
    playTimesUp,
    playResumeTick,
    playResumeDone,
    playPauseSound,
    playLevelStart,
    handleTimerTick,
    handlePhaseChange,
    handleResuming,
    handleResumed,
    handlePaused
  };

  /* --------------------------------------------------------------------------
     TIMER EVENT HANDLER / DISPATCHER
     Call this on every socket 'timer:tick' or related event
     -------------------------------------------------------------------------- */
  function handleTimerTick(data) {
    if (!data) return;
    const sec = typeof data.remaining_seconds === 'number' ? Math.floor(data.remaining_seconds) : null;

    // Avoid duplicate triggers within the same second
    if (sec === null || sec === lastPlayedSecond) return;
    lastPlayedSecond = sec;

    // Do not play ticking if game is paused
    if (data.is_paused) return;

    // Critical Urgency (5, 4, 3, 2, 1)
    if (sec <= 5 && sec >= 1) {
      api.playUrgentTick(sec);
    }
    // Tension Countdown (10, 9, 8, 7, 6)
    else if (sec <= 10 && sec >= 6) {
      api.playTick();
    }
    // Time's Up (0)
    else if (sec === 0) {
      api.playTimesUp();
    }
  }

  function handlePhaseChange(phase) {
    if (!phase || phase === lastPhaseStarted) return;
    lastPhaseStarted = phase;

    // Reset last played second on new phase
    lastPlayedSecond = null;

    if (['level_1', 'level_2', 'level_3', 'resolution'].includes(phase)) {
      api.playLevelStart();
    }
  }

  function handleResuming(countdown) {
    const sec = Number(countdown);
    if (!isNaN(sec) && sec >= 1) {
      api.playResumeTick(sec);
    }
  }

  function handleResumed() {
    api.playResumeDone();
  }

  function handlePaused() {
    api.playPauseSound();
  }

  return api;
});
