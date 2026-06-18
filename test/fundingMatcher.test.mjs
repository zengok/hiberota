import test from "node:test";
import assert from "node:assert/strict";
import { matchGlobalFundingDatabase, normalizeAcademicLevel } from "../server/fundingMatcher.mjs";

test("normalizes common academic levels", () => {
  assert.equal(normalizeAcademicLevel("undergraduate student"), "Undergraduate Students");
  assert.equal(normalizeAcademicLevel("PhD candidate"), "Graduate Students");
  assert.equal(normalizeAcademicLevel("postdoc"), "Postdocs");
  assert.equal(normalizeAcademicLevel("professor"), "Academics");
});

test("matches undergraduate students only to eligible funders and includes official programs", () => {
  const result = matchGlobalFundingDatabase({
    academicLevel: "Undergraduate Student",
    researchField: "engineering",
    targetDestination: "Turkey",
  });

  assert.equal(result.needsClarification, false);
  assert.ok(result.matches.some((item) => item.id === "tubitak"));
  assert.ok(result.matches.every((item) => item.target_audiences.includes("Undergraduate Students")));
  assert.ok(result.matches.find((item) => item.id === "tubitak").example_programs.includes("2209-A Research Project Support Programme for Undergraduate Students"));
  assert.ok(result.matches.every((item) => item.website));
  assert.equal(result.matches.some((item) => item.id === "wellcome"), false);
});

test("prioritizes global aggregator databases for broad global searches", () => {
  const result = matchGlobalFundingDatabase({
    academicLevel: "Postdoc",
    researchField: "life science fellowship",
    targetDestination: "global",
    searchScope: "comprehensive global search",
  });

  const topIds = result.matches.slice(0, 4).map((item) => item.id);
  assert.ok(topIds.includes("pivot_rp") || topIds.includes("grantforward"));
  assert.ok(result.matches.every((item) => item.example_programs.length));
});
