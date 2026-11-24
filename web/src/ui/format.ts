export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** 83400 ms -> "1:23.4" */
export function formatDuration(ms: number): string {
  const totalTenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

export function formatWpm(wpm: number): string {
  return String(Math.round(wpm));
}
