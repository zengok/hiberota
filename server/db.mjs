import { createSqliteAutomationRepository } from "./database/sqlite-repository.mjs";

let repository;

function getRepository() {
  if (!repository) repository = createSqliteAutomationRepository();
  return repository;
}

export function loadStateFromDb() {
  return getRepository().loadState();
}

export function saveStateToDb(state) {
  getRepository().saveState(state);
}
