import { isOkSnapshot } from "./snapshots.js";

export function selectBadgeSnapshot(snapshots) {
  const candidates = snapshots.filter(Boolean);
  const okSnapshots = candidates.filter(isOkSnapshot);
  if (okSnapshots.length > 0) {
    return okSnapshots.sort((left, right) => snapshotRisk(right) - snapshotRisk(left))[0];
  }
  return candidates[0] ?? null;
}

function snapshotRisk(snapshot) {
  return snapshot.primaryLimit?.projection?.projectedPercentUsed ?? snapshot.percentUsed ?? 0;
}
