/** Returns the first complete sentence of text, appending "." if missing. */
export function firstSentence(text: string): string {
  const s = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text.slice(0, 100);
  return s.endsWith('.') || s.endsWith('!') || s.endsWith('?') ? s : s + '.';
}

/** Reddit-style "hot" score: higher votes + newer age = higher score. */
export function hotScore(post: { votes: number; createdAt: string }): number {
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
  return post.votes / Math.pow(ageHours + 2, 1.5);
}

/** Extracts funding amount from text, e.g. "$35M", "$1.2B", "$500K". */
export function extractFundingAmount(text: string): string {
  const m = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(billion|million|thousand|[BMKbmk])\b/i);
  if (!m) return '';
  const num  = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'b' || unit === 'billion')  return `$${num}B`;
  if (unit === 'm' || unit === 'million')  return `$${num}M`;
  if (unit === 'k' || unit === 'thousand') return `$${num}K`;
  return '';
}

/** Extracts funding stage from text. */
export function extractFundingStage(text: string): string {
  const t = text.toLowerCase();
  if (/pre.?seed/.test(t))                          return 'Pre-Seed';
  if (/series\s+[cdef]/.test(t))                    return 'Series C+';
  if (/series\s+b/.test(t))                         return 'Series B';
  if (/series\s+a/.test(t))                         return 'Series A';
  if (/\bseed\b/.test(t))                           return 'Seed';
  return 'Seed';
}

/** Extracts startup name from a funding headline: "Acme raises $5M in..." → "Acme" */
export function extractStartupName(title: string): string {
  const before = title.split(
    /\s+(raises?|secures?|lands?|closes?|gets?|nabs?|bags?|receives?|announces?|unveils?)\s/i,
  )[0];
  return before.replace(/^\W+/, '').trim().slice(0, 40);
}
