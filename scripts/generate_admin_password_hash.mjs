import { generateAdminPasswordHashCli } from "../server/middleware/admin-auth.mjs";

const password = process.argv[2] || "";

if (password.length < 12) {
  console.error("Usage: npm run admin:hash -- \"en-az-12-karakterli-sifre\"");
  process.exit(1);
}

console.log(generateAdminPasswordHashCli(password));
