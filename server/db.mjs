import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", ".hiberota", "database.sqlite");

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS state_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);
} catch (error) {
  console.error("SQLite Init Error:", error);
}

export function loadStateFromDb() {
  if (!db) return {};
  const stateRow = db.prepare('SELECT value FROM state_kv WHERE key = ?').get('global');
  const state = stateRow ? JSON.parse(stateRow.value) : {
      version: 1,
      sources: {},
      sourceCrawlLogs: [],
      callChangeLogs: [],
      manualReviewQueue: [],
      crawlerJobs: [],
      linkHealthChecks: [],
      metrics: {},
      duplicates: []
  };

  const callRows = db.prepare('SELECT id, data FROM calls').all();
  state.calls = {};
  for (const row of callRows) {
    try {
      state.calls[row.id] = JSON.parse(row.data);
    } catch (e) {
      console.error("Failed to parse call", row.id);
    }
  }

  return state;
}

export function saveStateToDb(state) {
  if (!db) return;
  const insertState = db.prepare('INSERT OR REPLACE INTO state_kv (key, value) VALUES (?, ?)');
  const insertCall = db.prepare('INSERT OR REPLACE INTO calls (id, data) VALUES (?, ?)');
  
  const { calls, ...globalState } = state;

  const transaction = db.transaction(() => {
    insertState.run('global', JSON.stringify(globalState));
    
    const callIds = [];
    for (const [id, call] of Object.entries(calls || {})) {
      insertCall.run(id, JSON.stringify(call));
      callIds.push(id);
    }
    
    if (callIds.length > 0) {
      const placeholders = callIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM calls WHERE id NOT IN (${placeholders})`).run(callIds);
    } else {
      db.prepare(`DELETE FROM calls`).run();
    }
  });

  transaction();
}
