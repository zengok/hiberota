import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const migrationsDir = path.join(__dirname, "migrations");
const DEFAULT_STATE = {
  version: 1,
  sources: {},
  sourceCrawlLogs: [],
  callChangeLogs: [],
  manualReviewQueue: [],
  crawlerJobs: [],
  linkHealthChecks: [],
  metrics: {},
  duplicates: [],
  calls: {},
};

const CALL_COLUMNS = {
  slug: "TEXT",
  title: "TEXT NOT NULL DEFAULT ''",
  funder: "TEXT",
  programme: "TEXT",
  source_id: "TEXT",
  status: "TEXT",
  normalized_status: "TEXT",
  scope: "TEXT",
  category: "TEXT",
  deadline: "TEXT",
  published_at: "TEXT",
  budget_min: "REAL",
  budget_max: "REAL",
  currency: "TEXT",
  url: "TEXT",
  official_url: "TEXT",
  application_url: "TEXT",
  confidence_score: "REAL",
  review_status: "TEXT",
  is_published: "INTEGER NOT NULL DEFAULT 0",
  content_hash: "TEXT",
  first_detected_at: "TEXT",
  last_detected_at: "TEXT",
  last_verified_at: "TEXT",
  created_at: "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
  updated_at: "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
};

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function hashPayload(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asBooleanInt(value) {
  return value ? 1 : 0;
}

function getDbPath(options = {}) {
  return path.resolve(options.databasePath || process.env.DATABASE_PATH || process.env.SQLITE_DATABASE_PATH || path.join(root, ".hiberota", "database.sqlite"));
}

function ensureCallColumns(db) {
  const existing = new Set(db.prepare("PRAGMA table_info(calls)").all().map((row) => row.name));
  for (const [name, definition] of Object.entries(CALL_COLUMNS)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE calls ADD COLUMN ${name} ${definition}`);
  }
}

function ensureStateColumns(db) {
  const existing = new Set(db.prepare("PRAGMA table_info(state_kv)").all().map((row) => row.name));
  if (!existing.has("updated_at")) db.exec("ALTER TABLE state_kv ADD COLUMN updated_at TEXT");
}

function applyPragmas(db) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
}

function applyMigrations(db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(db.prepare("SELECT id FROM schema_migrations").all().map((row) => row.id));
  const files = fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort() : [];
  const runMigration = db.transaction((file) => {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    db.prepare("INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(file, new Date().toISOString());
  });
  for (const file of files) {
    if (!applied.has(file)) runMigration(file);
  }
  ensureStateColumns(db);
  ensureCallColumns(db);
}

function callColumns(call, contentHash) {
  return {
    id: call.id,
    slug: call.slug || call.id,
    title: call.title || "",
    funder: call.funder || call.institution || "",
    programme: call.programme || call.program || "",
    source_id: call.sourceId || call.source || "",
    status: call.status || "",
    normalized_status: call.normalizedStatus || "",
    scope: call.scope || "",
    category: call.category || "",
    deadline: call.deadline || null,
    published_at: call.publishedAt || null,
    budget_min: call.budgetMin ?? null,
    budget_max: call.budgetMax ?? null,
    currency: call.currency || "",
    url: call.url || "",
    official_url: call.officialUrl || call.url || "",
    application_url: call.applicationUrl || "",
    confidence_score: call.confidenceScore ?? null,
    review_status: call.reviewStatus || "",
    is_published: asBooleanInt(call.isPublished),
    content_hash: contentHash,
    data: json(call),
    first_detected_at: call.firstDetectedAt || null,
    last_detected_at: call.lastDetectedAt || null,
    last_verified_at: call.lastVerifiedAt || null,
  };
}

function createStatements(db) {
  return {
    loadState: db.prepare("SELECT value FROM state_kv WHERE key = ?"),
    loadCalls: db.prepare("SELECT id, data FROM calls"),
    loadCallHashes: db.prepare("SELECT id, content_hash FROM calls"),
    saveState: db.prepare(`
      INSERT INTO state_kv (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `),
    upsertCall: db.prepare(`
      INSERT INTO calls (
        id, slug, title, funder, programme, source_id, status, normalized_status, scope, category,
        deadline, published_at, budget_min, budget_max, currency, url, official_url, application_url,
        confidence_score, review_status, is_published, content_hash, data, first_detected_at,
        last_detected_at, last_verified_at, updated_at
      )
      VALUES (
        @id, @slug, @title, @funder, @programme, @source_id, @status, @normalized_status, @scope, @category,
        @deadline, @published_at, @budget_min, @budget_max, @currency, @url, @official_url, @application_url,
        @confidence_score, @review_status, @is_published, @content_hash, @data, @first_detected_at,
        @last_detected_at, @last_verified_at, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        funder = excluded.funder,
        programme = excluded.programme,
        source_id = excluded.source_id,
        status = excluded.status,
        normalized_status = excluded.normalized_status,
        scope = excluded.scope,
        category = excluded.category,
        deadline = excluded.deadline,
        published_at = excluded.published_at,
        budget_min = excluded.budget_min,
        budget_max = excluded.budget_max,
        currency = excluded.currency,
        url = excluded.url,
        official_url = excluded.official_url,
        application_url = excluded.application_url,
        confidence_score = excluded.confidence_score,
        review_status = excluded.review_status,
        is_published = excluded.is_published,
        content_hash = excluded.content_hash,
        data = excluded.data,
        first_detected_at = COALESCE(calls.first_detected_at, excluded.first_detected_at),
        last_detected_at = excluded.last_detected_at,
        last_verified_at = excluded.last_verified_at,
        updated_at = CURRENT_TIMESTAMP
    `),
    insertVersion: db.prepare("INSERT INTO call_versions (call_id, content_hash, payload, created_at) VALUES (?, ?, ?, ?)"),
    deleteMissingCall: db.prepare("DELETE FROM calls WHERE id = ?"),
  };
}

export function createSqliteAutomationRepository(options = {}) {
  const databasePath = getDbPath(options);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  applyPragmas(db);
  applyMigrations(db);
  const statements = createStatements(db);
  let lastSaveStats = { insertedOrUpdated: 0, unchanged: 0, deleted: 0, versionsCreated: 0 };

  function loadState() {
    const stateRow = statements.loadState.get("global");
    const state = stateRow ? { ...DEFAULT_STATE, ...parseJson(stateRow.value, {}) } : { ...DEFAULT_STATE };
    const callRows = statements.loadCalls.all();
    state.calls = {};
    for (const row of callRows) {
      state.calls[row.id] = parseJson(row.data, null);
      if (!state.calls[row.id]) delete state.calls[row.id];
    }
    return state;
  }

  const saveTransaction = db.transaction((state) => {
    const now = new Date().toISOString();
    const { calls = {}, ...globalState } = state || {};
    const incomingIds = new Set(Object.keys(calls));
    const existingHashes = new Map(statements.loadCallHashes.all().map((row) => [row.id, row.content_hash]));
    const stats = { insertedOrUpdated: 0, unchanged: 0, deleted: 0, versionsCreated: 0 };

    statements.saveState.run("global", json(globalState), now);

    for (const [id, call] of Object.entries(calls)) {
      const payloadHash = call.contentHash || hashPayload(call);
      if (existingHashes.get(id) === payloadHash) {
        stats.unchanged += 1;
        continue;
      }
      const row = callColumns({ ...call, id }, payloadHash);
      statements.upsertCall.run(row);
      statements.insertVersion.run(id, payloadHash, row.data, now);
      stats.insertedOrUpdated += 1;
      stats.versionsCreated += 1;
    }

    for (const id of existingHashes.keys()) {
      if (!incomingIds.has(id)) {
        statements.deleteMissingCall.run(id);
        stats.deleted += 1;
      }
    }

    lastSaveStats = stats;
  });

  return {
    databasePath,
    loadState,
    saveState(state) {
      saveTransaction(state);
    },
    getLastSaveStats() {
      return { ...lastSaveStats };
    },
    close() {
      db.close();
    },
  };
}
