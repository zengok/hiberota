import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JOB_TYPES, SOURCE_REGISTRY } from "../server/automation.mjs";
import { JOB_TYPES as CONTRACT_JOB_TYPES } from "../server/contracts/automation-job.mjs";
import { NORMALIZED_STATUSES } from "../server/contracts/funding-call.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("web routes do not import scraper modules or run scheduled jobs directly", () => {
  const index = read("server/index.mjs");
  assert.doesNotMatch(index, /from\s+["']\.\/scrapers\/index\.mjs["']/);
  assert.doesNotMatch(index, /createScraperStrategies\s*\(/);
  assert.doesNotMatch(index, /runScheduledJobs\s*\(/);
});

test("worker uses the public automation entry point", () => {
  const worker = read("scripts/worker.mjs");
  assert.match(worker, /from\s+["']\.\.\/server\/automation\/index\.mjs["']/);
  assert.match(worker, /runScheduledJobs\s*\(/);
});

test("shared contracts expose status and job values from one source", () => {
  assert.equal(CONTRACT_JOB_TYPES.DISCOVER_SOURCE, JOB_TYPES.DISCOVER_SOURCE);
  assert.equal(NORMALIZED_STATUSES.OPEN, "OPEN");
});

test("source registry has unique IDs", () => {
  const ids = SOURCE_REGISTRY.map((source) => source.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("worktree environment example documents an absolute shared database path", () => {
  const envExample = read(".env.worktree.example");
  assert.match(envExample, /DATABASE_PATH=\/absolute\/path\/to\/shared\/hiberota-data\/database\.sqlite/);
  assert.match(envExample, /Relative paths create one SQLite file per worktree/);
});
