const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-cracker-images-'));
process.env.CODE_CRACKER_QUESTIONS_ROOT = root;
const {
  getQuestionImageMap,
  getQuestionImageReport,
  MAX_FILE_SIZE_BYTES,
} = require('../src/services/questionImages');

const directory = path.join(root, 'simulation');
fs.mkdirSync(directory, { recursive: true });
const imagePath = path.join(directory, 'q_987654.png');
const invalidPath = path.join(directory, 'q_987654.txt');
const oversizedPath = path.join(directory, 'q_987655.png');
const widePath = path.join(directory, 'q_987656.png');

// Minimal valid 1x1 PNG used only as a temporary resolver fixture.
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

try {
  fs.writeFileSync(imagePath, onePixelPng);
  fs.writeFileSync(invalidPath, 'not an image');
  fs.writeFileSync(oversizedPath, Buffer.alloc(MAX_FILE_SIZE_BYTES + 1));
  const widePng = Buffer.from(onePixelPng);
  widePng.writeUInt32BE(5000, 16);
  fs.writeFileSync(widePath, widePng);

  const map = getQuestionImageMap('simulation');
  assert.strictEqual(map['987654'], '/uploads/questions/simulation/q_987654.png');
  assert.strictEqual(map['987655'], undefined);
  const report = getQuestionImageReport('simulation');
  assert.strictEqual(report.find((image) => image.question_id === 987655).valid, false);
  assert.strictEqual(report.find((image) => image.question_id === 987656).valid, false);
  console.log('PASS question image resolver');
} finally {
  fs.rmSync(imagePath, { force: true });
  fs.rmSync(invalidPath, { force: true });
  fs.rmSync(oversizedPath, { force: true });
  fs.rmSync(widePath, { force: true });
  fs.rmSync(root, { recursive: true, force: true });
}
