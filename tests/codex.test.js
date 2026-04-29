import assert from "node:assert/strict";
import test from "node:test";
import { scrapeClaudeUsage } from "../src/providers/claude.js";

test("extracts projected Codex weekly usage from analytics text", () => {
  const result = scrapeClaudeUsage(`
    Codex usage
    Weekly limits
    Cloud tasks
    96% remaining
    Resets May 5, 2026 7:38 AM
  `, {
    ignoreExtraUsage: false,
    now: new Date(2026, 3, 29, 10, 0, 0),
    percentageMode: "remaining",
    providerName: "Codex"
  });

  assert.equal(result.status, "ok");
  assert.equal(result.percentUsed, 4);
  assert.equal(result.primaryLimit.resetText, "Resets May 5, 2026 7:38 AM");
  assert.equal(result.projectionStatus, "within-limit");
  assert.ok(result.projectedPercentUsed > 4);
  assert.ok(result.projectedPercentUsed < 100);
});

test("extracts Codex weekly usage from the actual card text order", () => {
  const result = scrapeClaudeUsage(`
    Weekly usage limit
    96%
    remaining
    Resets May 5, 2026 7:38 AM
  `, {
    ignoreExtraUsage: false,
    now: new Date(2026, 3, 29, 11, 19, 0),
    percentageMode: "remaining",
    providerName: "Codex"
  });

  assert.equal(result.status, "ok");
  assert.equal(result.percentUsed, 4);
  assert.equal(result.primaryLimit.resetText, "Resets May 5, 2026 7:38 AM");
  assert.equal(result.projectionStatus, "within-limit");
  assert.ok(result.projectedPercentUsed > 20);
  assert.ok(result.projectedPercentUsed < 30);
});
