import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// ── OpenAI summarisation ──────────────────────────────────────────────────────
// Pre-generate AI summaries at pipeline time so the app never needs to call
// OpenAI at runtime. Cost: ~$0.01–0.04 per daily run depending on story count.

async function getOpenAIKey() {
  try {
    const env = await readFile(path.resolve(process.cwd(), '.env.local'), 'utf8');
    const match = env.match(/EXPO_PUBLIC_OPENAI_API_KEY=(.+)/);
    return match?.[1]?.trim() ?? '';
  } catch {
    return process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
  }
}

const SUMMARISE_SYSTEM =
  `You are a news editor who writes structured briefings for a mobile app.
Reply ONLY with minified JSON — no markdown, no extra keys.
Schema: {"what":"string","context":"string","impact":"string"}`;

const summariseUserMsg = (headline, source, text) =>
  `Headline: ${headline}
Source: ${source}
Raw article text: ${text.slice(0, 800)}

Write three fields. Each must stand alone.

"what"    — 2-3 sentences. Core event: who did what, when, where. Key numbers and facts. Active voice.
"context" — 2-3 sentences. Background a general reader needs: why this is happening, who the players are.
"impact"  — 2 sentences. Who this affects and what to watch next.

Rules: plain language, no jargon, no filler phrases.`;

async function summariseOne(story, apiKey) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 450,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SUMMARISE_SYSTEM },
          { role: 'user',   content: summariseUserMsg(story.headline, story.source, story.summary) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(data.choices[0]?.message?.content ?? 'null');
  } catch {
    return null;
  }
}

// Process in parallel batches to respect rate limits without being too slow.
async function summariseAll(stories, apiKey, batchSize = 15) {
  if (!apiKey) {
    console.warn('[discover:rss] No OpenAI key — skipping AI summaries.');
    return stories;
  }

  const total = stories.length;
  const withSummaries = [...stories];

  for (let i = 0; i < total; i += batchSize) {
    const batch = stories.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(s => summariseOne(s, apiKey)));
    results.forEach((summary, j) => {
      if (summary?.what && summary?.context && summary?.impact) {
        withSummaries[i + j] = { ...withSummaries[i + j], aiSummary: summary };
      }
    });

    const done = Math.min(i + batchSize, total);
    console.log(`[discover:rss] summarised ${done}/${total}`);

    // Short pause between batches to stay within TPM limits
    if (done < total) await new Promise(r => setTimeout(r, 800));
  }

  return withSummaries;
}

const FEEDS = [
  // ── World: Tech & AI ─────────────────────────────────────────────────────
  { category: 'ai-tech', source: 'Google News',      url: 'https://news.google.com/rss/search?q=artificial+intelligence' },
  { category: 'ai-tech', source: 'The Verge',        url: 'https://www.theverge.com/rss/index.xml' },
  { category: 'ai-tech', source: 'VentureBeat',      url: 'https://venturebeat.com/category/ai/feed/' },
  { category: 'ai-tech', source: 'Hugging Face Blog',url: 'https://huggingface.co/blog/feed.xml' },

  // ── World: General News ───────────────────────────────────────────────────
  { category: 'world-news', source: 'BBC',     url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { category: 'world-news', source: 'NYTimes', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { category: 'world-news', source: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews' },

  // ── World: Business ───────────────────────────────────────────────────────
  { category: 'business-finance', source: 'Google News', url: 'https://news.google.com/rss/search?q=business+finance' },
  { category: 'business-finance', source: 'Reuters',     url: 'https://feeds.reuters.com/reuters/businessNews' },
  { category: 'business-finance', source: 'NYTimes',     url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },

  // ── World: Sports ─────────────────────────────────────────────────────────
  { category: 'world-sports', source: 'BBC Sport',   url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { category: 'world-sports', source: 'Google News', url: 'https://news.google.com/rss/search?q=sports+world' },

  // ── World: Life & Culture ────────────────────────────────────────────────
  { category: 'world-life', source: 'NYTimes',     url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml' },
  { category: 'world-life', source: 'Google News', url: 'https://news.google.com/rss/search?q=lifestyle+culture+health' },

  // ── Singapore: General News ───────────────────────────────────────────────
  { category: 'singapore-news', source: 'Straits Times',   url: 'https://www.straitstimes.com/news/singapore/rss.xml' },
  { category: 'singapore-news', source: 'Channel NewsAsia', url: 'https://www.channelnewsasia.com/rssfeeds/8395884' },

  // ── Singapore: Tech & AI ─────────────────────────────────────────────────
  { category: 'singapore-tech', source: 'Google News', url: 'https://news.google.com/rss/search?q=singapore+technology+AI' },
  { category: 'singapore-tech', source: 'Google News', url: 'https://news.google.com/rss/search?q=singapore+startup+tech' },

  // ── Singapore: Business ──────────────────────────────────────────────────
  { category: 'singapore-business', source: 'Google News',   url: 'https://news.google.com/rss/search?q=singapore+business+economy' },
  { category: 'singapore-business', source: 'Straits Times', url: 'https://www.straitstimes.com/business/rss.xml' },

  // ── Singapore: Sports ────────────────────────────────────────────────────
  { category: 'singapore-sports', source: 'Google News',    url: 'https://news.google.com/rss/search?q=singapore+sports' },
  { category: 'singapore-sports', source: 'Straits Times',  url: 'https://www.straitstimes.com/sport/rss.xml' },

  // ── Singapore: Life ──────────────────────────────────────────────────────
  { category: 'singapore-life', source: 'Google News',    url: 'https://news.google.com/rss/search?q=singapore+lifestyle+food+culture' },
  { category: 'singapore-life', source: 'Straits Times',  url: 'https://www.straitstimes.com/lifestyle/rss.xml' },
];
const MAX_ITEMS_PER_FEED = 120;

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'was', 'has', 'have']);

function decodeHtml(input) {
  const decoded = input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ');
  return decoded
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function stripTags(html) {
  const decoded = decodeHtml(html);
  return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTagValue(block, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(pattern);
  if (!match) return '';
  return stripTags(match[1].replace('<![CDATA[', '').replace(']]>', '').trim());
}

function getTagAttribute(block, tagName, attributeName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\b${attributeName}="([^"]+)"[^>]*\\/?>`, 'i');
  const match = block.match(pattern);
  return match?.[1] ? decodeHtml(match[1].trim()) : '';
}

function getStoryLink(block) {
  return getTagValue(block, 'link') || getTagAttribute(block, 'link', 'href');
}

function getStoryImage(block, seed) {
  const media = getTagAttribute(block, 'media:content', 'url') || getTagAttribute(block, 'media:thumbnail', 'url');
  if (media) return media;
  const enclosure = block.match(/<enclosure\b[^>]*type="image\/[^"]+"[^>]*url="([^"]+)"[^>]*\/?>/i);
  if (enclosure?.[1]) return decodeHtml(enclosure[1].trim());
  const img = block.match(/<img\b[^>]*src="([^"]+)"[^>]*>/i);
  if (img?.[1]) return decodeHtml(img[1].trim());
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/700`;
}

function tokenize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function buildWhyItMatters(summary) {
  const core = tokenize(summary).slice(0, 10).join(' ');
  return core ? `Key signal: ${core}.` : 'Key signal: this could influence short-term decisions.';
}

function estimateReadTime(summary) {
  const words = stripTags(summary).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(2, Math.round(words / 180));
  return `${minutes} min read`;
}

function parseFeed(xml, category, source) {
  const matches = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi)];
  return matches.slice(0, MAX_ITEMS_PER_FEED).map((match, index) => {
    const block = match[0];
    const headline = getTagValue(block, 'title') || `${source} story`;
    const summary = getTagValue(block, 'description') || getTagValue(block, 'summary') || getTagValue(block, 'content') || 'No summary available.';
    const publishedAt = getTagValue(block, 'pubDate') || getTagValue(block, 'updated') || getTagValue(block, 'published') || new Date().toISOString();
    return {
      id: `${category}-${source.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
      category,
      headline,
      summary,
      whyItMatters: buildWhyItMatters(summary),
      source,
      readTime: estimateReadTime(summary),
      articleUrl: getStoryLink(block),
      imageUrl: getStoryImage(block, headline),
      publishedAt: new Date(publishedAt).toISOString(),
    };
  });
}

// Keywords that signal genuine Singapore relevance.
// A story must match at least one to be included in any singapore-* category.
const SINGAPORE_KEYWORDS = [
  'singapore', 'singaporean', 'singaporeans',
  // Institutions & agencies
  'hdb', 'cpf', 'pap', 'ntuc', 'mas ', 'iras', 'moh', 'moe', 'mom ',
  'a*star', 'ntu ', 'nus ', 'smu ', 'sutd', 'sit ',
  // Infrastructure & places
  'mrt ', 'lrt ', 'changi', 'sentosa', 'jurong', 'orchard road',
  'ang mo kio', 'tampines', 'woodlands', 'bishan', 'toa payoh',
  'bukit timah', 'pasir ris', 'punggol', 'sengkang',
  // Culture & common SG terms
  'hawker centre', 'hawker center', 'hdb flat', 'singlish',
  // SGX / finance
  'sgx', 'straits times index',
];

function isSingaporeRelevant(story) {
  const text = `${story.headline} ${story.summary}`.toLowerCase();
  return SINGAPORE_KEYWORDS.some(kw => text.includes(kw));
}

function dedupeStories(stories) {
  const deduped = [];
  for (const story of stories) {
    const tokens = new Set(tokenize(story.headline));
    const duplicate = deduped.some((existing) => {
      const existingTokens = new Set(tokenize(existing.headline));
      const intersection = [...tokens].filter((t) => existingTokens.has(t)).length;
      const union = new Set([...tokens, ...existingTokens]).size;
      return union > 0 && intersection / union >= 0.7;
    });
    if (!duplicate) deduped.push(story);
  }
  return deduped;
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      'User-Agent': 'AheadNewsBot/1.0 (+https://aheadnews.local)',
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  return parseFeed(xml, feed.category, feed.source);
}

function toTs(stories, updatedAt) {
  const payload = JSON.stringify(
    stories,
    null,
    2
  );
  return `import type { DiscoverStory } from './types';

// Auto-generated by \`npm run discover:rss:run\`. Do not edit manually.
export const discoverStoriesUpdatedAt = '${updatedAt}';
export const generatedDiscoverStories: DiscoverStory[] = ${payload};
`;
}

async function run() {
  const settled = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed)));
  const byCategory = new Map();
  let fetchedCount = 0;

  settled.forEach((result, index) => {
    const feed = FEEDS[index];
    if (result.status !== 'fulfilled') {
      console.warn(`[discover:rss] skipped ${feed.source}: ${result.reason?.message ?? 'unknown error'}`);
      return;
    }
    fetchedCount += result.value.length;
    const existing = byCategory.get(feed.category) ?? [];
    byCategory.set(feed.category, existing.concat(result.value));
  });

  // How many stories to pre-summarise per category.
  // All stories are kept in the feed; only the top N get AI summaries.
  // Raise this to pre-summarise more (costs more); lower to save money.
  const SUMMARISE_TOP_N = 30;

  const merged = [];
  for (const [category, stories] of byCategory.entries()) {
    let filtered = stories;
    if (category.startsWith('singapore-')) {
      filtered = stories.filter(isSingaporeRelevant);
      const dropped = stories.length - filtered.length;
      if (dropped > 0) console.log(`[discover:rss] ${category}: dropped ${dropped}/${stories.length} non-SG stories`);
    }
    const deduped = dedupeStories(filtered).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    deduped.forEach((story, idx) => merged.push({ ...story, id: `${category}-${idx + 1}`, _summarise: idx < SUMMARISE_TOP_N }));
  }

  if (merged.length === 0) {
    throw new Error('All feeds failed; no stories generated.');
  }

  // Pre-generate AI summaries for the top N most recent stories per category.
  // The rest remain in the feed but fall back to live API on first view (rare).
  const apiKey = await getOpenAIKey();
  const toSummarise = merged.filter(s => s._summarise);
  const summarisedStories = await summariseAll(toSummarise, apiKey);

  // Merge summaries back, strip the internal _summarise flag
  const summaryMap = new Map(summarisedStories.map(s => [s.id, s.aiSummary]));
  const withSummaries = merged.map(({ _summarise, ...s }) => ({
    ...s,
    ...(summaryMap.has(s.id) ? { aiSummary: summaryMap.get(s.id) } : {}),
  }));

  const outputDir = path.resolve(process.cwd(), 'src/features/discover');
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, 'generatedStories.ts'),
    toTs(withSummaries, new Date().toISOString()),
    'utf8',
  );

  const summarised = withSummaries.filter(s => s.aiSummary).length;
  console.log(`[discover:rss] fetched=${fetchedCount} published=${withSummaries.length} summarised=${summarised}`);
}

run().catch((error) => {
  console.error('[discover:rss] pipeline failed:', error.message);
  process.exitCode = 1;
});
