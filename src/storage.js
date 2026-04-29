const SNAPSHOT_KEY_PREFIX = "usageSnapshot:";

export function providerSnapshotKey(providerId) {
  return `${SNAPSHOT_KEY_PREFIX}${providerId}`;
}

export async function getProviderSnapshot(providerId) {
  const key = providerSnapshotKey(providerId);
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

export async function saveProviderSnapshot(providerId, snapshot) {
  const key = providerSnapshotKey(providerId);
  await chrome.storage.local.set({ [key]: snapshot });
  return snapshot;
}

export { SNAPSHOT_KEY_PREFIX };
