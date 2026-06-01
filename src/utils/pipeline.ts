// Pure helpers shared between the RSS pipeline script and tests.
// The pipeline (home-rss-pipeline.mjs) keeps its own copy so it stays
// dependency-free at runtime; these TS exports exist solely for testability.

// ─── Category classification ──────────────────────────────────────────────────

const CATEGORY_RULES: { pattern: RegExp; cat: string; bg: string }[] = [
  { pattern: /\b(ai|llm|gpt|gemini|claude|openai|machine.?learning|neural|model|copilot|deepmind|midjourney|stable.?diffusion)\b/i, cat: 'AI / ML',    bg: '#E6F1FB' },
  { pattern: /\b(ios|android|mobile|iphone|pixel|swift|kotlin|watchos|vision.?pro)\b/i,                                            cat: 'Mobile',      bg: '#EAF3DE' },
  { pattern: /\b(sdk|api|cli|framework|library|npm|package|developer|devtool|runtime|compiler|vscode|ide|git)\b/i,                  cat: 'Dev Tools',   bg: '#FAEEDA' },
  { pattern: /\b(security|encrypt|privacy|vulnerability|breach|password|auth|hack|malware|ransomware|zero.?day)\b/i,               cat: 'Security',    bg: '#EEEDFE' },
  { pattern: /\b(chip|hardware|device|sensor|raspberry|arduino|processor|gpu|cpu|arm|risc|nvidia|amd|intel)\b/i,                   cat: 'Hardware',    bg: '#FAECE7' },
];

export function classifyRelease(text: string): { cat: string; bg: string } {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return { cat: rule.cat, bg: rule.bg };
  }
  return { cat: 'Web', bg: '#E1F5EE' };
}

// ─── Sector classification ────────────────────────────────────────────────────

const SECTOR_RULES: { pattern: RegExp; sector: string }[] = [
  { pattern: /\b(ai|artificial.?intelligence|machine.?learning|generative)\b/i, sector: 'AI' },
  { pattern: /\b(health|medical|biotech|pharma|clinical|genomics|medtech)\b/i,  sector: 'HealthTech' },
  { pattern: /\b(fintech|finance|payment|banking|crypto|defi|insurance)\b/i,    sector: 'FinTech' },
  { pattern: /\b(climate|green|sustainable|clean.?energy|carbon|ev|solar)\b/i,  sector: 'CleanTech' },
  { pattern: /\b(security|cyber|infosec|privacy|identity)\b/i,                  sector: 'Security' },
  { pattern: /\b(logistics|supply.?chain|shipping|fleet|warehouse)\b/i,         sector: 'Logistics' },
  { pattern: /\b(legal|legaltech|compliance|contract|regulatory)\b/i,           sector: 'LegalTech' },
  { pattern: /\b(edtech|education|learning|e-learning|tutoring)\b/i,            sector: 'EdTech' },
  { pattern: /\b(saas|b2b|enterprise|platform|workflow|automation)\b/i,         sector: 'SaaS' },
];

export function classifySector(text: string): string {
  for (const rule of SECTOR_RULES) {
    if (rule.pattern.test(text)) return rule.sector;
  }
  return 'Tech';
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

export function decodeHtml(s: string): string {
  return s
    .replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&nbsp;', ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

export function stripTags(html: string): string {
  return decodeHtml(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── URL / name helpers ───────────────────────────────────────────────────────

export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

export function makeInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('');
}
