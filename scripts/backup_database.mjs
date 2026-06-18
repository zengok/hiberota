import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const source = path.resolve(process.env.DATABASE_PATH || process.env.SQLITE_DATABASE_PATH || path.join(root, ".hiberota", "database.sqlite"));
const backupDir = path.resolve(process.env.DATABASE_BACKUP_DIR || path.join(root, ".hiberota", "backups"));

if (!fs.existsSync(source)) {
  console.error(`Database not found: ${source}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(backupDir, `database-${stamp}.sqlite`);
fs.copyFileSync(source, target);
console.log(target);
