const { getDb, queryAll, queryOne, run, saveDb } = require('./db');
const crypto = require('crypto');
const config = require('../config');
const fs = require('fs');
const path = require('path');

function createTeamCodes(count) {
  if (config.TEAM_LOGIN_CODES.length) {
    if (config.TEAM_LOGIN_CODES.length !== count
      || new Set(config.TEAM_LOGIN_CODES).size !== count
      || config.TEAM_LOGIN_CODES.some((code) => code.length < 8)) {
      throw new Error(`CODE_CRACKER_TEAM_LOGIN_CODES harus berisi ${count} kode unik, masing-masing minimal 8 karakter`);
    }
    return config.TEAM_LOGIN_CODES;
  }
  return Array.from({ length: count }, () => crypto.randomBytes(6).toString('base64url').toUpperCase());
}

function writeGeneratedCodes(teams, codes) {
  if (config.TEAM_LOGIN_CODES.length) return;
  const outputPath = path.join(__dirname, '..', '..', 'data', 'team-login-codes.txt');
  const content = teams.map((name, index) => `${name}: ${codes[index]}`).join('\n') + '\n';
  fs.writeFileSync(outputPath, content, { encoding: 'utf8', mode: 0o600 });
  console.log(`[SECURITY] Kode login tim ditulis ke ${outputPath}. Hapus file setelah kode didistribusikan.`);
}

function seedData() {
  const db = getDb();

  const teamCount = queryOne('SELECT COUNT(*) as count FROM teams');

  const teams = [
    'Tim Alpha', 'Tim Bravo', 'Tim Charlie', 'Tim Delta', 'Tim Echo',
    'Tim Foxtrot', 'Tim Golf', 'Tim Hotel', 'Tim India', 'Tim Juliet',
    'Tim Kilo', 'Tim Lima', 'Tim Mike', 'Tim November', 'Tim Oscar',
  ];
  const configuredCodes = createTeamCodes(teams.length);

  if (!teamCount || teamCount.count === 0) {
    const insertTeam = db.prepare('INSERT INTO teams (name, login_code) VALUES (?, ?)');
    teams.forEach((name, i) => {
      const code = configuredCodes[i];
      insertTeam.run([name, code]);
    });
    insertTeam.free();
    writeGeneratedCodes(teams, configuredCodes);
  } else if (config.TEAM_LOGIN_CODES.length) {
    const updateTeam = db.prepare('UPDATE teams SET login_code = ? WHERE name = ?');
    teams.forEach((name, index) => updateTeam.run([configuredCodes[index], name]));
    updateTeam.free();
  } else {
    const existingTeams = queryAll('SELECT id, name, login_code FROM teams ORDER BY id');
    const usesLegacyCodes = existingTeams.some((team) => /^TIM\d{2}$/.test(team.login_code));
    if (usesLegacyCodes) {
      const replacementCodes = createTeamCodes(existingTeams.length);
      const updateTeam = db.prepare('UPDATE teams SET login_code = ? WHERE id = ?');
      existingTeams.forEach((team, index) => updateTeam.run([replacementCodes[index], team.id]));
      updateTeam.free();
      writeGeneratedCodes(existingTeams.map((team) => team.name), replacementCodes);
    }
  }

  const questions = [
    { level: 1, topic: 'Aritmatika', question_text: 'Berapakah hasil dari 125 + 375 - 200?', answer_key: 'A', options: [{ id: 'A', text: '300' }, { id: 'B', text: '250' }, { id: 'C', text: '350' }, { id: 'D', text: '400' }], points: 10 },
    { level: 1, topic: 'Aljabar', question_text: 'Jika 3x + 7 = 25, berapakah nilai x?', answer_key: 'A', options: [{ id: 'A', text: '6' }, { id: 'B', text: '5' }, { id: 'C', text: '7' }, { id: 'D', text: '8' }], points: 10 },
    { level: 1, topic: 'Geometri', question_text: 'Sebuah persegi memiliki sisi 8 cm. Berapakah luasnya? (dalam cm²)', answer_key: 'A', options: [{ id: 'A', text: '64' }, { id: 'B', text: '32' }, { id: 'C', text: '16' }, { id: 'D', text: '72' }], points: 10 },
    { level: 1, topic: 'Logika', question_text: 'Tentukan angka berikutnya: 2, 6, 12, 20, 30, ?', answer_key: 'A', options: [{ id: 'A', text: '42' }, { id: 'B', text: '40' }, { id: 'C', text: '36' }, { id: 'D', text: '44' }], points: 10 },
    { level: 1, topic: 'Aritmatika', question_text: '15% dari 400 adalah?', answer_key: 'A', options: [{ id: 'A', text: '60' }, { id: 'B', text: '50' }, { id: 'C', text: '80' }, { id: 'D', text: '40' }], points: 10 },

    { level: 2, topic: 'Aljabar', question_text: 'Jika x + y = 10 dan x - y = 4, berapakah nilai x?', answer_key: 'A', options: [{ id: 'A', text: '7' }, { id: 'B', text: '6' }, { id: 'C', text: '8' }, { id: 'D', text: '5' }], points: 20 },
    { level: 2, topic: 'Geometri', question_text: 'Sebuah segitiga siku-siku memiliki sisi tegak 6 cm dan 8 cm. Berapakah panjang sisi miringnya? (dalam cm)', answer_key: 'A', options: [{ id: 'A', text: '10' }, { id: 'B', text: '12' }, { id: 'C', text: '14' }, { id: 'D', text: '8' }], points: 20 },
    { level: 2, topic: 'Statistika', question_text: 'Tentukan mean dari data: 5, 8, 12, 15, 20', answer_key: 'A', options: [{ id: 'A', text: '12' }, { id: 'B', text: '10' }, { id: 'C', text: '14' }, { id: 'D', text: '15' }], points: 20 },
    { level: 2, topic: 'Logika', question_text: 'Tentukan angka berikutnya: 1, 3, 7, 15, 31, ?', answer_key: 'A', options: [{ id: 'A', text: '63' }, { id: 'B', text: '62' }, { id: 'C', text: '64' }, { id: 'D', text: '61' }], points: 20 },
    { level: 2, topic: 'Aritmatika', question_text: 'Jumlah 10 suku pertama deret aritmatika: 3, 7, 11, 15, ... adalah?', answer_key: 'A', options: [{ id: 'A', text: '210' }, { id: 'B', text: '200' }, { id: 'C', text: '220' }, { id: 'D', text: '190' }], points: 20 },

    { level: 3, topic: 'Aljabar', question_text: 'Jika f(x) = 2x + 3 dan g(x) = x², berapakah f(g(3))?', answer_key: 'A', options: [{ id: 'A', text: '21' }, { id: 'B', text: '18' }, { id: 'C', text: '15' }, { id: 'D', text: '24' }], points: 30 },
    { level: 3, topic: 'Kombinatorik', question_text: 'Berapa banyak susunan berbeda dari huruf-huruf pada kata "BOC"?', answer_key: 'A', options: [{ id: 'A', text: '6' }, { id: 'B', text: '3' }, { id: 'C', text: '9' }, { id: 'D', text: '12' }], points: 30 },
    { level: 3, topic: 'Geometri', question_text: 'Dua segitiga sebangun memiliki perbandingan sisi 2:5. Jika luas segitiga kecil 16 cm², berapakah luas segitiga besar? (dalam cm²)', answer_key: 'A', options: [{ id: 'A', text: '100' }, { id: 'B', text: '80' }, { id: 'C', text: '64' }, { id: 'D', text: '125' }], points: 30 },
    { level: 3, topic: 'Peluang', question_text: 'Sebuah dadu dilempar dua kali. Berapakah peluang munculnya jumlah mata dadu 7? (dalam pecahan paling sederhana, format: a/b)', answer_key: 'A', options: [{ id: 'A', text: '1/6' }, { id: 'B', text: '1/4' }, { id: 'C', text: '1/3' }, { id: 'D', text: '1/12' }], points: 30 },
    { level: 3, topic: 'Logika', question_text: 'Jika semua Champion adalah Investigator, dan beberapa Investigator adalah Mathematician, maka: A. Semua Champion adalah Mathematician, B. Beberapa Champion adalah Mathematician, C. Tidak dapat disimpulkan. Pilih A, B, atau C.', answer_key: 'C', options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }, { id: 'C', text: 'C' }, { id: 'D', text: 'Tidak ada kesimpulan' }], points: 30 },
  ];

  function insertQuestions(mode, rows) {
    const insertQ = db.prepare(
      'INSERT INTO questions (mode, level, topic, question_text, answer_key, options_json, points) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    rows.forEach((q) => {
      insertQ.run([mode, q.level, q.topic, q.question_text, q.answer_key, JSON.stringify(q.options), q.points]);
    });
    insertQ.free();
  }

  function migrateQuestionOptions(mode, rows) {
    const existingRows = queryAll(
      'SELECT id, options_json FROM questions WHERE mode = ? ORDER BY level, id',
      [mode]
    );
    if (existingRows.length !== rows.length) return;

    let changed = false;
    existingRows.forEach((existing, index) => {
      if (existing.options_json && existing.options_json !== '[]') return;
      const q = rows[index];
      db.run(
        'UPDATE questions SET answer_key = ?, options_json = ?, points = ? WHERE id = ?',
        [q.answer_key, JSON.stringify(q.options), q.points, existing.id]
      );
      changed = true;
    });
    if (changed) saveDb();
  }

  const simulationQuestionCount = queryOne(
    "SELECT COUNT(*) as count FROM questions WHERE mode = 'simulation'"
  );
  if (!simulationQuestionCount || simulationQuestionCount.count === 0) {
    insertQuestions('simulation', questions);
  } else {
    migrateQuestionOptions('simulation', questions);
  }

  const officialQuestionCount = queryOne(
    "SELECT COUNT(*) as count FROM questions WHERE mode = 'official'"
  );
  if (!officialQuestionCount || officialQuestionCount.count === 0) {
    // Temporary official dataset. Replace this array with the real questions
    // before the event; it remains isolated from simulation rows.
    insertQuestions('official', questions);
  } else {
    migrateQuestionOptions('official', questions);
  }

  const clues = [
    { level: 1, min_correct: 5, max_correct: 5, clue_text: 'SANGAT JELAS: Kandidat Alpha tidak mungkin menjadi Champion karena ia tidak memiliki akses ke ruang kejadian pada malam insiden.' },
    { level: 1, min_correct: 4, max_correct: 4, clue_text: 'JELAS: Kandidat Alpha memiliki alibi yang lemah pada malam kejadian.' },
    { level: 1, min_correct: 3, max_correct: 3, clue_text: 'CUKUP: Dua dari empat kandidat tidak memiliki motif yang kuat.' },
    { level: 1, min_correct: 0, max_correct: 2, clue_text: 'MINIMAL: Motif adalah kunci utama dalam investigasi ini.' },

    { level: 2, min_correct: 5, max_correct: 5, clue_text: 'SANGAT JELAS: Sidik jari pada barang bukti utama cocok dengan Kandidat Delta, tetapi ada indikasi sidik jari tersebut ditanam.' },
    { level: 2, min_correct: 4, max_correct: 4, clue_text: 'JELAS: Barang bukti utama memiliki sidik jari milik salah satu kandidat.' },
    { level: 2, min_correct: 3, max_correct: 3, clue_text: 'CUKUP: Waktu kejadian dipastikan antara pukul 20:00 - 22:00.' },
    { level: 2, min_correct: 0, max_correct: 2, clue_text: 'MINIMAL: Rekaman CCTV di sekitar lokasi akan sangat membantu.' },

    { level: 3, min_correct: 5, max_correct: 5, clue_text: 'SANGAT JELAS: Kandidat Charlie adalah Champion yang sebenarnya. Ia memiliki akses, motif, dan rekaman komunikasi terenkripsi yang membuktikan identitasnya.' },
    { level: 3, min_correct: 4, max_correct: 4, clue_text: 'JELAS: Kandidat Beta dan Kandidat Delta tidak mungkin Champion - mereka adalah pengalih perhatian (red herring).' },
    { level: 3, min_correct: 3, max_correct: 3, clue_text: 'CUKUP: The Lost Champion menyembunyikan identitasnya menggunakan teknologi enkripsi yang sangat canggih.' },
    { level: 3, min_correct: 0, max_correct: 2, clue_text: 'MINIMAL: Informasi tambahan: Champion yang sebenarnya memiliki latar belakang di bidang teknologi.' },
  ];

  function insertClues(mode, rows) {
    const insertC = db.prepare(
      'INSERT INTO clues (mode, level, min_correct, max_correct, clue_text) VALUES (?, ?, ?, ?, ?)'
    );
    rows.forEach((c) => {
      insertC.run([mode, c.level, c.min_correct, c.max_correct, c.clue_text]);
    });
    insertC.free();
  }

  const simulationClueCount = queryOne(
    "SELECT COUNT(*) as count FROM clues WHERE mode = 'simulation'"
  );
  if (!simulationClueCount || simulationClueCount.count === 0) {
    insertClues('simulation', clues);
  }

  const officialClueCount = queryOne(
    "SELECT COUNT(*) as count FROM clues WHERE mode = 'official'"
  );
  if (!officialClueCount || officialClueCount.count === 0) {
    // Temporary official dataset; replace with the final clue set before the event.
    insertClues('official', clues);
  }

  console.log('[DB] Seed data ready: 15 teams, simulation + official question/clue sets');
}

module.exports = { seedData };
