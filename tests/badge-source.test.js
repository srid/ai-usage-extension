import assert from "node:assert/strict";
import test from "node:test";
import { selectBadgeSnapshot } from "../src/badge-source.js";

test("selects the provider with the highest projected risk for the badge", () => {
  const claude = {
    providerId: "claude",
    status: "ok",
    percentUsed: 30,
    primaryLimit: {
      projection: { projectedPercentUsed: 90 }
    },
    limits: []
  };
  const codex = {
    providerId: "codex",
    status: "ok",
    percentUsed: 40,
    primaryLimit: {
      projection: { projectedPercentUsed: 130 }
    },
    limits: []
  };

  assert.equal(selectBadgeSnapshot([claude, codex]), codex);
});
