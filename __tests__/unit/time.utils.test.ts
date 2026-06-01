import { relativeTime, formatReleaseDate, updatedLabel } from '../../src/utils/time';

// ─── relativeTime ─────────────────────────────────────────────────────────────

describe('relativeTime', () => {
  it('shows minutes for posts under 1 hour old', () => {
    const ago = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(ago)).toBe('5m');
  });

  it('shows 0m for a just-posted item', () => {
    const ago = new Date(Date.now() - 30_000).toISOString(); // 30 seconds
    expect(relativeTime(ago)).toBe('0m');
  });

  it('shows hours for posts between 1 and 23 hours old', () => {
    const ago = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(relativeTime(ago)).toBe('3h');
  });

  it('shows days for posts 24+ hours old', () => {
    const ago = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(relativeTime(ago)).toBe('2d');
  });

  it('shows exactly 1d at the 24h boundary', () => {
    const ago = new Date(Date.now() - 24 * 3_600_000).toISOString();
    expect(relativeTime(ago)).toBe('1d');
  });
});

// ─── formatReleaseDate ────────────────────────────────────────────────────────

describe('formatReleaseDate', () => {
  it('formats a date as "Mon D" in en-SG locale', () => {
    // Use a fixed date to avoid locale differences in CI
    const iso = '2026-04-15T00:00:00.000Z';
    const result = formatReleaseDate(iso);
    expect(result).toMatch(/^\d{1,2} [A-Z][a-z]{2}$|^[A-Z][a-z]{2} \d{1,2}$/); // "15 Apr" (en-SG) or "Apr 15"
  });
});

// ─── updatedLabel ─────────────────────────────────────────────────────────────

describe('updatedLabel', () => {
  it('returns empty string for empty input', () => {
    expect(updatedLabel('')).toBe('');
  });

  it('returns "Updated just now" for very recent timestamps', () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(updatedLabel(iso)).toBe('Updated just now');
  });

  it('returns hours for same-day updates', () => {
    const iso = new Date(Date.now() - 4 * 3_600_000).toISOString();
    expect(updatedLabel(iso)).toBe('Updated 4h ago');
  });

  it('returns a date string for older updates', () => {
    const iso = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const result = updatedLabel(iso);
    expect(result).toMatch(/^Updated \d{1,2} [A-Z][a-z]{2}$/);
  });
});
