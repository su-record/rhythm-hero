import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/* One SQLite file, normalised tables. The sync API still moves whole states,
   so saving decomposes a state into rows and loading recomposes it; every
   other reader (a leaderboard across boards, a backup, a SQL browser) gets
   real rows instead of a JSON blob. */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clients (
  client_id   TEXT PRIMARY KEY,
  name        TEXT,
  toy         TEXT,
  toy_name    TEXT,
  profile_created_at TEXT,
  extras_json TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  client_id   TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  position    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  goal        INTEGER NOT NULL DEFAULT 0,
  goal_type   TEXT NOT NULL DEFAULT 'daily',
  status      TEXT NOT NULL DEFAULT 'active',
  PRIMARY KEY (client_id, id)
);
CREATE TABLE IF NOT EXISTS sessions (
  client_id   TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  position    INTEGER NOT NULL,
  category_id TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  source      TEXT NOT NULL,
  status      TEXT NOT NULL,
  memo        TEXT,
  memo_capture_state TEXT,
  memo_capture_created_at TEXT,
  memo_updated_at TEXT,
  updated_at  TEXT,
  deleted_at  TEXT,
  PRIMARY KEY (client_id, id)
);
CREATE INDEX IF NOT EXISTS sessions_by_start ON sessions(client_id, started_at);
`;

const EXTRA_KEYS = ["companion", "assignments", "activeSession", "historyRange", "reflectionRange", "aiReflection"];

function nullable(value) {
  return value === undefined ? null : value;
}

export function openDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, "rhythm-hero.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  // A database from the short-lived weekly_goal build gains the column it lacks.
  const columns = db.prepare("PRAGMA table_info(categories)").all().map((row) => row.name);
  if (!columns.includes("goal_type")) db.exec("ALTER TABLE categories ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'daily'");

  const statements = {
    upsertClient: db.prepare(`
      INSERT INTO clients (client_id, name, toy, toy_name, profile_created_at, extras_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        name = excluded.name, toy = excluded.toy, toy_name = excluded.toy_name,
        profile_created_at = excluded.profile_created_at, extras_json = excluded.extras_json, updated_at = excluded.updated_at`),
    clearCategories: db.prepare("DELETE FROM categories WHERE client_id = ?"),
    clearSessions: db.prepare("DELETE FROM sessions WHERE client_id = ?"),
    insertCategory: db.prepare(`INSERT INTO categories (client_id, id, position, name, color, goal, goal_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    insertSession: db.prepare(`
      INSERT INTO sessions (client_id, id, position, category_id, started_at, ended_at, source, status, memo, memo_capture_state, memo_capture_created_at, memo_updated_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    getClient: db.prepare("SELECT * FROM clients WHERE client_id = ?"),
    getCategories: db.prepare("SELECT * FROM categories WHERE client_id = ? ORDER BY position"),
    getSessions: db.prepare("SELECT * FROM sessions WHERE client_id = ? ORDER BY position"),
    countClients: db.prepare("SELECT COUNT(*) AS count FROM clients"),
  };

  function saveState(clientId, state) {
    const extras = Object.fromEntries(EXTRA_KEYS.filter((key) => state[key] !== undefined).map((key) => [key, state[key]]));
    const updatedAt = state.updatedAt || new Date().toISOString();
    const profile = state.profile || null;
    db.exec("BEGIN");
    try {
      statements.upsertClient.run(clientId, profile?.name ?? null, profile?.toy ?? null, profile?.toyName ?? null, profile?.createdAt ?? null, JSON.stringify(extras), updatedAt);
      statements.clearCategories.run(clientId);
      statements.clearSessions.run(clientId);
      state.categories.forEach((category, position) => {
        statements.insertCategory.run(clientId, category.id, position, category.name, category.color, category.goal ?? 0, category.goalType === "weekly" ? "weekly" : "daily", category.status ?? "active");
      });
      state.sessions.forEach((session, position) => {
        statements.insertSession.run(
          clientId, session.id, position, session.categoryId, session.startedAt, nullable(session.endedAt), session.source, session.status,
          nullable(session.memo), nullable(session.memoCaptureState), nullable(session.memoCaptureCreatedAt), nullable(session.memoUpdatedAt),
          nullable(session.updatedAt), nullable(session.deletedAt),
        );
      });
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function loadState(clientId) {
    const client = statements.getClient.get(clientId);
    if (!client) return null;
    const extras = JSON.parse(client.extras_json);
    const categories = statements.getCategories.all(clientId).map((row) => {
      const category = { id: row.id, name: row.name, color: row.color, goal: row.goal, status: row.status };
      if (row.goal_type === "weekly") category.goalType = "weekly";
      return category;
    });
    const sessions = statements.getSessions.all(clientId).map((row) => {
      const session = { id: row.id, categoryId: row.category_id, startedAt: row.started_at, source: row.source, status: row.status };
      if (row.ended_at !== null) session.endedAt = row.ended_at;
      if (row.memo !== null) session.memo = row.memo;
      if (row.memo_capture_state !== null) session.memoCaptureState = row.memo_capture_state;
      if (row.memo_capture_created_at !== null) session.memoCaptureCreatedAt = row.memo_capture_created_at;
      if (row.memo_updated_at !== null) session.memoUpdatedAt = row.memo_updated_at;
      if (row.updated_at !== null) session.updatedAt = row.updated_at;
      if (row.deleted_at !== null) session.deletedAt = row.deleted_at;
      return session;
    });
    const state = { ...extras, categories, sessions, updatedAt: client.updated_at };
    if (client.name) state.profile = { name: client.name, toy: client.toy, toyName: client.toy_name, createdAt: client.profile_created_at };
    else if ("profile" in extras || extras.companion !== undefined) state.profile = null;
    return state;
  }

  /** One-time import of the JSON-per-client files the server used to write. */
  function importLegacyFiles(dataDir) {
    let imported = 0;
    for (const file of readdirSync(dataDir)) {
      if (!file.endsWith(".json")) continue;
      const clientId = file.slice(0, -5);
      try {
        const state = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
        if (!statements.getClient.get(clientId) && Array.isArray(state?.categories) && Array.isArray(state?.sessions)) {
          saveState(clientId, state);
          imported += 1;
        }
        renameSync(join(dataDir, file), join(dataDir, `${file}.imported`));
      } catch {
        /* A file that is not a state is left alone. */
      }
    }
    return imported;
  }

  return {
    saveState,
    loadState,
    importLegacyFiles: () => (existsSync(dataDir) ? importLegacyFiles(dataDir) : 0),
    clientCount: () => statements.countClients.get().count,
    close: () => db.close(),
  };
}
