import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateAdminCredentials,
  hashAdminPassword,
  signAdminSession,
  verifyAdminSession,
} from "../server/middleware/admin-auth.mjs";

function withAdminEnv(fn) {
  const previous = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ADMIN_SESSION_TTL_MS: process.env.ADMIN_SESSION_TTL_MS,
  };
  process.env.ADMIN_USERNAME = "site-admin";
  process.env.ADMIN_EMAIL = "";
  process.env.ADMIN_PASSWORD_HASH = hashAdminPassword("correct-password", "fixed-test-salt");
  process.env.ADMIN_API_TOKEN = "a".repeat(64);
  process.env.SESSION_SECRET = "b".repeat(64);
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("admin credentials create a verifiable signed session", () => {
  withAdminEnv(() => {
    const admin = authenticateAdminCredentials("site-admin", "correct-password");
    assert.equal(admin.username, "site-admin");

    const session = signAdminSession(admin.username, 1000);
    const verified = verifyAdminSession(session.token, 2000);
    assert.equal(verified.username, "site-admin");
    assert.equal(verified.expiresAt, session.expiresAt);
  });
});

test("admin auth rejects wrong passwords and expired sessions", () => {
  withAdminEnv(() => {
    assert.equal(authenticateAdminCredentials("site-admin", "wrong-password"), null);

    const session = signAdminSession("site-admin", 1000);
    assert.equal(verifyAdminSession(session.token, 1000 + 8 * 60 * 60 * 1000 + 1), null);
  });
});
