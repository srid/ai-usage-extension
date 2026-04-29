import assert from "node:assert/strict";
import test from "node:test";
import { providerSnapshotKey } from "../src/storage.js";

test("uses an isolated storage key per provider", () => {
  assert.equal(providerSnapshotKey("claude"), "usageSnapshot:claude");
  assert.equal(providerSnapshotKey("codex"), "usageSnapshot:codex");
});
