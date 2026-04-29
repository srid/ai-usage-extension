import assert from "node:assert/strict";
import test from "node:test";
import { scrapeClaudeUsage } from "../src/providers/claude.js";

test("extracts projected Codex weekly usage from analytics text", () => {
  const result = scrapeClaudeUsage(`
    Codex usage
    Weekly limits
    Cloud tasks
    40% used
    Resets Fri 9:00 AM
  `, {
    ignoreExtraUsage: false,
    now: new Date(2026, 3, 25, 9, 0, 0),
    providerName: "Codex"
  });

  assert.equal(result.status, "ok");
  assert.equal(result.percentUsed, 40);
  assert.equal(result.projectionStatus, "over-limit");
  assert.ok(result.projectedPercentUsed > 100);
});
