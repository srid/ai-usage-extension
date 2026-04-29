import assert from "node:assert/strict";
import test from "node:test";
import { scrapeCodexUsage } from "../src/providers/codex.js";

const NOW = new Date(2026, 3, 29, 11, 23, 0);

test("extracts only the exact Codex weekly usage card", () => {
  const result = scrapeCodexUsage(`
    <section>
      <article>
        <p>5 hour usage limit</p>
        <span>91%</span><span> remaining </span>
        <span>Resets 12:37 PM</span>
      </article>
      <article>
        <p>Weekly usage limit</p>
        <span>96%</span><span> remaining </span>
        <div style="width: 96%;"></div>
        <span>Resets May 5, 2026 7:38 AM</span>
      </article>
      <article>
        <p>GPT-5.3-Codex-Spark 5 hour usage limit</p>
        <span>100%</span><span> remaining </span>
      </article>
      <article>
        <p>GPT-5.3-Codex-Spark Weekly usage limit</p>
        <span>100%</span><span> remaining </span>
      </article>
    </section>
  `, { now: NOW });

  assert.equal(result.status, "ok");
  assert.equal(result.percentUsed, 4);
  assert.equal(result.percentRemaining, 96);
  assert.equal(result.primaryLimit.label, "Weekly usage");
  assert.equal(result.primaryLimit.resetText, "Resets May 5, 2026 7:38 AM");
  assert.equal(result.limits.length, 1);
  assert.equal(result.projectionStatus, "within-limit");
  assert.ok(result.projectedPercentUsed > 20);
  assert.ok(result.projectedPercentUsed < 30);
});

test("extracts Codex weekly usage from text in the actual card order", () => {
  const result = scrapeCodexUsage(`
    Weekly usage limit
    96%
    remaining
    Resets May 5, 2026 7:38 AM
  `, { now: NOW });

  assert.equal(result.status, "ok");
  assert.equal(result.percentUsed, 4);
  assert.equal(result.projectionStatus, "within-limit");
  assert.ok(result.projectedPercentUsed < 30);
});

test("does not treat model-specific weekly cards as the Codex weekly total", () => {
  const result = scrapeCodexUsage(`
    GPT-5.3-Codex-Spark Weekly usage limit
    100%
    remaining
  `, { now: NOW });

  assert.equal(result.status, "not-found");
});
