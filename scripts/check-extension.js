import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background.type, "module");
assert.equal(manifest.background.service_worker, "src/background.js");
assert.deepEqual(new Set(manifest.permissions), new Set(["alarms", "scripting", "storage", "tabs"]));
assert.ok(manifest.host_permissions.includes("https://claude.ai/*"));
assert.equal(manifest.action.default_popup, "popup.html");

const requiredFiles = [
  "popup.html",
  "src/background.js",
  "src/badge.js",
  "src/badge-icon.js",
  "src/badge-view.js",
  "src/providers/claude.js",
  "src/providers/index.js",
  "src/providers/reader.js",
  "src/popup.js",
  "src/snapshots.js",
  "src/storage.js",
  "src/tabs.js",
  "src/usage-format.js"
];

await Promise.all(requiredFiles.map((path) => access(path)));

const { scrapeClaudeUsage } = await import("../src/providers/claude.js");
const result = scrapeClaudeUsage("Plan usage limits\nCurrent session\n15%\nWeekly limits\nAll models\n80%\nresets Monday");
assert.equal(result.status, "ok");
assert.equal(result.percentUsed, 80);
