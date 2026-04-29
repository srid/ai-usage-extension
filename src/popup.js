import { PROVIDERS } from "./providers/index.js";
import { isOkSnapshot } from "./snapshots.js";
import { getProviderSnapshot, providerSnapshotKey } from "./storage.js";
import { formatUsagePercent } from "./usage-format.js";

const providerStorageKeys = new Set(PROVIDERS.map((provider) => providerSnapshotKey(provider.id)));
const content = document.querySelector("#content");
const refreshButton = document.querySelector("#refresh");

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing";
  try {
    const response = await chrome.runtime.sendMessage({ type: "ai-usage:refresh" });
    if (!response?.ok) {
      content.innerHTML = renderError(response?.error ?? "Refresh failed");
      return;
    }
    await renderLatest();
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && Object.keys(changes).some((key) => providerStorageKeys.has(key))) {
    void renderLatest();
  }
});

await renderLatest();

async function renderLatest() {
  const entries = await Promise.all(PROVIDERS.map(async (provider) => ({
    provider,
    snapshot: await getProviderSnapshot(provider.id)
  })));
  content.innerHTML = entries.map(({ provider, snapshot }) => renderProvider(provider, snapshot)).join("");
}

function renderProvider(provider, snapshot) {
  if (!snapshot) {
    return `
      <section class="provider">
      <div class="provider-heading">
        <h2>${escapeHtml(provider.name)}</h2>
        <span class="status-pill muted">No data</span>
      </div>
      <p class="muted">No snapshot yet.</p>
      </section>
    `;
  }

  if (!isOkSnapshot(snapshot)) {
    return renderError(snapshot.error ?? snapshot.status ?? "Usage unavailable", snapshot, provider);
  }

  return `
    <section class="provider">
    <div class="provider-heading">
      <h2>${escapeHtml(provider.name)}</h2>
      ${renderPacePill(snapshot.primaryLimit?.projection)}
    </div>
    ${renderPrimaryMetrics(snapshot)}
    ${renderSnapshotDetails(snapshot)}
    <p class="muted">${updatedText(snapshot.capturedAt)}</p>
    <ul>
      ${(snapshot.limits ?? []).map(renderLimit).join("")}
    </ul>
    </section>
  `;
}

function renderPrimaryMetrics(snapshot) {
  const projection = snapshot.primaryLimit?.projection;
  const projected = projection?.projectedPercentUsed ?? null;
  const progressClass = projection?.status === "within-limit" ? "ok" : projected === null ? "" : "danger";
  return `
    <div class="metric-grid">
      <div class="metric">
        <span>Current</span>
        <strong>${formatUsagePercent(snapshot.percentUsed)}</strong>
      </div>
      <div class="metric">
        <span>Projected</span>
        <strong class="${projected !== null && projected > 100 ? "error" : ""}">${projected === null ? "unknown" : formatUsagePercent(projected)}</strong>
      </div>
    </div>
    <progress class="${progressClass}" max="100" value="${Math.min(100, projected ?? snapshot.percentUsed ?? 0)}"></progress>
  `;
}

function renderLimit(limit) {
  const reset = limit.resetText ? `<div class="muted">${escapeHtml(limit.resetText)}</div>` : "";
  return `
    <li class="meter">
      <div class="meter-row">
        <span class="label">${escapeHtml(limit.label)}</span>
        <span class="value">${formatUsagePercent(limit.percentUsed)}</span>
      </div>
      <progress max="100" value="${Math.min(100, limit.percentUsed)}"></progress>
      ${renderProjection(limit.projection)}
      ${reset}
      <div class="muted">${escapeHtml(limit.rawText ?? "")}</div>
    </li>
  `;
}

function renderSnapshotDetails(snapshot) {
  const primary = snapshot.primaryLimit;
  const projection = primary?.projection;
  const rows = [
    ["Current", formatUsagePercent(snapshot.percentUsed)],
    projection ? ["Projected by reset", formatUsagePercent(projection.projectedPercentUsed)] : null,
    projection ? ["Pace", projection.status === "within-limit" ? "Within weekly limit" : "Over weekly limit"] : null,
    primary?.resetText ? ["Reset", primary.resetText] : null,
    snapshot.sourceUrl ? ["Source", snapshot.sourceUrl] : null
  ].filter(Boolean);

  return `
    <div class="details">
      ${rows.map(([label, value]) => `
        <div class="detail-row">
          <span class="muted">${escapeHtml(label)}</span>
          <span class="${value === "Over weekly limit" ? "error" : ""}">${escapeHtml(value)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderProjection(projection) {
  if (!projection) {
    return "";
  }

  const status = projection.status === "within-limit" ? "On pace to stay within weekly limit" : "On pace to exceed weekly limit";
  const className = projection.status === "within-limit" ? "ok" : "error";
  return `<div class="${className}">Projected ${formatUsagePercent(projection.projectedPercentUsed)} by reset - ${status}</div>`;
}

function renderError(message, snapshot = null, provider = null) {
  const sample = snapshot?.textSample?.length ? `<p class="muted">${escapeHtml(snapshot.textSample.join(" "))}</p>` : "";
  return `
    <section class="provider">
    <div class="provider-heading">
      <h2>${escapeHtml(provider?.name ?? snapshot?.providerName ?? "Provider")}</h2>
      <span class="status-pill error">Error</span>
    </div>
    <p class="error">${escapeHtml(message)}</p>
    <p class="muted">${updatedText(snapshot?.capturedAt)}</p>
    ${sample}
    </section>
  `;
}

function renderPacePill(projection) {
  if (!projection) {
    return `<span class="status-pill muted">No projection</span>`;
  }
  if (projection.status === "within-limit") {
    return `<span class="status-pill ok">Within pace</span>`;
  }
  return `<span class="status-pill error">Over pace</span>`;
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
