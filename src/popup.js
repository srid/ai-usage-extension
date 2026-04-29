import { formatBadgePercent } from "./badge.js";
import { getDefaultProvider } from "./providers/index.js";
import { isOkSnapshot } from "./snapshots.js";
import { SNAPSHOTS_KEY, getProviderSnapshot } from "./storage.js";

const provider = getDefaultProvider();
const content = document.querySelector("#content");
const refreshButton = document.querySelector("#refresh");

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing";
  try {
    const response = await chrome.runtime.sendMessage({ type: "ai-usage:refresh" });
    if (!response?.ok) {
      renderError(response?.error ?? "Refresh failed");
      return;
    }
    await renderLatest();
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[SNAPSHOTS_KEY]) {
    void renderLatest();
  }
});

await renderLatest();

async function renderLatest() {
  const snapshot = await getProviderSnapshot(provider.id);
  if (!snapshot) {
    content.innerHTML = `
      <p class="muted">No ${escapeHtml(provider.name)} usage has been captured yet.</p>
      <p class="muted">Use Refresh to read or open the ${escapeHtml(provider.name)} usage page.</p>
    `;
    return;
  }

  if (!isOkSnapshot(snapshot)) {
    renderError(snapshot.error ?? snapshot.status ?? "Usage unavailable", snapshot);
    return;
  }

  content.innerHTML = `
    <div class="meter-row">
      <span class="label">${escapeHtml(snapshot.primaryLimit?.label ?? "Usage")}</span>
      <span class="value">${formatBadgePercent(snapshot.percentUsed ?? 0)}</span>
    </div>
    <progress max="100" value="${Math.min(100, snapshot.percentUsed ?? 0)}"></progress>
    <p class="muted">${updatedText(snapshot.capturedAt)}</p>
    <ul>
      ${(snapshot.limits ?? []).map(renderLimit).join("")}
    </ul>
  `;
}

function renderLimit(limit) {
  const reset = limit.resetText ? `<div class="muted">${escapeHtml(limit.resetText)}</div>` : "";
  return `
    <li class="meter">
      <div class="meter-row">
        <span class="label">${escapeHtml(limit.label)}</span>
        <span class="value">${formatBadgePercent(limit.percentUsed)}</span>
      </div>
      <progress max="100" value="${Math.min(100, limit.percentUsed)}"></progress>
      ${reset}
    </li>
  `;
}

function renderError(message, snapshot = null) {
  const sample = snapshot?.textSample?.length ? `<p class="muted">${escapeHtml(snapshot.textSample.join(" "))}</p>` : "";
  content.innerHTML = `
    <p class="error">${escapeHtml(message)}</p>
    <p class="muted">${updatedText(snapshot?.capturedAt)}</p>
    ${sample}
  `;
}

function updatedText(capturedAt) {
  if (!capturedAt) {
    return "Not updated yet";
  }
  return `Updated ${new Date(capturedAt).toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
