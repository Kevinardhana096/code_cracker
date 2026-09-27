const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);
const QUESTIONS_ROOT = process.env.CODE_CRACKER_QUESTIONS_ROOT
  ? path.resolve(process.env.CODE_CRACKER_QUESTIONS_ROOT)
  : path.join(__dirname, '..', '..', 'public', 'uploads', 'questions');
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 4096;

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) return null;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;

    const isSizeMarker = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);
    if (isSizeMarker && offset + 7 < buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function readImageDimensions(buffer, extension) {
  const ext = extension.toLowerCase();
  if (ext === 'png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (ext === 'gif' && buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (ext === 'jpg' || ext === 'jpeg') return readJpegDimensions(buffer);
  if (ext === 'webp' && buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP' && buffer.toString('ascii', 12, 16) === 'VP8X') {
    return {
      width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
      height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
    };
  }
  return null;
}

function inspectImage(filePath, extension) {
  const stat = fs.statSync(filePath);
  const result = {
    size_bytes: stat.size,
    width: null,
    height: null,
    valid: true,
    issues: [],
  };

  if (stat.size > MAX_FILE_SIZE_BYTES) {
    result.valid = false;
    result.issues.push(`Ukuran melebihi ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
    return result;
  }

  const dimensions = readImageDimensions(fs.readFileSync(filePath), extension);
  if (dimensions) {
    result.width = dimensions.width;
    result.height = dimensions.height;
    if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
      result.valid = false;
      result.issues.push(`Dimensi melebihi ${MAX_IMAGE_DIMENSION}px`);
    }
  }

  return result;
}

function getQuestionImageReport(mode) {
  const directory = path.join(QUESTIONS_ROOT, mode);
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const match = /^q_(\d+)\.([a-z0-9]+)$/i.exec(entry.name);
      if (!match || !IMAGE_EXTENSIONS.has(match[2].toLowerCase())) return null;

      const questionId = String(Number(match[1]));
      const extension = match[2].toLowerCase();
      const inspection = inspectImage(path.join(directory, entry.name), extension);
      return {
        question_id: Number(questionId),
        filename: entry.name,
        extension,
        url: `/uploads/questions/${mode}/${entry.name}`,
        ...inspection,
      };
    })
    .filter(Boolean);
}

function getQuestionImageMap(mode) {
  const imageMap = {};
  getQuestionImageReport(mode).forEach((image) => {
    if (image.valid && !imageMap[String(image.question_id)]) {
      imageMap[String(image.question_id)] = image.url;
    }
  });

  return imageMap;
}

// Menyimpan gambar yang diunggah dari panel admin sebagai q_<questionId>.<ext>.
// Menghapus varian ekstensi lama untuk soal yang sama. Mengembalikan { issues } bila tidak valid.
function saveQuestionImage(mode, questionId, extension, buffer) {
  const ext = String(extension || '').toLowerCase().replace(/^\./, '');
  if (!IMAGE_EXTENSIONS.has(ext)) {
    return { ok: false, issues: [`Ekstensi .${ext} tidak didukung (gunakan: ${[...IMAGE_EXTENSIONS].join(', ')})`] };
  }

  const directory = path.join(QUESTIONS_ROOT, mode);
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `q_${questionId}.${ext}`);
  fs.writeFileSync(filePath, buffer);

  const inspection = inspectImage(filePath, ext);
  if (!inspection.valid) {
    fs.unlinkSync(filePath);
    return { ok: false, issues: inspection.issues };
  }

  // Bersihkan varian lama (misal q_5.png diganti q_5.jpg)
  for (const entry of fs.readdirSync(directory)) {
    const match = /^q_(\d+)\.([a-z0-9]+)$/i.exec(entry);
    if (match && Number(match[1]) === Number(questionId) && match[2].toLowerCase() !== ext) {
      fs.unlinkSync(path.join(directory, entry));
    }
  }

  return { ok: true, filename: `q_${questionId}.${ext}`, ...inspection };
}

module.exports = {
  getQuestionImageMap,
  getQuestionImageReport,
  saveQuestionImage,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
};
