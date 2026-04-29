import { isOkSnapshot } from "./snapshots.js";

const STATUS_TEXT = {
  empty: "...",
  error: "ERR",
  "needs-login": "AUTH",
  "not-found": "?",
  unavailable: "WAIT"
};

const COLORS = {
  idle: "#5f6368",
  ok: "#188038",
  warn: "#f29900",
  danger: "#d93025",
  error: "#b42318"
};

export function buildBadgeState(snapshot) {
  if (!snapshot) {
    return {
      color: COLORS.idle,
      percent: null,
      status: "empty",
      text: STATUS_TEXT.empty,
      title: "AI Usage: no usage snapshot yet"
    };
  }

  const percent = isOkSnapshot(snapshot) ? snapshot.percentUsed : null;
  const status = snapshot.status ?? "error";
  const text = isOkSnapshot(snapshot) ? formatBadgePercent(percent) : statusText(status);
  const color = isOkSnapshot(snapshot) ? colorForPercent(percent) : colorForStatus(status);

  return {
    color,
    percent,
    status,
    text,
    title: buildTitle(snapshot)
  };
}

export function formatBadgePercent(percent) {
  const rounded = Math.max(0, Math.round(percent));
  if (rounded > 999) {
    return "999+";
  }
  return `${rounded}%`;
}

function statusText(status) {
  return STATUS_TEXT[status] ?? "ERR";
}

function colorForStatus(status) {
  if (status === "unavailable") {
    return COLORS.warn;
  }
  if (status === "empty" || status === "not-found") {
    return COLORS.idle;
  }
  return COLORS.error;
}

function colorForPercent(percent) {
  if (percent >= 90) {
    return COLORS.danger;
  }
  if (percent >= 75) {
    return COLORS.warn;
  }
  return COLORS.ok;
}

function buildTitle(snapshot) {
  const providerName = snapshot.providerName ?? snapshot.providerId ?? "AI provider";
  if (!isOkSnapshot(snapshot)) {
    const reason = snapshot.error ?? snapshot.status ?? "unknown";
    return `${providerName} usage: ${reason}`;
  }

  const lines = [`${providerName} usage: ${formatBadgePercent(snapshot.percentUsed ?? 0)} used`];
  for (const limit of snapshot.limits ?? []) {
    const percent = typeof limit.percentUsed === "number" ? ` - ${formatBadgePercent(limit.percentUsed)}` : "";
    lines.push(`${limit.label}${percent}`);
    if (limit.resetText) {
      lines.push(limit.resetText);
    }
  }
  if (snapshot.capturedAt) {
    lines.push(`Updated ${new Date(snapshot.capturedAt).toLocaleString()}`);
  }
  return lines.join("\n");
}
