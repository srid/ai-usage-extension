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

  const percent = typeof snapshot.percentUsed === "number" ? snapshot.percentUsed : null;
  const status = snapshot.status ?? "error";
  const text = status === "ok" && percent !== null ? formatBadgePercent(percent) : statusText(status);
  const color = status === "ok" ? colorForPercent(percent) : colorForStatus(status);

  return {
    color,
    percent,
    status,
    text,
    title: buildTitle(snapshot)
  };
}

export async function applyBadgeState(snapshot) {
  const state = buildBadgeState(snapshot);
  await chrome.action.setBadgeText({ text: state.text });
  await chrome.action.setBadgeBackgroundColor({ color: state.color });
  await chrome.action.setTitle({ title: state.title });
  await setProgressIcon(state);
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
  if (snapshot.status !== "ok") {
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

async function setProgressIcon(state) {
  if (typeof OffscreenCanvas === "undefined" || !chrome.action.setIcon) {
    return;
  }

  const sizes = [16, 32];
  const imageData = {};
  for (const size of sizes) {
    imageData[size] = drawIcon(size, state);
  }
  await chrome.action.setIcon({ imageData });
}

function drawIcon(size, state) {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  const center = size / 2;
  const radius = size * 0.36;
  const lineWidth = Math.max(2, Math.round(size * 0.14));

  context.clearRect(0, 0, size, size);
  context.fillStyle = "#f8fafc";
  context.beginPath();
  context.arc(center, center, size * 0.42, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#c7ccd1";
  context.lineWidth = lineWidth;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.stroke();

  const percent = state.status === "ok" && state.percent !== null ? Math.min(100, Math.max(0, state.percent)) : 0;
  if (percent > 0) {
    context.strokeStyle = state.color;
    context.lineCap = "round";
    context.beginPath();
    context.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (percent / 100));
    context.stroke();
  }

  context.fillStyle = state.status === "ok" ? "#202124" : state.color;
  context.font = `700 ${Math.round(size * 0.38)}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(state.status === "ok" ? String(Math.round(percent)) : "!", center, center + 1);

  return context.getImageData(0, 0, size, size);
}
