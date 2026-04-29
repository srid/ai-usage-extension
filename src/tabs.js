const TAB_READY_TIMEOUT_MS = 45_000;

export async function findOrOpenProviderTab(provider, options = {}) {
  const openIfMissing = options.openIfMissing ?? true;
  const matches = await queryProviderTabs(provider);
  if (matches.length > 0) {
    return { created: false, tab: matches[0] };
  }

  if (!openIfMissing) {
    throw new Error(`No ${provider.name} usage tab is open`);
  }

  const tab = await chrome.tabs.create({
    active: false,
    url: provider.usageUrl
  });
  return { created: true, tab };
}

export async function queryProviderTabs(provider) {
  const byId = new Map();
  for (const pattern of provider.tabUrlPatterns) {
    const tabs = await chrome.tabs.query({ url: pattern });
    for (const tab of tabs) {
      byId.set(tab.id, tab);
    }
  }
  return [...byId.values()].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
}

export async function waitForTabReady(tabId, timeoutMs = TAB_READY_TIMEOUT_MS) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete" && !current.discarded) {
    return current;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for tab ${tabId} to finish loading`));
    }, timeoutMs);

    const onUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        cleanup();
        resolve(tab);
      }
    };

    const onRemoved = (removedTabId) => {
      if (removedTabId === tabId) {
        cleanup();
        reject(new Error(`Tab ${tabId} closed before usage could be read`));
      }
    };

    function cleanup() {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}
