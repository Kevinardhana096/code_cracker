const { queryAll, queryOne, run } = require('../db/db');

const WRONG_PENALTY = { 1: -2, 2: -4, 3: -6 };
const UNANSWERED_PENALTY = { 1: -1, 2: -2, 3: -3 };

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function parseOptions(question) {
  const options = parseJson(question.options_json || '[]', []);
  if (!Array.isArray(options)) return [];

  return options
    .filter((option) => option && typeof option.id === 'string')
    .map((option) => ({
      id: option.id.trim().toUpperCase(),
      text: option.text === undefined ? '' : String(option.text),
      image_url: option.image_url || null,
    }));
}

function getLevelQuestions(teamId, mode, level) {
  const ordered = queryAll(
    `SELECT q.id, q.level, q.topic, q.question_text, q.answer_key, q.options_json,
            q.points, tqo.display_order
     FROM questions q
     LEFT JOIN team_question_order tqo
       ON tqo.question_id = q.id AND tqo.team_id = ? AND tqo.mode = ?
     WHERE q.level = ? AND q.mode = ?
     ORDER BY COALESCE(tqo.display_order, q.id)`,
    [teamId, mode, level, mode]
  );

  return ordered;
}

function getDraft(teamId, mode, level) {
  const draft = queryOne(
    'SELECT answers_json, updated_at FROM level_drafts WHERE team_id = ? AND mode = ? AND level = ?',
    [teamId, mode, level]
  );

  return {
    answers: draft ? parseJson(draft.answers_json, {}) : {},
    updated_at: draft ? draft.updated_at : null,
  };
}

function getResult(teamId, mode, level) {
  const result = queryOne(
    `SELECT level, answers_json, correct_count, wrong_count, unanswered_count,
            score, finalized_at
     FROM level_results WHERE team_id = ? AND mode = ? AND level = ?`,
    [teamId, mode, level]
  );

  if (!result) return null;

  return {
    ...result,
    answers: parseJson(result.answers_json, {}),
  };
}

function normalizeAnswers(teamId, mode, level, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { ok: false, error: 'Format pilihan level tidak valid' };
  }

  const questions = getLevelQuestions(teamId, mode, level);
  const questionMap = new Map(questions.map((question) => [String(question.id), question]));
  const normalized = {};

  for (const [questionId, rawOption] of Object.entries(answers)) {
    const question = questionMap.get(String(questionId));
    if (!question) {
      return { ok: false, error: 'Pilihan memuat soal yang tidak valid' };
    }

    if (rawOption === null || rawOption === '') continue;
    const optionId = String(rawOption).trim().toUpperCase();
    const validOptions = new Set(parseOptions(question).map((option) => option.id));
    if (!validOptions.has(optionId)) {
      return { ok: false, error: `Opsi soal ${questionId} tidak valid` };
    }
    normalized[String(question.id)] = optionId;
  }

  return { ok: true, answers: normalized, questions };
}

function saveDraft(teamId, mode, level, answers) {
  const normalized = normalizeAnswers(teamId, mode, level, answers);
  if (!normalized.ok) return normalized;

  if (getResult(teamId, mode, level)) {
    return { ok: false, error: 'Level sudah difinalisasi' };
  }

  const existing = queryOne(
    'SELECT id FROM level_drafts WHERE team_id = ? AND mode = ? AND level = ?',
    [teamId, mode, level]
  );
  const json = JSON.stringify(normalized.answers);

  if (existing) {
    run(
      'UPDATE level_drafts SET answers_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [json, existing.id]
    );
  } else {
    run(
      'INSERT INTO level_drafts (team_id, mode, level, answers_json) VALUES (?, ?, ?, ?)',
      [teamId, mode, level, json]
    );
  }

  return {
    ok: true,
    answers: normalized.answers,
    selected_count: Object.keys(normalized.answers).length,
    total_questions: normalized.questions.length,
  };
}

function finalizeLevel(teamId, mode, level) {
  const existing = getResult(teamId, mode, level);
  if (existing) return existing;

  const questions = getLevelQuestions(teamId, mode, level);
  const draft = getDraft(teamId, mode, level).answers;
  const answers = {};
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let score = 0;

  questions.forEach((question) => {
    const selected = draft[String(question.id)] || null;
    const validOptions = new Set(parseOptions(question).map((option) => option.id));
    const isUnanswered = !selected || !validOptions.has(selected);
    answers[String(question.id)] = isUnanswered ? null : selected;

    if (isUnanswered) {
      unansweredCount += 1;
      score += UNANSWERED_PENALTY[level];
    } else if (selected === String(question.answer_key).trim().toUpperCase()) {
      correctCount += 1;
      score += Number(question.points) || 0;
    } else {
      wrongCount += 1;
      score += WRONG_PENALTY[level];
    }
  });

  run(
    `INSERT INTO level_results
      (team_id, mode, level, answers_json, correct_count, wrong_count,
       unanswered_count, score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [teamId, mode, level, JSON.stringify(answers), correctCount, wrongCount, unansweredCount, score]
  );

  return getResult(teamId, mode, level);
}

function finalizeLevelForAllTeams(mode, level) {
  const teams = queryAll('SELECT id FROM teams ORDER BY id');
  return teams.map((team) => finalizeLevel(team.id, mode, level));
}

module.exports = {
  WRONG_PENALTY,
  UNANSWERED_PENALTY,
  parseOptions,
  getLevelQuestions,
  getDraft,
  getResult,
  saveDraft,
  finalizeLevel,
  finalizeLevelForAllTeams,
};
