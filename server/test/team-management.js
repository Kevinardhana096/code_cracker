const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DB_FILENAME = 'team_test.db';
const dbPath = path.join(__dirname, '..', 'data', DB_FILENAME);
process.env.CODE_CRACKER_DB_FILENAME = DB_FILENAME;
process.env.CODE_CRACKER_ADMIN_PASSWORD = 'super-secret-admin-pass-1234';
process.env.CODE_CRACKER_VERIFICATION_SECRET = 'super-secret-verification-key-1234567890';

const { initDb, saveDb, queryOne, queryAll } = require('../src/db/db');
const { initSchema } = require('../src/db/schema');
const { seedData } = require('../src/db/seed');
const { issueAdminToken } = require('../src/middleware/auth');
const express = require('express');
const adminRoutes = require('../src/routes/admin');
const http = require('http');

async function main() {
  fs.rmSync(dbPath, { force: true });
  await initDb();
  initSchema();
  seedData();
  saveDb();

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/admin`;
  const token = issueAdminToken();

  try {
    // 1. GET /teams
    const getRes = await fetch(`${baseUrl}/teams`, {
      headers: { 'X-Admin-Token': token },
    });
    const getData = await getRes.json();
    assert.strictEqual(getData.ok, true, 'GET /teams ok');
    assert.strictEqual(getData.teams.length, 15, '15 teams returned');
    assert.strictEqual(typeof getData.teams[0].login_code, 'string');

    const firstTeam = getData.teams[0];

    // 2. PUT /teams/:id (Update name and code)
    const updateRes = await fetch(`${baseUrl}/teams/${firstTeam.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
      },
      body: JSON.stringify({
        name: 'Tim Garuda Sakti',
        login_code: 'GARUDA88',
      }),
    });
    const updateData = await updateRes.json();
    assert.strictEqual(updateData.ok, true, 'PUT /teams/:id ok');
    assert.strictEqual(updateData.team.name, 'Tim Garuda Sakti');
    assert.strictEqual(updateData.team.login_code, 'GARUDA88');

    // Verify DB
    const dbTeam = queryOne('SELECT name, login_code FROM teams WHERE id = ?', [firstTeam.id]);
    assert.strictEqual(dbTeam.name, 'Tim Garuda Sakti');
    assert.strictEqual(dbTeam.login_code, 'GARUDA88');

    // 3. Test validation: duplicate code
    const dupRes = await fetch(`${baseUrl}/teams/${getData.teams[1].id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
      },
      body: JSON.stringify({
        name: 'Tim Kedua',
        login_code: 'GARUDA88',
      }),
    });
    assert.strictEqual(dupRes.status, 400, 'Duplicate code rejected');

    // 4. Test validation: too short
    const shortRes = await fetch(`${baseUrl}/teams/${firstTeam.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
      },
      body: JSON.stringify({
        name: 'Tim Garuda Sakti',
        login_code: '123',
      }),
    });
    assert.strictEqual(shortRes.status, 400, 'Short code rejected');

    // 5. POST /teams/regenerate-codes
    const regenRes = await fetch(`${baseUrl}/teams/regenerate-codes`, {
      method: 'POST',
      headers: { 'X-Admin-Token': token },
    });
    const regenData = await regenRes.json();
    assert.strictEqual(regenData.ok, true, 'Regenerate codes ok');

    const allTeams = queryAll('SELECT id, name, login_code FROM teams');
    const codes = allTeams.map((t) => t.login_code);
    const uniqueCodes = new Set(codes);
    assert.strictEqual(uniqueCodes.size, 15, 'All 15 regenerated codes are unique');
    codes.forEach((c) => {
      assert.strictEqual(c.length, 8, 'Regenerated code is 8 chars');
    });

    console.log('PASS: All team management API tests passed successfully!');
  } finally {
    server.close();
    fs.rmSync(dbPath, { force: true });
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
