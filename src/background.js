import { applyBadgeState } from "./badge.js";
import { DEFAULT_PROVIDER_ID, PROVIDERS } from "./providers/index.js";
import { executeProviderExtractor } from "./providers/reader.js";
import { getProviderSnapshot, saveProviderSnapshot } from "./storage.js";
import { findOrOpenProviderTab, waitForTabReady } from "./tabs.js";

const REFRESH_ALARM = "refresh-ai-usage";
const REFRESH_PERIOD_MINUTES = 30;

chrome.runtime.onInstalled.addListener(() => {
  void initialize();
});

chrome.runtime.onStartup.addListener(() => {
  void initialize();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void refreshAllProviders("alarm");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ai-usage:refresh") {
    refreshAllProviders("manual")
      .then((snapshots) => sendResponse({ ok: true, snapshots }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "ai-usage:get") {
    getProviderSnapshot(message.providerId ?? DEFAULT_PROVIDER_ID)
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function initialize() {
  await ensureRefreshAlarm();
  await applyBadgeFromStorage();
  await refreshAllProviders("startup");
}

async function ensureRefreshAlarm() {
  const existing = await chrome.alarms.get(REFRESH_ALARM);
  if (!existing) {
    await chrome.alarms.create(REFRESH_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: REFRESH_PERIOD_MINUTES
    });
  }
}

async function applyBadgeFromStorage() {
  const snapshot = await getProviderSnapshot(DEFAULT_PROVIDER_ID);
  await applyBadgeState(snapshot);
}

async function refreshAllProviders(reason) {
  const snapshots = [];
  for (const provider of PROVIDERS) {
    snapshots.push(await refreshProvider(provider, reason));
  }
  return snapshots;
}

async function refreshProvider(provider, reason) {
  try {
    const { tab } = await findOrOpenProviderTab(provider, { openIfMissing: true });
    const readyTab = await waitForTabReady(tab.id);
    const usage = await executeProviderExtractor(provider, readyTab.id);
    const enriched = {
      ...usage,
      providerId: provider.id,
      providerName: provider.name,
      capturedAt: new Date().toISOString(),
      reason,
      sourceUrl: readyTab.url ?? provider.usageUrl,
      tabId: readyTab.id
    };
    await saveProviderSnapshot(provider.id, enriched);
    if (provider.id === DEFAULT_PROVIDER_ID) {
      await applyBadgeState(enriched);
    }
    return enriched;
  } catch (error) {
    const snapshot = {
      providerId: provider.id,
      providerName: provider.name,
      status: "error",
      capturedAt: new Date().toISOString(),
      reason,
      error: error.message
    };
    await saveProviderSnapshot(provider.id, snapshot);
    if (provider.id === DEFAULT_PROVIDER_ID) {
      await applyBadgeState(snapshot);
    }
    return snapshot;
  }
}

export { refreshProvider };
