const { getDb, queryOne, run } = require('./db');

function hasColumn(tableName, columnName) {
  const db = getDb();
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  if (!result.length) return false;
  return result[0].values.some((row) => row[1] === columnName);
}

function addModeColumn(tableName) {
  if (!hasColumn(tableName, 'mode')) {
    getDb().run(`ALTER TABLE ${tableName} ADD COLUMN mode TEXT NOT NULL DEFAULT 'simulation'`);
  }
}

function migrateFinalResolutions() {
  if (hasColumn('final_resolutions', 'mode')) return;

  const db = getDb();
  db.run('PRAGMA foreign_keys = OFF');
  db.run(`
    CREATE TABLE final_resolutions_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      chosen_candidate TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      bonus_points INTEGER NOT NULL DEFAULT 0,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, mode),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    INSERT INTO final_resolutions_v2
      (id, team_id, mode, chosen_candidate, is_correct, bonus_points, submitted_at)
    SELECT id, team_id, 'simulation', chosen_candidate, is_correct, bonus_points, submitted_at
    FROM final_resolutions
  `);
  db.run('DROP TABLE final_resolutions');
  db.run('ALTER TABLE final_resolutions_v2 RENAME TO final_resolutions');
  db.run('PRAGMA foreign_keys = ON');
}

function initSchema() {
  const db = getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      login_code TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL DEFAULT 'simulation',
      level INTEGER NOT NULL CHECK(level IN (1,2,3)),
      topic TEXT,
      question_text TEXT NOT NULL,
      answer_key TEXT NOT NULL,
      options_json TEXT NOT NULL DEFAULT '[]',
      points INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS team_question_order (
      team_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      display_order INTEGER NOT NULL,
      PRIMARY KEY (team_id, question_id),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, question_id),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL DEFAULT 'simulation',
      level INTEGER NOT NULL CHECK(level IN (1,2,3)),
      min_correct INTEGER NOT NULL,
      max_correct INTEGER NOT NULL,
      clue_text TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clues_unlocked (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      clue_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (clue_id) REFERENCES clues(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS final_resolutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      chosen_candidate TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      bonus_points INTEGER NOT NULL DEFAULT 0,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, mode),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS level_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      level INTEGER NOT NULL CHECK(level IN (1,2,3)),
      answers_json TEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, mode, level),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS level_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      level INTEGER NOT NULL CHECK(level IN (1,2,3)),
      answers_json TEXT NOT NULL DEFAULT '{}',
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      unanswered_count INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      finalized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, mode, level),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS team_competition_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK(status IN ('ACTIVE', 'DISQUALIFIED')),
      reason TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, mode),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playoff_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'simulation',
      playoff_group TEXT NOT NULL,
      position INTEGER NOT NULL,
      notes TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, mode),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL DEFAULT 'simulation',
      actor_type TEXT NOT NULL DEFAULT 'system',
      actor_id TEXT,
      action TEXT NOT NULL,
      team_id INTEGER,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS game_state (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      mode TEXT NOT NULL DEFAULT 'simulation',
      phase TEXT NOT NULL DEFAULT 'lobby',
      level_started_at INTEGER,
      level_duration_seconds INTEGER
    )
  `);

  addModeColumn('questions');
  if (!hasColumn('questions', 'options_json')) {
    db.run("ALTER TABLE questions ADD COLUMN options_json TEXT NOT NULL DEFAULT '[]'");
  }
  addModeColumn('team_question_order');
  addModeColumn('submissions');
  addModeColumn('clues');
  addModeColumn('clues_unlocked');
  addModeColumn('level_drafts');
  addModeColumn('level_results');
  migrateFinalResolutions();
  addModeColumn('game_state');

  const existing = queryOne('SELECT id FROM game_state WHERE id = 1');
  if (!existing) {
    run('INSERT INTO game_state (id, phase) VALUES (1, ?)', ['lobby']);
  }

  console.log('[DB] Schema initialized');
}

module.exports = { initSchema };
