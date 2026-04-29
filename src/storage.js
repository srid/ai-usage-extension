const SNAPSHOTS_KEY = "usageSnapshots";

export async function getAllSnapshots() {
  const result = await chrome.storage.local.get(SNAPSHOTS_KEY);
  return result[SNAPSHOTS_KEY] ?? {};
}

export async function getProviderSnapshot(providerId) {
  const snapshots = await getAllSnapshots();
  return snapshots[providerId] ?? null;
}

export async function saveProviderSnapshot(providerId, snapshot) {
  const snapshots = await getAllSnapshots();
  const next = {
    ...snapshots,
    [providerId]: snapshot
  };
  await chrome.storage.local.set({ [SNAPSHOTS_KEY]: next });
  return next;
}

export { SNAPSHOTS_KEY };
