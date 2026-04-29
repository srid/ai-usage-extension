export function formatUsagePercent(percent) {
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return "unknown";
  }

  const rounded = Math.round(percent);
  return `${Math.max(0, rounded)}%`;
}
