const http = require('http');
const express = require('express');
const { EventEmitter } = require('events');
const assert = require('assert');
const path = require('path');
const setupSocket = require('../src/socket/index');

async function runStageMcTest() {
  console.log('--- Testing Stage Screen & MC Remote Controller Architecture ---');

  const app = express();
  const server = http.createServer(app);

  app.get(['/stage', '/screen/stage', '/presentasi', '/display'], (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'stage.html'));
  });

  app.get(['/mc', '/mc-control', '/slides', '/remote'], (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'mc.html'));
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running on ${baseUrl}`);

  // 1. Test HTTP routes
  console.log('Test 1: HTTP GET /stage returns 200 and clean stage.html');
  const stageRes = await fetch(`${baseUrl}/stage`);
  assert.strictEqual(stageRes.status, 200);
  const stageHtml = await stageRes.text();
  assert(stageHtml.includes('Layar Panggung — Code Cracker BOC 2026'));
  assert(stageHtml.includes('/css/stage.css'));
  assert(stageHtml.includes('/js/stage.js'));
  // Ensure NO controls exist on stage
  assert(!stageHtml.includes('btn-next'));
  assert(!stageHtml.includes('btn-prev'));
  assert(!stageHtml.includes('jump-select'));
  console.log('  -> Stage HTML verified 100% clean with zero navigation buttons.');

  console.log('Test 2: HTTP GET /mc returns 200 and mc.html');
  const mcRes = await fetch(`${baseUrl}/mc`);
  assert.strictEqual(mcRes.status, 200);
  const mcHtml = await mcRes.text();
  assert(mcHtml.includes('Konsol Pengendali MC'));
  assert(mcHtml.includes('btn-next'));
  assert(mcHtml.includes('btn-prev'));
  assert(mcHtml.includes('cue-card'));
  console.log('  -> MC Console HTML verified with full presenter cue controls.');

  // 2. Test Socket Handler Logic
  console.log('Test 3: Socket.IO Stage Sync Handlers');
  const mockIo = new EventEmitter();
  const emittedEvents = [];
  const origMockEmit = mockIo.emit.bind(mockIo);
  mockIo.emit = function (event, ...args) {
    emittedEvents.push({ event, data: args[0] });
    return origMockEmit(event, ...args);
  };
  mockIo.sockets = { sockets: new Map() };

  setupSocket(mockIo);

  // Client 1 connects (Stage Screen)
  const clientStage = new EventEmitter();
  clientStage.id = 'stage-socket-1';
  const stageEmitted = [];
  clientStage.emit = function (event, data) {
    stageEmitted.push({ event, data });
    EventEmitter.prototype.emit.call(this, event, data);
  };

  mockIo.emit('connection', clientStage);

  // Verify initial slide is sent
  const initCall = stageEmitted.find((e) => e.event === 'stage:init');
  assert(initCall, 'Client should receive stage:init on connection');
  assert.strictEqual(initCall.data.slide, 0);
  console.log('  -> Stage client connected and received stage:init with slide: 0');

  // Client 2 connects (MC Controller)
  const clientMc = new EventEmitter();
  clientMc.id = 'mc-socket-1';
  const mcEmitted = [];
  clientMc.emit = function (event, data) {
    mcEmitted.push({ event, data });
    EventEmitter.prototype.emit.call(this, event, data);
  };

  mockIo.emit('connection', clientMc);

  // MC client changes slide to 5 (Level 1)
  clientMc.emit('stage:set_slide', { slide: 5 });

  const slideBroadcast = emittedEvents.find((e) => e.event === 'stage:slide');
  assert(slideBroadcast, 'Server should broadcast stage:slide to all clients');
  assert.strictEqual(slideBroadcast.data.slide, 5);
  console.log(`  -> MC emitted stage:set_slide (5) and server broadcasted stage:slide (5).`);

  // Client 3 (Late joining stage display)
  console.log('Test 4: Late-joining Stage screen receives updated slide 5');
  const clientStageLate = new EventEmitter();
  clientStageLate.id = 'stage-socket-2';
  const lateEmitted = [];
  clientStageLate.emit = function (event, data) {
    lateEmitted.push({ event, data });
    EventEmitter.prototype.emit.call(this, event, data);
  };

  mockIo.emit('connection', clientStageLate);
  const lateInit = lateEmitted.find((e) => e.event === 'stage:init');
  assert(lateInit, 'Late client should receive stage:init');
  assert.strictEqual(lateInit.data.slide, 5);
  console.log(`  -> Late-joining stage display received updated slide: ${lateInit.data.slide}`);

  await new Promise((resolve) => server.close(resolve));
  console.log('ALL STAGE & MC ARCHITECTURE TESTS PASSED SUCCESSFULLY!');
}

runStageMcTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
