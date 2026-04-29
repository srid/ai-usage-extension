import assert from "node:assert/strict";
import test from "node:test";
import { buildBadgeState, formatBadgePercent } from "../src/badge.js";

test("formats badge percentages for compact icon text", () => {
  assert.equal(formatBadgePercent(0), "0%");
  assert.equal(formatBadgePercent(82.4), "82%");
  assert.equal(formatBadgePercent(100), "100%");
});

test("builds an ok badge state from a usage snapshot", () => {
  const state = buildBadgeState({
    providerName: "Claude",
    status: "ok",
    percentUsed: 82,
    capturedAt: "2026-04-29T14:00:00.000Z",
    limits: [{ label: "Weekly all models", percentUsed: 82 }]
  });

  assert.equal(state.text, "82%");
  assert.equal(state.status, "ok");
  assert.match(state.title, /Claude usage/);
});

test("uses projected weekly usage for badge state when available", () => {
  const state = buildBadgeState({
    providerName: "Claude",
    status: "ok",
    percentUsed: 29,
    primaryLimit: {
      label: "Weekly all models",
      percentUsed: 29,
      projection: {
        projectedPercentUsed: 118,
        status: "over-limit"
      }
    },
    limits: []
  });

  assert.equal(state.text, "118%");
  assert.match(state.title, /projected usage/);
  assert.match(state.title, /over weekly limit/);
});

test("builds an error badge state without throwing", () => {
  const state = buildBadgeState({
    providerName: "Claude",
    status: "needs-login",
    error: "Sign in to Claude before usage can be read"
  });

  assert.equal(state.text, "AUTH");
  assert.match(state.title, /Sign in/);
});
