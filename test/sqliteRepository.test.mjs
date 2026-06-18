import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { createSqliteAutomationRepository } from "../server/database/sqlite-repository.mjs";

function makeTempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hiberota-db-")), "database.sqlite");
}

test("sqlite repository applies normalized schema and skips unchanged call writes", () => {
  const databasePath = makeTempDbPath();
  const repository = createSqliteAutomationRepository({ databasePath });

  const state = {
    version: 1,
    sources: {},
    sourceCrawlLogs: [],
    callChangeLogs: [],
    manualReviewQueue: [],
    crawlerJobs: [],
    linkHealthChecks: [],
    metrics: {},
    duplicates: [],
    calls: {
      call_a: {
        id: "call_a",
        slug: "call-a",
        title: "Açık Hibe Çağrısı",
        funder: "TÜBİTAK",
        sourceId: "tubitak",
        status: "open",
        normalizedStatus: "OPEN",
        scope: "Ulusal",
        deadline: "2099-07-01T00:00:00.000Z",
        isPublished: true,
      },
    },
  };

  repository.saveState(state);
  assert.deepEqual(repository.getLastSaveStats(), { insertedOrUpdated: 1, unchanged: 0, deleted: 0, versionsCreated: 1 });

  repository.saveState(state);
  assert.deepEqual(repository.getLastSaveStats(), { insertedOrUpdated: 0, unchanged: 1, deleted: 0, versionsCreated: 0 });

  repository.saveState({
    ...state,
    calls: {
      call_a: {
        ...state.calls.call_a,
        title: "Açık Hibe Çağrısı Güncellendi",
      },
    },
  });
  assert.deepEqual(repository.getLastSaveStats(), { insertedOrUpdated: 1, unchanged: 0, deleted: 0, versionsCreated: 1 });

  const loaded = repository.loadState();
  assert.equal(loaded.calls.call_a.title, "Açık Hibe Çağrısı Güncellendi");
  repository.close();

  const db = new Database(databasePath, { readonly: true });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM call_versions").get().count, 2);
  assert.equal(db.prepare("SELECT title FROM calls WHERE id = ?").get("call_a").title, "Açık Hibe Çağrısı Güncellendi");
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'calls_deadline_idx'").get());
  db.close();
});
