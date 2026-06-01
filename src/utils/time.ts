/** Returns a human-readable relative time string: "5m", "3h", "2d" */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Formats ISO date string → "Apr 24" */
export function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-SG', { month: 'short', day: 'numeric' });
}

/** Formats ISO timestamp → "Updated 3h ago" / "Updated 12 May" */
export function updatedLabel(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return 'Updated just now';
  if (h < 24) return `Updated ${h}h ago`;
  return `Updated ${new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}`;
}
