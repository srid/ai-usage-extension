import assert from "node:assert/strict";
import test from "node:test";
import { formatUsagePercent } from "../src/usage-format.js";

test("formats usage percentages for roomy UI surfaces", () => {
  assert.equal(formatUsagePercent(12.2), "12%");
  assert.equal(formatUsagePercent(99.8), "100%");
  assert.equal(formatUsagePercent(null), "unknown");
});
