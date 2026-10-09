const assert = require('assert');
const http = require('http');
const express = require('express');
const path = require('path');
const AudioSynth = require('../public/js/utils/audio-synth');

async function testAudioSynth() {
  console.log('--- Testing Web Audio Synth Timer Effects ---');

  // Test 1: Module interface exports
  console.log('Test 1: Module exports all expected sound and control functions');
  const requiredMethods = [
    'getAudioContext',
    'unlock',
    'isMuted',
    'setMuted',
    'toggleMute',
    'setVolume',
    'playTone',
    'playTick',
    'playUrgentTick',
    'playTimesUp',
    'playResumeTick',
    'playResumeDone',
    'playPauseSound',
    'playLevelStart',
    'handleTimerTick',
    'handlePhaseChange',
    'handleResuming',
    'handleResumed',
    'handlePaused'
  ];

  requiredMethods.forEach((method) => {
    assert.strictEqual(typeof AudioSynth[method], 'function', `AudioSynth.${method} must be a function`);
  });
  console.log('  -> All 19 required functions verified.');

  // Test 2: Mute and Volume state control
  console.log('Test 2: Mute and Volume controls');
  AudioSynth.setMuted(true);
  assert.strictEqual(AudioSynth.isMuted(), true);

  const toggled = AudioSynth.toggleMute();
  assert.strictEqual(toggled, false);
  assert.strictEqual(AudioSynth.isMuted(), false);

  AudioSynth.toggleMute();
  assert.strictEqual(AudioSynth.isMuted(), true);

  // Volume
  AudioSynth.setVolume(0.5);
  AudioSynth.setVolume(1.5); // clamped to 1
  AudioSynth.setVolume(-0.5); // clamped to 0
  console.log('  -> Mute and volume states handled correctly.');

  // Test 3: Event dispatcher verification
  console.log('Test 3: Timer Tick Dispatcher & Sound Triggers');
  AudioSynth.setMuted(false);
  let ticksPlayed = [];
  let urgentTicksPlayed = [];
  let timesUpPlayed = 0;
  let levelStartsPlayed = [];
  let resumeTicksPlayed = [];
  let resumeDonePlayed = 0;
  let pausePlayed = 0;

  // Temporarily spy on methods
  const origTick = AudioSynth.playTick;
  const origUrgent = AudioSynth.playUrgentTick;
  const origTimesUp = AudioSynth.playTimesUp;
  const origStart = AudioSynth.playLevelStart;
  const origResume = AudioSynth.playResumeTick;
  const origResumeDone = AudioSynth.playResumeDone;
  const origPause = AudioSynth.playPauseSound;

  AudioSynth.playTick = () => ticksPlayed.push(true);
  AudioSynth.playUrgentTick = (s) => urgentTicksPlayed.push(s);
  AudioSynth.playTimesUp = () => timesUpPlayed++;
  AudioSynth.playLevelStart = () => levelStartsPlayed.push(true);
  AudioSynth.playResumeTick = (s) => resumeTicksPlayed.push(s);
  AudioSynth.playResumeDone = () => resumeDonePlayed++;
  AudioSynth.playPauseSound = () => pausePlayed++;

  // Simulate tick 15 (normal, no sound)
  AudioSynth.handleTimerTick({ remaining_seconds: 15, is_paused: false });
  assert.strictEqual(ticksPlayed.length, 0);
  assert.strictEqual(urgentTicksPlayed.length, 0);

  // Simulate tick 10 (tension tick)
  AudioSynth.handleTimerTick({ remaining_seconds: 10, is_paused: false });
  assert.strictEqual(ticksPlayed.length, 1);

  // Simulate duplicate tick 10 (guard must prevent double trigger)
  AudioSynth.handleTimerTick({ remaining_seconds: 10, is_paused: false });
  assert.strictEqual(ticksPlayed.length, 1);

  // Simulate tick 9, 8, 7, 6
  AudioSynth.handleTimerTick({ remaining_seconds: 9, is_paused: false });
  AudioSynth.handleTimerTick({ remaining_seconds: 8, is_paused: false });
  AudioSynth.handleTimerTick({ remaining_seconds: 7, is_paused: false });
  AudioSynth.handleTimerTick({ remaining_seconds: 6, is_paused: false });
  assert.strictEqual(ticksPlayed.length, 5);

  // Simulate tick 5, 4, 3, 2, 1 (urgent ticks)
  AudioSynth.handleTimerTick({ remaining_seconds: 5, is_paused: false });
  AudioSynth.handleTimerTick({ remaining_seconds: 4, is_paused: false });
  AudioSynth.handleTimerTick({ remaining_seconds: 3, is_paused: false });
  AudioSynth.handleTimerTick({ remaining_seconds: 2, is_paused: false });
  AudioSynth.handleTimerTick({ remaining_seconds: 1, is_paused: false });
  assert.deepStrictEqual(urgentTicksPlayed, [5, 4, 3, 2, 1]);

  // Simulate tick 0 (Time's Up buzzer)
  AudioSynth.handleTimerTick({ remaining_seconds: 0, is_paused: false });
  assert.strictEqual(timesUpPlayed, 1);

  // Simulate paused tick (no tick sounds during pause)
  AudioSynth.handleTimerTick({ remaining_seconds: 5, is_paused: true });
  assert.strictEqual(urgentTicksPlayed.length, 5, 'Should not play tick when paused');

  // Test Pause / Resume / Phase sounds
  AudioSynth.handlePaused();
  assert.strictEqual(pausePlayed, 1);

  AudioSynth.handleResuming(3);
  assert.deepStrictEqual(resumeTicksPlayed, [3]);

  AudioSynth.handleResumed();
  assert.strictEqual(resumeDonePlayed, 1);

  AudioSynth.handlePhaseChange('level_1');
  assert.strictEqual(levelStartsPlayed.length, 1);

  // Restore spied methods
  AudioSynth.playTick = origTick;
  AudioSynth.playUrgentTick = origUrgent;
  AudioSynth.playTimesUp = origTimesUp;
  AudioSynth.playLevelStart = origStart;
  AudioSynth.playResumeTick = origResume;
  AudioSynth.playResumeDone = origResumeDone;
  AudioSynth.playPauseSound = origPause;

  console.log('  -> All timer tick, urgent countdown, buzzer, pause, and resume events dispatch cleanly.');

  // Test 4: Verify static file serving via Express
  console.log('Test 4: Verify static file serving of /js/utils/audio-synth.js');
  const app = express();
  app.use(express.static(path.join(__dirname, '..', 'public')));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const res = await fetch(`http://localhost:${port}/js/utils/audio-synth.js`);
  assert.strictEqual(res.status, 200);
  const code = await res.text();
  assert(code.includes('AudioSynth'));
  assert(code.includes('playUrgentTick'));
  assert(code.includes('playTimesUp'));
  await new Promise((resolve) => server.close(resolve));
  console.log('  -> /js/utils/audio-synth.js served successfully with status 200.');

  console.log('ALL AUDIO SYNTH TESTS PASSED SUCCESSFULLY!');
}

testAudioSynth().catch((err) => {
  console.error('Audio Synth Test Failed:', err);
  process.exit(1);
});
