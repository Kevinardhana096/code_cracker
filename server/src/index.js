// Muat variabel lingkungan dari server/.env (jika ada) sebelum modul lain dibaca.
require('./load-env');

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const config = require('./config');
const { initDb, saveDb, saveDbSync } = require('./db/db');
const { initSchema } = require('./db/schema');
const { seedData } = require('./db/seed');
const game = require('./services/game');
const { startTimer } = require('./services/timer');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

function validateRuntimeConfig() {
  const errors = [];
  if (config.ADMIN_PASSWORD.length < 12) errors.push('CODE_CRACKER_ADMIN_PASSWORD (minimal 12 karakter)');
  if (config.VERIFICATION_SECRET.length < 32) errors.push('CODE_CRACKER_VERIFICATION_SECRET (minimal 32 karakter)');
  if (errors.length) throw new Error(`Konfigurasi keamanan belum lengkap: ${errors.join(', ')}`);
}

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'",
  });
  next();
});
// Limit 8mb agar muat gambar soal yang diunggah sebagai base64 (5 MB ≈ 6.7 MB base64).
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get(['/stage', '/screen/stage', '/presentasi', '/display'], (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'stage.html'));
});

app.get(['/mc', '/mc-control', '/slides', '/remote'], (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'mc.html'));
});

app.get(['/sound-test', '/audio', '/sfx'], (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'sound-test.html'));
});

app.use('/api', authRoutes);
app.use('/api', gameRoutes);
app.use('/api/admin', adminRoutes);

const io = new Server(server);
app.set('io', io);

async function start() {
  validateRuntimeConfig();
  await initDb();
  initSchema();
  seedData();
  saveDbSync();

  const setupSocket = require('./socket/index');
  setupSocket(io);

  // Continue an active level after a server restart. The authoritative
  // deadline is persisted in game_state, so the timer resumes from it.
  if (game.isActiveLevel()) {
    console.log(`[Timer] Resuming active phase: ${game.getState().phase}`);
    startTimer(io);
  }

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  setInterval(() => {
    saveDb();
  }, 30000);

  process.on('SIGINT', () => {
    saveDbSync();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    saveDbSync();
    process.exit(0);
  });

  server.listen(config.PORT, config.HOST, () => {
    console.log('');
    console.log('============================================');
    console.log('  Code Cracker — BOC 2026');
    console.log('  The Investigation Ladder');
    console.log('============================================');
    console.log('');
    console.log(`  Server running on http://${config.HOST}:${config.PORT}`);
    console.log(`  Local access:     http://localhost:${config.PORT}`);
    console.log('');
    console.log('============================================');
    console.log('');

    const { printQRInfo } = require('./utils/network');
    printQRInfo(config.PORT);
  });
}

start();
