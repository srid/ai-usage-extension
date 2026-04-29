import assert from "node:assert/strict";
import test from "node:test";
import { scrapeClaudeUsage } from "../src/providers/claude.js";

test("extracts the highest relevant Claude usage percentage", () => {
  const result = scrapeClaudeUsage(`
    Plan usage limits
    Current session
    24%
    2 hours remaining
    Weekly limits
    All models
    67%
    resets Monday
    Weekly limits
    Opus only
    42%
  `);

  assert.equal(result.status, "ok");
  assert.equal(result.percentUsed, 67);
  assert.equal(result.primaryLimit.label, "Weekly all models");
  assert.equal(result.limits.length, 3);
});

test("reports Cloudflare or challenge pages as temporarily unavailable", () => {
  const result = scrapeClaudeUsage("Just a moment... Enable JavaScript and cookies to continue");
  assert.equal(result.status, "unavailable");
});

test("reports login pages separately from extraction failures", () => {
  const result = scrapeClaudeUsage("Sign in to Claude Continue with Google Continue with email");
  assert.equal(result.status, "needs-login");
});

test("reports missing usage data when no percentages are present", () => {
  const result = scrapeClaudeUsage("Settings Usage Plan usage limits");
  assert.equal(result.status, "not-found");
});
