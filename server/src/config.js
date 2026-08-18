module.exports = {
  PORT: Number(process.env.CODE_CRACKER_PORT || 3000),
  HOST: '0.0.0.0',

  DB_FILENAME: process.env.CODE_CRACKER_DB_FILENAME || 'code_cracker.db',

  LEVEL_1_DURATION: 5 * 60,
  LEVEL_2_DURATION: 7 * 60,
  LEVEL_3_DURATION: 8 * 60,
  RESOLUTION_DURATION: 3 * 60,
  CASE_FILE_DURATION: 2 * 60,
  CLUE_DURATION: 30,

  ADMIN_PASSWORD: process.env.CODE_CRACKER_ADMIN_PASSWORD || '',
  // Keep this secret on the server only. Override it through the environment
  // before the event so verification codes cannot be recreated by participants.
  VERIFICATION_SECRET: process.env.CODE_CRACKER_VERIFICATION_SECRET || '',

  TEAM_LOGIN_CODES: (process.env.CODE_CRACKER_TEAM_LOGIN_CODES || '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
  OFFICIAL_READY: process.env.CODE_CRACKER_OFFICIAL_READY === 'true',

  CHAMPION_CANDIDATES: [
    { id: 'A', name: 'Kandidat Alpha', description: '...' },
    { id: 'B', name: 'Kandidat Beta', description: '...' },
    { id: 'C', name: 'Kandidat Charlie', description: '...' },
    { id: 'D', name: 'Kandidat Delta', description: '...' },
  ],
  CORRECT_CHAMPION: 'C',

  LEVEL_DURATION_MAP: {
    case_file: Number(process.env.CODE_CRACKER_OFFICIAL_CASE_FILE || 2 * 60),
    level_1: Number(process.env.CODE_CRACKER_OFFICIAL_LEVEL_1 || 5 * 60),
    clue_1: Number(process.env.CODE_CRACKER_OFFICIAL_CLUE_1 || 30),
    level_2: Number(process.env.CODE_CRACKER_OFFICIAL_LEVEL_2 || 7 * 60),
    clue_2: Number(process.env.CODE_CRACKER_OFFICIAL_CLUE_2 || 30),
    level_3: Number(process.env.CODE_CRACKER_OFFICIAL_LEVEL_3 || 8 * 60),
    clue_3: Number(process.env.CODE_CRACKER_OFFICIAL_CLUE_3 || 30),
    resolution: Number(process.env.CODE_CRACKER_OFFICIAL_RESOLUTION || 3 * 60),
  },

  SIMULATION_DURATION_MAP: {
    case_file: Number(process.env.CODE_CRACKER_SIMULATION_CASE_FILE || 10),
    level_1: Number(process.env.CODE_CRACKER_SIMULATION_LEVEL_1 || 30),
    clue_1: Number(process.env.CODE_CRACKER_SIMULATION_CLUE_1 || 5),
    level_2: Number(process.env.CODE_CRACKER_SIMULATION_LEVEL_2 || 45),
    clue_2: Number(process.env.CODE_CRACKER_SIMULATION_CLUE_2 || 5),
    level_3: Number(process.env.CODE_CRACKER_SIMULATION_LEVEL_3 || 60),
    clue_3: Number(process.env.CODE_CRACKER_SIMULATION_CLUE_3 || 5),
    resolution: Number(process.env.CODE_CRACKER_SIMULATION_RESOLUTION || 30),
  },

  GAME_MODES: ['simulation', 'official'],

  VALID_TRANSITIONS: {
    lobby: ['case_file'],
    case_file: ['level_1'],
    level_1: ['clue_1'],
    clue_1: ['level_2'],
    level_2: ['clue_2'],
    clue_2: ['level_3'],
    level_3: ['clue_3'],
    clue_3: ['resolution'],
    resolution: ['finished'],
  },
};
