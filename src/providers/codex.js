import { scrapeClaudeUsage } from "./claude.js";

const CODEX_USAGE_URL = "https://chatgpt.com/codex/cloud/settings/analytics#usage";

export const CODEX_PROVIDER = {
  id: "codex",
  name: "Codex",
  extract: scrapeClaudeUsage,
  extractorOptions: {
    ignoreExtraUsage: false,
    percentageMode: "remaining",
    providerName: "Codex"
  },
  tabUrlPatterns: [
    "https://chatgpt.com/codex/cloud/settings/analytics*"
  ],
  usageUrl: CODEX_USAGE_URL
};
