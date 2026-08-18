const crypto = require('crypto');
const config = require('../config');

function generateVerificationCode(teamId, teamName, breakdown) {
  const level1Score = breakdown.level_1.score;
  const level2Score = breakdown.level_2.score;
  const level3Score = breakdown.level_3.score;
  const bonus = breakdown.final_resolution ? breakdown.final_resolution.bonus : 0;
  const totalScore = level1Score + level2Score + level3Score + bonus;

  const raw = [
    teamId,
    teamName,
    totalScore,
    level1Score,
    level2Score,
    level3Score,
    bonus,
  ].join('|');

  return crypto
    .createHmac('sha256', config.VERIFICATION_SECRET)
    .update(raw, 'utf8')
    .digest('hex')
    .toUpperCase()
    .slice(0, 8);
}

module.exports = { generateVerificationCode };
