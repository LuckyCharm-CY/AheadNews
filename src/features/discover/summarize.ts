import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '',
  dangerouslyAllowBrowser: true,
});

export type BiteSummary = {
  what:    string; // 2-3 sentences: the core event, key facts, numbers
  context: string; // 2-3 sentences: background, players, why this happened
  impact:  string; // 2 sentences: who it affects and what to watch next
};

const cache = new Map<string, BiteSummary>();

const SYSTEM_PROMPT = `You are a news editor who writes structured briefings for a mobile app.
Reply ONLY with minified JSON — no markdown, no extra keys.
Schema: {"what":"string","context":"string","impact":"string"}`;

const userMessage = (headline: string, source: string, rawText: string) =>
  `Headline: ${headline}
Source: ${source}
Raw article text: ${rawText.slice(0, 800)}

Write three fields. Each must stand alone — a reader who only sees one field should still understand it.

"what"    — 2-3 sentences. The core event: who did what, when, where. Include key numbers, names, and concrete facts. Active voice, no filler.

"context" — 2-3 sentences. Background a general reader needs: why this is happening, who the main players are, relevant history or industry dynamics.

"impact"  — 2 sentences. First: who this directly affects and how. Second: what to watch next or the longer-term significance.

Rules: plain language, no jargon, no phrases like "In a significant development" or "It is worth noting".`;

export async function summarizeStory(
  id: string,
  headline: string,
  source: string,
  rawSummary: string,
): Promise<BiteSummary> {
  const hit = cache.get(id);
  if (hit) return hit;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage(headline, source, rawSummary) },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '';

  let result: BiteSummary;
  try {
    result = JSON.parse(raw);
  } catch {
    result = {
      what:    rawSummary.slice(0, 220).trimEnd() + '…',
      context: 'Open the full article for background and context.',
      impact:  'Read more to understand what this means for you.',
    };
  }

  cache.set(id, result);
  return result;
}
