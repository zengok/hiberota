import test from "node:test";
import assert from "node:assert/strict";
import { isSafeUrl, validateUrlSafety } from "../server/security/url-safety.mjs";
import { isSafeCrawlerUrl } from "../server/automation.mjs";

test("url safety accepts public http and https URLs", () => {
  assert.equal(isSafeUrl("https://example.com/call"), true);
  assert.equal(isSafeUrl("http://example.org/list"), true);
});

test("url safety rejects unsafe protocols and private hosts", () => {
  assert.equal(validateUrlSafety("file:///etc/passwd").reason, "unsupported_protocol");
  assert.equal(validateUrlSafety("ftp://example.com/file").reason, "unsupported_protocol");
  assert.equal(validateUrlSafety("http://localhost:3000").reason, "private_host");
  assert.equal(validateUrlSafety("http://127.0.0.1:3000").reason, "private_host");
});

test("url safety rejects private IPv4, metadata and IPv6 ranges", () => {
  assert.equal(validateUrlSafety("http://10.0.0.1").reason, "private_ipv4");
  assert.equal(validateUrlSafety("http://172.16.2.3").reason, "private_ipv4");
  assert.equal(validateUrlSafety("http://192.168.1.10").reason, "private_ipv4");
  assert.equal(validateUrlSafety("http://169.254.169.254/latest/meta-data").reason, "metadata_endpoint");
  assert.equal(validateUrlSafety("http://[::1]/").reason, "private_ipv6");
  assert.equal(validateUrlSafety("http://[fd00::1]/").reason, "private_ipv6");
  assert.equal(validateUrlSafety("http://[fe80::1]/").reason, "private_ipv6");
});

test("automation isSafeCrawlerUrl uses shared URL safety rules", () => {
  assert.equal(isSafeCrawlerUrl("https://example.com/call"), true);
  assert.equal(isSafeCrawlerUrl("gopher://example.com"), false);
  assert.equal(isSafeCrawlerUrl("http://169.254.169.254/latest/meta-data"), false);
});
