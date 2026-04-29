import assert from "node:assert/strict";
import test from "node:test";
import { scrapeClaudeUsage } from "../src/providers/claude.js";

test("extracts weekly Claude usage and ignores extra usage", () => {
  const result = scrapeClaudeUsage(`
    Plan usage limits
    Current session
    78% used
    2 hours remaining
    Weekly limits
    All models
    29% used
    Resets Mon 5:00 PM
    Sonnet only
    4% used
    Claude Design
    0% used
    Additional features
    Daily included routine runs
    1 / 15
    Extra usage
    CA$283.23 spent
    98% used
  `, { now: new Date(2026, 3, 29, 10, 0, 0) });

  assert.equal(result.status, "ok");
  assert.equal(result.percentUsed, 29);
  assert.equal(result.projectionStatus, "over-limit");
  assert.ok(result.projectedPercentUsed > 100);
  assert.equal(result.primaryLimit.label, "Weekly all models");
  assert.equal(result.primaryLimit.resetText, "Resets Mon 5:00 PM");
  assert.deepEqual(result.limits.map((limit) => limit.label), [
    "Weekly all models",
    "Weekly Sonnet",
    "Weekly Claude Design"
  ]);
  assert.equal(result.limits.some((limit) => limit.label === "Extra usage"), false);
  assert.equal(result.limits.some((limit) => limit.label === "Current session"), false);
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
