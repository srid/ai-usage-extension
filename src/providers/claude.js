const CLAUDE_USAGE_URL = "https://claude.ai/settings/usage";

export const CLAUDE_PROVIDER = {
  id: "claude",
  name: "Claude",
  extract: scrapeClaudeUsage,
  extractorOptions: {
    ignoreExtraUsage: true,
    providerName: "Claude"
  },
  tabUrlPatterns: ["https://claude.ai/settings/usage*"],
  usageUrl: CLAUDE_USAGE_URL
};

export function scrapeClaudeUsage(textOverride, options = {}) {
  const providerName = options.providerName ?? "Claude";
  const ignoreExtraUsage = options.ignoreExtraUsage ?? true;
  const percentageMode = options.percentageMode ?? "used";
  const pageText = readClaudePageText(textOverride);
  const now = coerceDate(options.now);
  const lines = splitUsageLines(pageText);
  const pageState = detectClaudePageState(lines);

  if (pageState.status !== "ok") {
    return statusResult(pageState.status, pageState.error, lines);
  }

  const extractedLimits = dedupeLimits([
    ...extractDomLimits(textOverride, lines),
    ...extractTextLimits(lines)
  ]);
  const limits = addLimitProjections(trackedClaudeLimits(extractedLimits), now);

  if (limits.length === 0) {
    return statusResult("not-found", `No weekly ${providerName} usage percentages were found on the ${providerName} usage page`, lines);
  }

  const primaryLimit = choosePrimaryLimit(limits);
  return {
    status: "ok",
    pageTitle: typeof document === "undefined" ? null : document.title,
    percentUsed: primaryLimit.percentUsed,
    percentRemaining: Math.max(0, 100 - primaryLimit.percentUsed),
    projectedPercentUsed: primaryLimit.projection?.projectedPercentUsed ?? null,
    projectionStatus: primaryLimit.projection?.status ?? "unknown",
    primaryLimit,
    limits,
    textSample: lines.slice(0, 8)
  };

  function readClaudePageText(overrideText) {
    if (typeof overrideText === "string") {
      return overrideText;
    }
    if (typeof document === "undefined") {
      return "";
    }
    return document.body?.innerText ?? document.documentElement?.innerText ?? "";
  }

  function splitUsageLines(text) {
    return normalizeText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  }

  function detectClaudePageState(candidateLines) {
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

  function extractDomLimits(overrideText, candidateLines) {
    if (typeof document === "undefined" || typeof overrideText === "string") {
      return [];
    }

    const nodes = [
      ...document.querySelectorAll("[role='progressbar']"),
      ...document.querySelectorAll("progress"),
      ...document.querySelectorAll("[aria-valuenow]")
    ];
    return nodes.flatMap((node) => {
      const valueNow = numberFromAttribute(node, "aria-valuenow") ?? numberFromProperty(node, "value");
      const valueMax = numberFromAttribute(node, "aria-valuemax") ?? numberFromProperty(node, "max") ?? 100;
      if (valueNow === null || valueMax <= 0) {
        return [];
      }

      const context = nearbyText(node);
      const percentUsed = clampPercent((valueNow / valueMax) * 100);
      return [{
        label: classifyLimitLabel(context),
        percentUsed,
        resetText: findResetText(context, candidateLines),
        source: "progressbar",
        rawText: trimText(context, 220)
      }];
    });
  }

  function extractTextLimits(candidateLines) {
    const limits = [];
    for (let index = 0; index < candidateLines.length; index += 1) {
      const line = candidateLines[index];
      const percentagePattern = /(^|[^\d.])(\d{1,3}(?:\.\d+)?)\s*%/g;
      let match = percentagePattern.exec(line);
      while (match) {
        const percent = percentUsedFromMatch(Number(match[2]), line);
        const section = enclosingSection(candidateLines, index);
        const context = contextForLine(line, match.index, candidateLines, index, section);
        limits.push({
          label: classifyLimitLabel(context, section),
          percentUsed: percent,
          resetText: findResetText(context, candidateLines, index),
          section,
          source: "text",
          rawText: trimText(context, 220)
        });
        match = percentagePattern.exec(line);
      }
    }
    return limits;
  }

  function choosePrimaryLimit(candidateLimits) {
    return [...candidateLimits].sort((left, right) => {
      const rightScore = limitScore(right);
      const leftScore = limitScore(left);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return right.percentUsed - left.percentUsed;
    })[0];
  }

  function limitScore(limit) {
    let score = 0;
    if (/weekly all models/i.test(limit.label)) {
      score += 300;
    } else if (/all models/i.test(limit.label)) {
      score += 250;
    } else if (/weekly/i.test(limit.label)) {
      score += 200;
    }
    if (/opus|sonnet|design/i.test(limit.label)) {
      score -= 25;
    }
    score += limit.percentUsed / 100;
    return score;
  }

  function addLimitProjections(candidateLimits, currentTime) {
    return candidateLimits.map((limit) => ({
      ...limit,
      projection: projectWeeklyLimit(limit, currentTime)
    }));
  }

  function projectWeeklyLimit(limit, currentTime) {
    if (!isWeeklyLimit(limit) || !limit.resetText) {
      return null;
    }

    const resetAt = parseResetAt(limit.resetText, currentTime);
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
    const projectedPercentUsed = clampPercent(limit.percentUsed / elapsedFraction);
    return {
      elapsedFraction,
      projectedPercentUsed,
      projectedPercentRemaining: Math.max(0, 100 - projectedPercentUsed),
      resetAt: resetAt.toISOString(),
      startedAt: startedAt.toISOString(),
      status: projectedPercentUsed <= 100 ? "within-limit" : "over-limit"
    };
  }

  function parseResetAt(resetText, currentTime) {
    const absoluteResetAt = parseAbsoluteResetAt(resetText, currentTime);
    if (absoluteResetAt) {
      return absoluteResetAt;
    }

    const match = /\bresets?\s+(sun|mon|tue|wed|thu|fri|sat)(?:day)?(?:\s+at)?(?:\s+(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?\b/i.exec(resetText);
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

  function parseAbsoluteResetAt(resetText, currentTime) {
    const match = /\bresets?\s+([a-z]+)\s+(\d{1,2}),?\s+(\d{4})?\s+(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)\b/i.exec(resetText);
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

  function percentUsedFromMatch(percent, line) {
    if (percentageMode === "remaining" || /\bremaining\b/i.test(line)) {
      return clampPercent(100 - percent);
    }
    return clampPercent(percent);
  }

  function trackedClaudeLimits(candidateLimits) {
    const weeklyLimits = candidateLimits.filter((limit) => isWeeklyLimit(limit) && !isIgnoredLimit(limit));
    if (weeklyLimits.length > 0) {
      return weeklyLimits;
    }
    return candidateLimits.filter((limit) => !isIgnoredLimit(limit));
  }

  function isWeeklyLimit(limit) {
    return /weekly usage limit/i.test(limit.section ?? "") || /weekly limits/i.test(limit.section ?? "") || /weekly/i.test(limit.label);
  }

  function isExtraUsageLimit(limit) {
    return /extra usage/i.test(`${limit.label} ${limit.rawText ?? ""}`);
  }

  function isIgnoredLimit(limit) {
    return ignoreExtraUsage && isExtraUsageLimit(limit);
  }

  function dedupeLimits(candidateLimits) {
    const seen = new Set();
    const unique = [];
    for (const limit of candidateLimits) {
      if (!Number.isFinite(limit.percentUsed)) {
        continue;
      }
      const key = `${limit.label}:${Math.round(limit.percentUsed)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(limit);
      }
    }
    return unique.sort((left, right) => right.percentUsed - left.percentUsed);
  }

  function classifyLimitLabel(context, section = "") {
    const text = context.toLowerCase();
    const weekly = /weekly usage limit/i.test(section) || /weekly limits/i.test(section) || /weekly/i.test(text);
    if (/extra usage/.test(text)) {
      return "Extra usage";
    }
    if (/opus/.test(text) && weekly) {
      return "Weekly Opus";
    }
    if (/sonnet/.test(text) && weekly) {
      return "Weekly Sonnet";
    }
    if (/claude design|design/.test(text) && weekly) {
      return "Weekly Claude Design";
    }
    if (weekly && /(all|other)\s+models?/.test(text)) {
      return "Weekly all models";
    }
    if (/(all|other)\s+models?/.test(text)) {
      return "All models";
    }
    if (weekly) {
      return "Weekly usage";
    }
    if (/current session|five-hour|5-hour|5 hour|session/.test(text)) {
      return "Current session";
    }
    return "Usage";
  }

  function contextForLine(line, matchIndex, candidateLines, lineIndex, section) {
    return [
      section,
      contextWindow(line, matchIndex, candidateLines, lineIndex)
    ].filter(Boolean).join(" ");
  }

  function contextWindow(line, matchIndex, candidateLines, lineIndex) {
    const sameLine = line.slice(Math.max(0, matchIndex - 90), Math.min(line.length, matchIndex + 90));
    return [
      candidateLines[lineIndex - 2],
      candidateLines[lineIndex - 1],
      sameLine
    ].filter(Boolean).join(" ");
  }

  function enclosingSection(candidateLines, lineIndex) {
    for (let index = lineIndex; index >= 0; index -= 1) {
      const line = candidateLines[index];
      if (/^(weekly usage limit|weekly limits|additional features|extra usage)$/i.test(line)) {
        return line;
      }
    }
    return "";
  }

  function findResetText(context, candidateLines, lineIndex = null) {
    if (lineIndex !== null) {
      const resetLine = nearestResetLine(candidateLines, lineIndex);
      if (resetLine) {
        return resetLine;
      }
    }

    const related = [context];
    if (lineIndex !== null) {
      related.push(candidateLines[lineIndex - 2], candidateLines[lineIndex - 1], candidateLines[lineIndex + 1], candidateLines[lineIndex + 2]);
    }
    const resetLine = related
      .filter(Boolean)
      .map((line) => normalizeText(line))
      .find((line) => /\b(reset|resets|remaining|renews|available|until)\b/i.test(line));
    return resetLine ? trimText(resetLine, 180) : null;
  }

  function nearestResetLine(candidateLines, lineIndex) {
    const section = enclosingSection(candidateLines, lineIndex);
    for (let index = lineIndex; index >= 0; index -= 1) {
      const line = candidateLines[index];
      if (index !== lineIndex && enclosingSection(candidateLines, index) !== section) {
        break;
      }
      if (/\bresets?\b/i.test(line)) {
        return trimText(line, 180);
      }
    }
    for (let index = lineIndex + 1; index < candidateLines.length; index += 1) {
      const line = candidateLines[index];
      if (enclosingSection(candidateLines, index) !== section) {
        break;
      }
      if (/\bresets?\b/i.test(line)) {
        return trimText(line, 180);
      }
    }
    return null;
  }

  function nearbyText(node) {
    let current = node;
    for (let depth = 0; current && depth < 5; depth += 1) {
      const text = normalizeText(current.innerText ?? current.textContent ?? "");
      if (text && text.length < 800) {
        return text;
      }
      current = current.parentElement;
    }
    return normalizeText(node.getAttribute("aria-label") ?? node.getAttribute("title") ?? "");
  }

  function numberFromAttribute(node, attribute) {
    const value = node.getAttribute(attribute);
    if (value === null || value === "") {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function numberFromProperty(node, property) {
    const value = node[property];
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function statusResult(status, error, sampleLines) {
    return {
      status,
      error,
      limits: [],
      percentUsed: null,
      percentRemaining: null,
      textSample: sampleLines.slice(0, 8)
    };
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function clampPercent(value) {
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

  function trimText(value, maxLength) {
    const text = normalizeText(value);
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  }
}
