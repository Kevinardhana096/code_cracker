const assert = require('assert');
const express = require('express');
const { initDb, queryOne } = require('../src/db/db');
const { initSchema } = require('../src/db/schema');
const { seedData } = require('../src/db/seed');
const { generateVerificationCode } = require('../src/services/verify');
const { getScoreBreakdown } = require('../src/services/scoring');
const adminRoutes = require('../src/routes/admin');
const { issueAdminToken } = require('../src/middleware/auth');

async function runTest() {
  await initDb();
  initSchema();
  seedData();

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const token = issueAdminToken();

  try {
    // 1. Get a team and its real code
    const team = queryOne('SELECT id, name FROM teams WHERE id = 1');
    const breakdown = getScoreBreakdown(team.id, 'simulation');
    const realCode = generateVerificationCode(team.id, team.name, breakdown);

    // 2. Test valid code
    const validRes = await fetch(`http://localhost:${port}/api/admin/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
      },
      body: JSON.stringify({ code: realCode }),
    });
    const validData = await validRes.json();
    assert.strictEqual(validRes.status, 200);
    assert.strictEqual(validData.ok, true);
    assert.strictEqual(validData.matched, true);
    assert.strictEqual(validData.team.id, 1);
    assert.strictEqual(validData.code, realCode);
    console.log('PASS: Valid code correctly recognized for team 1');

    // 3. Test invalid code
    const invalidRes = await fetch(`http://localhost:${port}/api/admin/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
      },
      body: JSON.stringify({ code: 'ZZZZ9999' }),
    });
    const invalidData = await invalidRes.json();
    assert.strictEqual(invalidRes.status, 200);
    assert.strictEqual(invalidData.ok, true);
    assert.strictEqual(invalidData.matched, false);
    console.log('PASS: Invalid code correctly rejected');

    // 4. Test wrong length
    const badRes = await fetch(`http://localhost:${port}/api/admin/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token,
      },
      body: JSON.stringify({ code: '123' }),
    });
    assert.strictEqual(badRes.status, 400);
    console.log('PASS: Bad length rejected with 400');

    console.log('\nALL VERIFICATION CODE TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
