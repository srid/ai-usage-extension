const CODEX_USAGE_URL = "https://chatgpt.com/codex/cloud/settings/analytics#usage";

export const CODEX_PROVIDER = {
  id: "codex",
  name: "Codex",
  extract: scrapeCodexUsage,
  extractorOptions: {
    providerName: "Codex"
  },
  tabUrlPatterns: [
    "https://chatgpt.com/codex/cloud/settings/analytics*"
  ],
  usageUrl: CODEX_USAGE_URL
};

export function scrapeCodexUsage(textOverride, options = {}) {
  const providerName = options.providerName ?? "Codex";
  const now = coerceDate(options.now);
  const pageText = readCodexPageText(textOverride);
  const lines = splitUsageLines(pageText);
  const pageState = detectCodexPageState(lines);

  if (pageState.status !== "ok") {
    return statusResult(pageState.status, pageState.error, lines);
  }

  const weeklyCardText = readWeeklyUsageCardText(textOverride, lines);
  if (!weeklyCardText) {
    return statusResult("not-found", `No weekly ${providerName} usage card was found on the ${providerName} usage page`, lines);
  }

  const cardLines = splitUsageLines(weeklyCardText);
  const percentRemaining = extractRemainingPercent(cardLines);
  const resetText = extractResetText(cardLines);

  if (percentRemaining === null) {
    return statusResult("not-found", `No weekly ${providerName} remaining percentage was found on the ${providerName} usage page`, cardLines);
  }

  const percentUsed = clampUsagePercent(100 - percentRemaining);
  const primaryLimit = {
    label: "Weekly usage",
    percentUsed,
    percentRemaining,
    resetText,
    section: "Weekly usage limit",
    source: "weekly-usage-card",
    projection: projectWeeklyLimit(percentUsed, resetText, now)
  };

  return {
    status: "ok",
    pageTitle: typeof document === "undefined" ? null : document.title,
    percentUsed,
    percentRemaining,
    projectedPercentUsed: primaryLimit.projection?.projectedPercentUsed ?? null,
    projectionStatus: primaryLimit.projection?.status ?? "unknown",
    primaryLimit,
    limits: [primaryLimit],
    textSample: cardLines.slice(0, 8)
  };

  function readCodexPageText(overrideText) {
    if (typeof overrideText === "string") {
      return htmlToText(overrideText);
    }
    if (typeof document === "undefined") {
      return "";
    }
    return document.body?.innerText ?? document.documentElement?.innerText ?? "";
  }

  function readWeeklyUsageCardText(overrideText, candidateLines) {
    const domCardText = readWeeklyUsageDomCardText(overrideText);
    if (domCardText) {
      return domCardText;
    }
    return readWeeklyUsageTextCard(candidateLines);
  }

  function readWeeklyUsageDomCardText(overrideText) {
    if (typeof document === "undefined" || typeof overrideText === "string") {
      return null;
    }

    for (const article of document.querySelectorAll("article")) {
      const articleText = normalizeText(article.innerText ?? article.textContent ?? "");
      const articleLines = splitUsageLines(articleText);
      if (articleLines.some(isExactWeeklyUsageTitle)) {
        return articleText;
      }
    }
    return null;
  }

  function readWeeklyUsageTextCard(candidateLines) {
    const startIndex = candidateLines.findIndex(isExactWeeklyUsageTitle);
    if (startIndex === -1) {
      return null;
    }

    const cardLines = [];
    for (let index = startIndex; index < candidateLines.length; index += 1) {
      const line = candidateLines[index];
      if (index !== startIndex && isCodexBalanceCardTitle(line)) {
        break;
      }
      cardLines.push(line);
    }
    return cardLines.join("\n");
  }

  function isExactWeeklyUsageTitle(line) {
    return /^weekly usage limit$/i.test(line.trim());
  }

  function isCodexBalanceCardTitle(line) {
    const text = line.trim();
    return /^(?:5 hour usage limit|weekly usage limit|credits remaining)$/i.test(text)
      || /^gpt-.+(?:5 hour usage limit|weekly usage limit)$/i.test(text);
  }

  function extractRemainingPercent(cardLines) {
    const joined = cardLines.join(" ");
    const inlineMatch = /(\d{1,3}(?:\.\d+)?)\s*%\s*remaining\b/i.exec(joined);
    if (inlineMatch) {
      return clampUsagePercent(Number(inlineMatch[1]));
    }

    for (let index = 0; index < cardLines.length; index += 1) {
      const percentMatch = /^(\d{1,3}(?:\.\d+)?)\s*%$/.exec(cardLines[index]);
      if (percentMatch && /^remaining$/i.test(cardLines[index + 1] ?? "")) {
        return clampUsagePercent(Number(percentMatch[1]));
      }
    }
    return null;
  }

  function extractResetText(cardLines) {
    return cardLines.find((line) => /^resets?\b/i.test(line)) ?? null;
  }

  function projectWeeklyLimit(percentUsedValue, resetTextValue, currentTime) {
    if (!resetTextValue) {
      return null;
    }

    const resetAt = parseResetAt(resetTextValue, currentTime);
    if (!resetAt) {
      return null;
    }

    const periodMs = 7 * 24 * 60 * 60 * 1000;
    const startedAt = new Date(resetAt.getTime() - periodMs);
    const elapsedMs = currentTime.getTime() - startedAt.getTime();
    if (elapsedMs <= 0 || elapsedMs > periodMs) {
      return null;
    }

    const elapsedFraction = elapsedMs / periodMs;
    const projectedPercentUsed = clampProjectedPercent(percentUsedValue / elapsedFraction);
    return {
      elapsedFraction,
      projectedPercentUsed,
      projectedPercentRemaining: Math.max(0, 100 - projectedPercentUsed),
      resetAt: resetAt.toISOString(),
      startedAt: startedAt.toISOString(),
      status: projectedPercentUsed <= 100 ? "within-limit" : "over-limit"
    };
  }

  function parseResetAt(resetTextValue, currentTime) {
    const absoluteResetAt = parseAbsoluteResetAt(resetTextValue, currentTime);
    if (absoluteResetAt) {
      return absoluteResetAt;
    }

    const match = /\bresets?\s+(sun|mon|tue|wed|thu|fri|sat)(?:day)?(?:\s+at)?(?:\s+(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?\b/i.exec(resetTextValue);
    if (!match) {
      return null;
    }

    const dayIndex = weekdayIndex(match[1]);
    const hour = match[2] ? parseHour(Number(match[2]), match[4]) : 0;
    const minute = Number(match[3] ?? 0);
    const resetAt = new Date(currentTime);
    resetAt.setHours(hour, minute, 0, 0);

    const daysUntilReset = (dayIndex - resetAt.getDay() + 7) % 7;
    resetAt.setDate(resetAt.getDate() + daysUntilReset);
    if (resetAt <= currentTime) {
      resetAt.setDate(resetAt.getDate() + 7);
    }
    return resetAt;
  }

  function parseAbsoluteResetAt(resetTextValue, currentTime) {
    const match = /\bresets?\s+([a-z]+)\s+(\d{1,2}),?\s+(\d{4})?\s+(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)\b/i.exec(resetTextValue);
    if (!match) {
      return null;
    }

    const monthIndex = monthIndexFor(match[1]);
    if (monthIndex === -1) {
      return null;
    }

    const year = Number(match[3] ?? currentTime.getFullYear());
    const hour = parseHour(Number(match[4]), match[6]);
    const minute = Number(match[5] ?? 0);
    const resetAt = new Date(currentTime);
    resetAt.setFullYear(year, monthIndex, Number(match[2]));
    resetAt.setHours(hour, minute, 0, 0);
    return resetAt > currentTime ? resetAt : null;
  }

  function monthIndexFor(monthName) {
    return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(monthName.slice(0, 3).toLowerCase());
  }

  function weekdayIndex(dayName) {
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(dayName.slice(0, 3).toLowerCase());
  }

  function parseHour(hour, meridiem) {
    if (!meridiem) {
      return hour;
    }

    const normalized = meridiem.toLowerCase();
    if (normalized.startsWith("p") && hour < 12) {
      return hour + 12;
    }
    if (normalized.startsWith("a") && hour === 12) {
      return 0;
    }
    return hour;
  }

  function detectCodexPageState(candidateLines) {
    const text = candidateLines.join("\n");
    if (/just a moment|enable javascript and cookies|cloudflare|challenge/i.test(text)) {
      return {
        status: "unavailable",
        error: `${providerName} usage page is not available yet`
      };
    }
    if (/\bsign in\b|\blog in\b|continue with google|continue with email/i.test(text)) {
      return {
        status: "needs-login",
        error: `Sign in before ${providerName} usage can be read`
      };
    }
    return { status: "ok" };
  }

  function statusResult(status, error, sampleLines) {
    return {
      status,
      error,
      limits: [],
      percentUsed: null,
      percentRemaining: null,
      projectedPercentUsed: null,
      projectionStatus: "unknown",
      primaryLimit: null,
      textSample: sampleLines.slice(0, 8)
    };
  }

  function splitUsageLines(text) {
    return normalizeText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  }

  function htmlToText(value) {
    return decodeHtmlEntities(String(value ?? ""))
      .replace(/<[^>]*>/g, "\n");
  }

  function decodeHtmlEntities(value) {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function clampUsagePercent(value) {
    return Math.max(0, Math.min(100, Number(value)));
  }

  function clampProjectedPercent(value) {
    return Math.max(0, Math.min(999, Number(value)));
  }

  function coerceDate(value) {
    if (value instanceof Date) {
      return value;
    }
    if (value) {
      return new Date(value);
    }
    return new Date();
  }
}
