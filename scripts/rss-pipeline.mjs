import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const FEEDS = [
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
  { name: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/" },
  {
    name: "MIT Technology Review",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
  },
];

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "and",
  "in",
  "for",
  "on",
  "with",
  "is",
  "are",
  "at",
  "by",
  "from",
  "as",
  "it",
  "that",
  "this",
  "be",
  "new",
  "how",
  "why",
  "what",
  "you",
  "your",
  "about",
  "after",
]);

const TRENDING_KEYWORDS = [
  "openai",
  "anthropic",
  "gemini",
  "llm",
  "agent",
  "chip",
  "inference",
  "regulation",
  "privacy",
  "security",
  "enterprise",
  "startup",
  "funding",
  "model",
];

function decodeHtml(input) {
  const decoded = input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

  return decoded
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    );
}

function stripTags(html) {
  return decodeHtml(
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function normalizeText(text) {
  return stripTags(text)
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*source:[^)]+\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(block, tagName) {
  const pattern = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );
  const match = block.match(pattern);
  if (!match) return "";
  const raw = match[1].replace("<![CDATA[", "").replace("]]>", "").trim();
  return stripTags(raw);
}

function getTagAttribute(block, tagName, attributeName) {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*\\b${attributeName}="([^"]+)"[^>]*\\/?>`,
    "i",
  );
  const match = block.match(pattern);
  if (!match) return "";
  return decodeHtml(match[1].trim());
}

function getStoryLink(block) {
  const rssLink = getTagValue(block, "link");
  if (rssLink) return rssLink;
  const atomLink = getTagAttribute(block, "link", "href");
  return atomLink;
}

function getStoryImage(block) {
  const mediaContent = getTagAttribute(block, "media:content", "url");
  if (mediaContent) return mediaContent;
  const mediaThumb = getTagAttribute(block, "media:thumbnail", "url");
  if (mediaThumb) return mediaThumb;
  const enclosureImage = block.match(
    /<enclosure\b[^>]*type="image\/[^"]+"[^>]*url="([^"]+)"[^>]*\/?>/i,
  );
  if (enclosureImage?.[1]) return decodeHtml(enclosureImage[1].trim());
  const imgTag = block.match(/<img\b[^>]*src="([^"]+)"[^>]*>/i);
  if (imgTag?.[1]) return decodeHtml(imgTag[1].trim());
  return "";
}

function getFallbackImage(headline) {
  const seed = encodeURIComponent(
    headline.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  );
  return `https://picsum.photos/seed/${seed}/1200/700`;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function jaccardSimilarity(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  const intersectionSize = [...a].filter((token) => b.has(token)).length;
  const unionSize = new Set([...a, ...b]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function buildWhyItMatters(summary) {
  const tokens = tokenize(summary).slice(0, 14);
  const concise = tokens.join(" ");
  if (!concise) {
    return "This story signals potential changes in the AI ecosystem that could affect product, cost, or policy decisions.";
  }
  return `Signal to watch: ${concise}.`;
}

function extractKeyPhrase(text, fallback) {
  const cleaned = normalizeText(text);
  if (!cleaned) return fallback;

  const parts = cleaned
    .split(/[,:;()-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12);

  const best = parts.find((part) => part.split(/\s+/).length <= 8) ?? parts[0];
  return best || fallback;
}

function buildQuickSummary(summary, headline) {
  const base = normalizeText(summary || "");
  if (!base) return `Key takeaway: ${headline}.`;

  const lead = extractKeyPhrase(headline, "AI development update");
  const meaningfulTokens = tokenize(base).slice(0, 10);
  const impact =
    meaningfulTokens.length > 0
      ? meaningfulTokens.join(" ")
      : "teams building with AI";

  return `Key takeaway: ${lead}. Main impact: ${impact}.`;
}

function scoreStory(story) {
  const recencyHours = Math.max(
    0,
    (Date.now() - new Date(story.publishedAt).getTime()) / (1000 * 60 * 60),
  );
  const recencyScore = Math.max(0, 72 - recencyHours) / 72;
  const keywordHits = TRENDING_KEYWORDS.reduce((count, keyword) => {
    const haystack = `${story.headline} ${story.summary}`.toLowerCase();
    return haystack.includes(keyword) ? count + 1 : count;
  }, 0);
  return recencyScore * 0.7 + Math.min(keywordHits / 4, 1) * 0.3;
}

// Fetch og:image from article URL as fallback
async function fetchOgImage(articleUrl) {
  if (!articleUrl) return null;
  try {
    const res = await fetch(articleUrl, {
      headers: { "User-Agent": "AheadNewsBot/1.0" },
      signal: AbortSignal.timeout(4000), // don't hang forever
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      );
    return match?.[1] ? decodeHtml(match[1]) : null;
  } catch {
    return null;
  }
}

// Get logo from Logo.dev using a domain
function getLogoUrl(domain) {
  if (!domain) return null;
  // Free tier — no API key needed for basic use
  return `https://img.logo.dev/${domain}?token=pk_free&size=128&format=png`;
}

// Extract domain from a URL string
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

async function parseFeed(xml, category, source) {
  const matches = [
    ...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi),
  ];

  const raw = matches.slice(0, MAX_ITEMS_PER_FEED).map((match, index) => {
    const block = match[0];
    const headline = getTagValue(block, "title") || `${source} story`;
    const summary =
      getTagValue(block, "description") ||
      getTagValue(block, "summary") ||
      "No summary available.";
    const publishedAt =
      getTagValue(block, "pubDate") ||
      getTagValue(block, "updated") ||
      new Date().toISOString();
    const articleUrl = getStoryLink(block);
    const rssImage = getStoryImage(block, headline); // your existing function

    return {
      index,
      headline,
      summary,
      publishedAt,
      articleUrl,
      rssImage,
      category,
      source,
    };
  });

  // Enrich images in parallel (limit concurrency to avoid hammering servers)
  const enriched = await Promise.all(
    raw.map(async (story) => {
      let imageUrl = story.rssImage;

      // If it's a picsum fallback, try og:image instead
      if (!imageUrl || imageUrl.includes("picsum.photos")) {
        const ogImage = await fetchOgImage(story.articleUrl);
        imageUrl = ogImage || imageUrl;
      }

      return {
        id: `${story.category}-${source.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${story.index}`,
        category: story.category,
        headline: story.headline,
        summary: story.summary,
        whyItMatters: buildWhyItMatters(story.summary),
        source,
        readTime: estimateReadTime(story.summary),
        articleUrl: story.articleUrl,
        imageUrl,
        publishedAt: new Date(story.publishedAt).toISOString(),
      };
    }),
  );

  return enriched;
}
function deduplicateStories(stories) {
  const deduped = [];
  for (const story of stories) {
    const currentTokens = tokenize(story.headline);
    const hasNearDuplicate = deduped.some((existing) => {
      const existingTokens = tokenize(existing.headline);
      return jaccardSimilarity(currentTokens, existingTokens) >= 0.72;
    });
    if (!hasNearDuplicate) deduped.push(story);
  }
  return deduped;
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "AheadNewsBot/1.0 (+https://aheadnews.local)",
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Feed fetch failed for ${feed.name}: ${response.status} ${response.statusText}`,
    );
  }
  const xml = await response.text();
  return await parseFeed(xml, feed.name);
}

function toTsFile(stories, generatedAt) {
  const payload = JSON.stringify(
    stories.map((story, index) => ({
      id: String(index + 1),
      headline: story.headline,
      summary: story.summary,
      quickSummary: story.quickSummary,
      whyItMatters: story.whyItMatters,
      source: story.source,
      imageUrl: story.imageUrl,
      articleUrl: story.articleUrl,
    })),
    null,
    2,
  );

  return `import type { HomeStory } from './types';

// Auto-generated by \`npm run rss:run\`. Do not edit manually.
export const generatedStoriesUpdatedAt = '${generatedAt}';
export const generatedStories: HomeStory[] = ${payload};
`;
}

async function run() {
  const settled = await Promise.allSettled(
    FEEDS.map((feed) => fetchFeed(feed)),
  );
  const stories = [];

  settled.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      stories.push(...result.value);
      return;
    }
    console.warn(
      `[rss] skipped ${FEEDS[idx].name}: ${result.reason?.message ?? "unknown error"}`,
    );
  });

  if (stories.length === 0) {
    throw new Error("All feeds failed; no stories fetched.");
  }

  const deduped = deduplicateStories(stories);
  const rankedStories = deduped.sort((a, b) => scoreStory(b) - scoreStory(a));
  const generatedAt = new Date().toISOString();

  const targetDir = path.resolve(process.cwd(), "src/features/home");
  await mkdir(targetDir, { recursive: true });
  await writeFile(
    path.join(targetDir, "generatedStories.ts"),
    toTsFile(rankedStories, generatedAt),
    "utf8",
  );

  console.log(
    `[rss] fetched=${stories.length} deduped=${deduped.length} published=${rankedStories.length}`,
  );
}

run().catch((error) => {
  console.error("[rss] pipeline failed:", error.message);
  process.exitCode = 1;
});
