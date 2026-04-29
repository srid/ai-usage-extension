import assert from "node:assert/strict";
import test from "node:test";
import { createErrorSnapshot, createUsageSnapshot, isOkSnapshot } from "../src/snapshots.js";

const provider = {
  id: "claude",
  name: "Claude",
  usageUrl: "https://claude.ai/settings/usage"
};

test("normalizes successful usage payloads", () => {
  const snapshot = createUsageSnapshot(provider, {
    status: "ok",
    percentUsed: 72,
    limits: [{ label: "Weekly all models", percentUsed: 72 }]
  }, { reason: "test", tabId: 12 });

  assert.equal(snapshot.providerId, "claude");
  assert.equal(snapshot.status, "ok");
  assert.equal(snapshot.percentRemaining, 28);
  assert.equal(snapshot.reason, "test");
  assert.equal(snapshot.tabId, 12);
  assert.equal(isOkSnapshot(snapshot), true);
});

test("normalizes error snapshots", () => {
  const snapshot = createErrorSnapshot(provider, new Error("boom"));

  assert.equal(snapshot.status, "error");
  assert.equal(snapshot.error, "boom");
  assert.equal(snapshot.percentUsed, null);
  assert.equal(isOkSnapshot(snapshot), false);
});
