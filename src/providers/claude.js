const CLAUDE_USAGE_URL = "https://claude.ai/settings/usage";

export const CLAUDE_PROVIDER = {
  id: "claude",
  name: "Claude",
  extract: scrapeClaudeUsage,
  tabUrlPatterns: ["https://claude.ai/settings/usage*"],
  usageUrl: CLAUDE_USAGE_URL
};

export function scrapeClaudeUsage(textOverride) {
  const pageText = readClaudePageText(textOverride);
  const lines = splitUsageLines(pageText);
  const pageState = detectClaudePageState(lines);

  if (pageState.status !== "ok") {
    return statusResult(pageState.status, pageState.error, lines);
  }

  const limits = dedupeLimits([
    ...extractDomLimits(textOverride, lines),
    ...extractTextLimits(lines)
  ]);

  if (limits.length === 0) {
    return statusResult("not-found", "No usage percentages were found on the Claude usage page", lines);
  }

  const primaryLimit = choosePrimaryLimit(limits);
  return {
    status: "ok",
    pageTitle: typeof document === "undefined" ? null : document.title,
    percentUsed: primaryLimit.percentUsed,
    percentRemaining: Math.max(0, 100 - primaryLimit.percentUsed),
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
        error: "Claude usage page is not available yet"
      };
    }
    if (/sign in to claude|log in to claude|continue with google|continue with email/i.test(text)) {
      return {
        status: "needs-login",
        error: "Sign in to Claude before usage can be read"
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
        const percent = clampPercent(Number(match[2]));
        const context = contextWindow(line, match.index, candidateLines, index);
        limits.push({
          label: classifyLimitLabel(context),
          percentUsed: percent,
          resetText: findResetText(context, candidateLines, index),
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
    let score = limit.percentUsed;
    if (/weekly/i.test(limit.label)) {
      score += 5;
    }
    if (/all models/i.test(limit.label)) {
      score += 3;
    }
    return score;
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

  function classifyLimitLabel(context) {
    const text = context.toLowerCase();
    if (/extra usage/.test(text)) {
      return "Extra usage";
    }
    if (/opus/.test(text) && /weekly/.test(text)) {
      return "Weekly Opus";
    }
    if (/weekly/.test(text) && /(all|other)\s+models?/.test(text)) {
      return "Weekly all models";
    }
    if (/(all|other)\s+models?/.test(text)) {
      return "All models";
    }
    if (/weekly/.test(text)) {
      return "Weekly usage";
    }
    if (/current session|five-hour|5-hour|5 hour|session/.test(text)) {
      return "Current session";
    }
    return "Usage";
  }

  function contextWindow(line, matchIndex, candidateLines, lineIndex) {
    const sameLine = line.slice(Math.max(0, matchIndex - 90), Math.min(line.length, matchIndex + 90));
    return [
      candidateLines[lineIndex - 2],
      candidateLines[lineIndex - 1],
      sameLine,
      candidateLines[lineIndex + 1]
    ].filter(Boolean).join(" ");
  }

  function findResetText(context, candidateLines, lineIndex = null) {
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

  function trimText(value, maxLength) {
    const text = normalizeText(value);
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  }
}
