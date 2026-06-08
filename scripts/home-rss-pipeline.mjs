import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import OpenAI from 'openai';

// Load EXPO_PUBLIC_OPENAI_API_KEY from .env.local so the pipeline can call OpenAI
async function loadEnv() {
  try {
    const raw = await readFile(path.resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch { /* .env.local may not exist — key can also come from shell env */ }
}

// ─── Feeds ───────────────────────────────────────────────────────────────────

const TECH_FEEDS = [
  { name: 'Product Hunt',      url: 'https://www.producthunt.com/feed' },
  { name: 'GitHub Changelog',  url: 'https://github.blog/changelog/feed/' },
  { name: 'The Verge',         url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'TechCrunch',        url: 'https://techcrunch.com/feed/' },
];

const STARTUP_FEEDS = [
  { name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/feed/' },
  { name: 'VentureBeat',         url: 'https://venturebeat.com/category/business/feed/' },
];

const MAX_TECH    = 8;
const MAX_STARTUP = 6;

// ─── Category classification ──────────────────────────────────────────────────

const CATEGORY_RULES = [
  { pattern: /\b(ai|llm|gpt|gemini|claude|openai|machine.?learning|neural|model|copilot|deepmind|midjourney|stable.?diffusion)\b/i, cat: 'AI / ML',    bg: '#E6F1FB' },
  { pattern: /\b(ios|android|mobile|iphone|pixel|swift|kotlin|watchos|vision.?pro)\b/i,                                            cat: 'Mobile',      bg: '#EAF3DE' },
  { pattern: /\b(sdk|api|cli|framework|library|npm|package|developer|devtool|runtime|compiler|vscode|ide|git)\b/i,                  cat: 'Dev Tools',   bg: '#FAEEDA' },
  { pattern: /\b(security|encrypt|privacy|vulnerability|breach|password|auth|hack|malware|ransomware|zero.?day)\b/i,               cat: 'Security',    bg: '#EEEDFE' },
  { pattern: /\b(chip|hardware|device|sensor|raspberry|arduino|processor|gpu|cpu|arm|risc|nvidia|amd|intel)\b/i,                   cat: 'Hardware',    bg: '#FAECE7' },
];

function classifyRelease(text) {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return { cat: rule.cat, bg: rule.bg };
  }
  return { cat: 'Web', bg: '#E1F5EE' };
}

// ─── Sector classification ────────────────────────────────────────────────────

const SECTOR_RULES = [
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

function classifySector(text) {
  for (const rule of SECTOR_RULES) {
    if (rule.pattern.test(text)) return rule.sector;
  }
  return 'Tech';
}

// ─── Funding extraction ───────────────────────────────────────────────────────

function extractFundingAmount(text) {
  const m = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(billion|million|thousand|[BMKbmk])\b/i);
  if (!m) return '';
  const num = parseFloat(m[1]);
  const unit = m[2][0].toUpperCase();
  if (unit === 'B') return `$${num}B`;
  if (unit === 'M') return `$${num}M`;
  if (unit === 'K') return `$${num}K`;
  return '';
}

function extractFundingStage(text) {
  const t = text.toLowerCase();
  if (/pre.?seed/.test(t))           return 'Pre-Seed';
  if (/series\s+[cd]|\bseries\s+[ef]/.test(t)) return 'Series C+';
  if (/series\s+b/.test(t))          return 'Series B';
  if (/series\s+a/.test(t))          return 'Series A';
  if (/\bseed\b/.test(t))            return 'Seed';
  return 'Seed';
}

function extractStartupName(title) {
  // "CompanyName raises $X in ..." → "CompanyName"
  const before = title.split(
    /\s+(raises?|secures?|lands?|closes?|gets?|nabs?|bags?|receives?|announces?|unveils?)\s/i,
  )[0];
  return before.replace(/^\W+/, '').trim().slice(0, 40);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeHtml(s) {
  return s
    .replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&nbsp;', ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function stripTags(html) {
  return decodeHtml(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  return stripTags(m[1].replace('<![CDATA[', '').replace(']]>', '').trim());
}

function getLink(block) {
  const fromTag = getTag(block, 'link');
  if (fromTag) return fromTag;
  const m = block.match(/<link\b[^>]*href="([^"]+)"/i);
  return m ? decodeHtml(m[1]) : '';
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function makeInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('');
}

const AVATAR_COLORS = ['#378ADD','#1D9E75','#7F77DD','#DD7767','#3DAD6B','#C0852A','#2A8EC0'];

async function fetchXml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'AheadNewsBot/1.0',
      Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

function parseItems(xml) {
  return [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi)].map(m => m[0]);
}

// ─── OG image fetcher ────────────────────────────────────────────────────────

async function fetchOgImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AheadNewsBot/1.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // og:image (two attribute orderings)
    const og =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
    if (og) return og;
    // twitter:image fallback
    const tw =
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1];
    return tw ?? null;
  } catch {
    return null;
  }
}

// ─── LLM description enrichment ──────────────────────────────────────────────

async function enrichTechDescription(client, name, rawDesc, category) {
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content:
            'You write 2-sentence plain-English product descriptions for a mobile news app. ' +
            'Sentence 1: what the product/tool does and who it is for. ' +
            'Sentence 2: what makes it notable or different. ' +
            'No jargon, no marketing fluff, no em-dashes. Active voice. Do not start with the product name.',
        },
        {
          role: 'user',
          content: `Product: ${name}\nCategory: ${category}\nContext: ${rawDesc.slice(0, 400)}`,
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    return text || null;
  } catch {
    return null;
  }
}

async function enrichStartupDescription(client, name, raisedAmount, stage, sector, rawDesc) {
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content:
            'You write 2-sentence plain-English startup descriptions for a mobile news app. ' +
            'Sentence 1: what the startup builds and who it serves. ' +
            'Sentence 2: their traction, funding significance, or what makes them worth watching. ' +
            'No jargon, no marketing fluff, no em-dashes. Active voice.',
        },
        {
          role: 'user',
          content: `Startup: ${name}\nRaised: ${raisedAmount} (${stage})\nSector: ${sector}\nContext: ${rawDesc.slice(0, 400)}`,
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? '';
    return text || null;
  } catch {
    return null;
  }
}

// ─── Tech Releases pipeline ───────────────────────────────────────────────────

async function buildTechReleases() {
  const results = [];

  for (const feed of TECH_FEEDS) {
    try {
      const xml = await fetchXml(feed.url);
      const items = parseItems(xml).slice(0, 15);
      for (const block of items) {
        const title = getTag(block, 'title');
        const desc  = getTag(block, 'description') || getTag(block, 'summary') || getTag(block, 'content');
        const link  = getLink(block);
        const pub   = getTag(block, 'pubDate') || getTag(block, 'updated') || getTag(block, 'published');
        if (!title || !desc) continue;

        const combined = `${title} ${desc}`;
        const { cat, bg } = classifyRelease(combined);
        const domain = getDomain(link) || getDomain(feed.url.replace(/\/feed.*/, ''));

        results.push({
          _pub: pub ? new Date(pub).toISOString() : new Date().toISOString(),
          name: title.slice(0, 60),
          category: cat,
          description: desc.slice(0, 200),
          domain,
          initials: makeInitials(title),
          iconBg: bg,
          releasedDate: pub ? new Date(pub).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          url: link,
        });
      }
    } catch (e) {
      console.warn(`[home:rss] skipped tech feed ${feed.name}: ${e.message}`);
    }
  }

  // Sort newest first, dedupe by similar names, cap at MAX_TECH
  results.sort((a, b) => b._pub.localeCompare(a._pub));
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.name.toLowerCase().slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const capped = deduped.slice(0, MAX_TECH);

  // Enrich descriptions with LLM if key is available
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (apiKey) {
    const client = new OpenAI({ apiKey });
    await Promise.all(
      capped.map(async r => {
        const enriched = await enrichTechDescription(client, r.name, r.description, r.category);
        if (enriched) r.description = enriched;
      })
    );
    console.log(`[home:rss] enriched ${capped.length} tech release descriptions`);
  }

  return capped.map((r, i) => {
    const { _pub, ...rest } = r;
    return { id: `tech-${i + 1}`, ...rest };
  });
}

// ─── New Startups pipeline ────────────────────────────────────────────────────

async function buildNewStartups() {
  const results = [];
  const year = new Date().getFullYear();

  for (const feed of STARTUP_FEEDS) {
    try {
      const xml = await fetchXml(feed.url);
      const items = parseItems(xml).slice(0, 20);
      for (const block of items) {
        const title = getTag(block, 'title');
        const desc  = getTag(block, 'description') || getTag(block, 'summary') || '';
        const link  = getLink(block);
        const pub   = getTag(block, 'pubDate') || getTag(block, 'updated') || '';
        if (!title) continue;

        const combined = `${title} ${desc}`;
        const raised = extractFundingAmount(combined);
        // Only include funding articles that have an extractable amount
        if (!raised) continue;

        const name   = extractStartupName(title);
        if (!name || name.length < 2) continue;

        const stage  = extractFundingStage(combined);
        const sector = classifySector(combined);
        const slug   = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const domain = slug ? `${slug}.com` : getDomain(link);

        results.push({
          _pub: pub ? new Date(pub).toISOString() : new Date().toISOString(),
          name,
          domain,
          initials: makeInitials(name),
          stage,
          sector,
          description: (desc || title).slice(0, 200),
          raisedAmount: raised,
          foundedYear: year,
          url: link,
        });
      }
    } catch (e) {
      console.warn(`[home:rss] skipped startup feed ${feed.name}: ${e.message}`);
    }
  }

  results.sort((a, b) => b._pub.localeCompare(a._pub));
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = r.name.toLowerCase().slice(0, 15);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const capped = deduped.slice(0, MAX_STARTUP);

  // Enrich descriptions with LLM if key is available
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (apiKey) {
    const client = new OpenAI({ apiKey });
    await Promise.all(
      capped.map(async r => {
        const enriched = await enrichStartupDescription(client, r.name, r.raisedAmount, r.stage, r.sector, r.description);
        if (enriched) r.description = enriched;
      })
    );
    console.log(`[home:rss] enriched ${capped.length} startup descriptions`);
  }

  return capped.map((r, i) => {
    const { _pub, ...rest } = r;
    return {
      id: `startup-${i + 1}`,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      ...rest,
    };
  });
}

// ─── Startup of the Day (LLM-generated story) ────────────────────────────────

async function generateStartupOfDay(startup) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[home:rss] No OpenAI key — skipping Startup of the Day story.');
    return null;
  }

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 700,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You write concise, engaging startup profiles for a mobile news app. Reply with JSON only — no markdown.',
      },
      {
        role: 'user',
        content: `Write a "Startup of the Day" feature from this news:

Name: ${startup.name}
Raised: ${startup.raisedAmount} (${startup.stage})
Sector: ${startup.sector}
Summary: ${startup.description}

Return this JSON (no extra keys):
{
  "name": "clean startup name only",
  "oneLiner": "one punchy sentence, max 12 words, present tense — what the startup does",
  "foundedYear": "year as a string, guess if unknown",
  "problemSolved": "2-3 sentences. Sentence 1: what the startup builds and who it is for. Sentence 2: the specific problem it solves and how. Sentence 3: what makes it different or why now. Plain English, no jargon, no em-dashes.",
  "storyParagraphs": [
    "50-70 words: founding story and origin",
    "50-70 words: how the product works and what makes it different",
    "50-70 words: market timing and why this matters right now"
  ]
}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';
  const parsed = JSON.parse(raw);

  // Prefer the real article's OG image; fall back to a deterministic placeholder
  const ogImage = await fetchOgImage(startup.url);
  const imageUrl = ogImage ?? `https://picsum.photos/seed/${encodeURIComponent(parsed.name)}/1400/900`;
  console.log(`[home:rss] startup-of-day image: ${ogImage ? 'og:image from article' : 'picsum fallback'}`);

  return {
    id: 'startup-of-day',
    name: parsed.name,
    oneLiner: parsed.oneLiner,
    foundedYear: String(parsed.foundedYear),
    problemSolved: parsed.problemSolved,
    imageUrl,
    storyTitle: `Startup of the Day: ${parsed.name}`,
    storyParagraphs: parsed.storyParagraphs,
  };
}

// ─── File writers ─────────────────────────────────────────────────────────────

function toTechReleasesTs(releases, updatedAt) {
  return `import type { TechRelease } from './types';

// Auto-generated by \`npm run home:rss:run\`. Do not edit manually.
export const techReleasesUpdatedAt = '${updatedAt}';
export const generatedTechReleases: TechRelease[] = ${JSON.stringify(releases, null, 2)};
`;
}

function toNewStartupsTs(startups, updatedAt) {
  return `import type { NewStartup } from './types';

// Auto-generated by \`npm run home:rss:run\`. Do not edit manually.
export const newStartupsUpdatedAt = '${updatedAt}';
export const generatedNewStartups: NewStartup[] = ${JSON.stringify(startups, null, 2)};
`;
}

function toStartupOfDayTs(sotd, updatedAt) {
  if (!sotd) {
    return `// Auto-generated by \`npm run home:rss:run\`. Do not edit manually.
export const startupOfDayUpdatedAt = '${updatedAt}';
export const generatedStartupOfDay = null;
`;
  }
  return `// Auto-generated by \`npm run home:rss:run\`. Do not edit manually.
export const startupOfDayUpdatedAt = '${updatedAt}';
export const generatedStartupOfDay = ${JSON.stringify(sotd, null, 2)} as const;
`;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function run() {
  await loadEnv();

  const now = new Date().toISOString();
  const outDir = path.resolve(process.cwd(), 'src/features/home');
  await mkdir(outDir, { recursive: true });

  const [releases, startups] = await Promise.all([
    buildTechReleases(),
    buildNewStartups(),
  ]);

  // Pick the top startup to feature — prefer one with the most data
  const featured = startups.find(s => s.raisedAmount && s.name.length > 2) ?? startups[0];
  let sotd = null;
  if (featured) {
    try {
      sotd = await generateStartupOfDay(featured);
    } catch (e) {
      console.warn('[home:rss] Startup of the Day generation failed:', e.message);
    }
  }

  await Promise.all([
    writeFile(path.join(outDir, 'generatedTechReleases.ts'), toTechReleasesTs(releases, now), 'utf8'),
    writeFile(path.join(outDir, 'generatedNewStartups.ts'),  toNewStartupsTs(startups, now),  'utf8'),
    writeFile(path.join(outDir, 'generatedStartupOfDay.ts'), toStartupOfDayTs(sotd, now),     'utf8'),
  ]);

  const sotdName = sotd?.name ?? 'none (no API key)';
  console.log(`[home:rss] tech=${releases.length}  startups=${startups.length}  startup-of-day="${sotdName}"  updated=${now}`);
}

run().catch(e => {
  console.error('[home:rss] pipeline failed:', e.message);
  process.exitCode = 1;
});
