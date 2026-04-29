export function createUsageSnapshot(provider, usage, metadata = {}) {
  const base = snapshotBase(provider, metadata);
  if (usage?.status === "ok") {
    return {
      ...base,
      status: "ok",
      pageTitle: usage.pageTitle ?? null,
      percentRemaining: finiteNumber(usage.percentRemaining) ?? Math.max(0, 100 - usage.percentUsed),
      percentUsed: requiredNumber(usage.percentUsed, "percentUsed"),
      primaryLimit: usage.primaryLimit ?? null,
      limits: Array.isArray(usage.limits) ? usage.limits : [],
      textSample: Array.isArray(usage.textSample) ? usage.textSample : []
    };
  }

  return {
    ...base,
    status: usage?.status ?? "error",
    error: usage?.error ?? "Usage could not be read",
    percentRemaining: null,
    percentUsed: null,
    primaryLimit: null,
    limits: Array.isArray(usage?.limits) ? usage.limits : [],
    textSample: Array.isArray(usage?.textSample) ? usage.textSample : []
  };
}

export function createErrorSnapshot(provider, error, metadata = {}) {
  return {
    ...snapshotBase(provider, metadata),
    status: "error",
    error: error instanceof Error ? error.message : String(error),
    percentRemaining: null,
    percentUsed: null,
    primaryLimit: null,
    limits: [],
    textSample: []
  };
}

export function isOkSnapshot(snapshot) {
  return snapshot?.status === "ok" && typeof snapshot.percentUsed === "number" && Array.isArray(snapshot.limits);
}

function snapshotBase(provider, metadata) {
  return {
    providerId: provider.id,
    providerName: provider.name,
    capturedAt: metadata.capturedAt ?? new Date().toISOString(),
    reason: metadata.reason ?? null,
    sourceUrl: metadata.sourceUrl ?? provider.usageUrl,
    tabId: metadata.tabId ?? null
  };
}

function requiredNumber(value, fieldName) {
  const number = finiteNumber(value);
  if (number === null) {
    throw new Error(`Invalid usage snapshot: ${fieldName} must be numeric`);
  }
  return number;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
