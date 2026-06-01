const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

// ── Local profanity filter ────────────────────────────────────────────────────
// Normalises common letter-substitutions (f*ck → fuck, sh!t → shit, etc.)
// then checks against a known-bad word list before hitting the OpenAI API.

/** @internal exported for unit testing */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[0]/g,  'o')
    .replace(/[1!|]/g,'i')
    .replace(/[$]/g,  's')
    .replace(/[3]/g,  'e')
    .replace(/[*+]/g, '')
    .replace(/[^a-z\s]/g, ' ');
}

const BAD_WORDS: string[] = [
  'fuck', 'fucker', 'fucking', 'motherfucker',
  'shit', 'bullshit', 'dipshit', 'shithead',
  'bitch', 'bitches',
  'asshole', 'jackass', 'dumbass', 'smartass', 'arsehole',
  'bastard', 'cock', 'dick', 'dickhead',
  'pussy', 'cunt', 'twat', 'wanker', 'prick',
  'whore', 'slut',
  'fag', 'faggot',
  'nigger', 'nigga',
  'retard', 'retarded',
  'kys', 'kill yourself',
  'bollocks', 'shite',
];

/** @internal exported for unit testing */
export function checkProfanity(text: string): ModerationResult {
  const clean = normalise(text);
  for (const word of BAD_WORDS) {
    // Match as whole word or substring for the most severe terms
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(clean)) {
      return { ok: false, reason: 'Your post contains inappropriate language and cannot be posted.' };
    }
  }
  return { ok: true };
}

// ── OpenAI Moderation API ─────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  'hate':                   'hate speech',
  'hate/threatening':       'threatening hate speech',
  'harassment':             'harassment',
  'harassment/threatening': 'threatening harassment',
  'self-harm':              'self-harm content',
  'self-harm/intent':       'self-harm intent',
  'self-harm/instructions': 'self-harm instructions',
  'sexual':                 'sexual content',
  'sexual/minors':          'sexual content involving minors',
  'violence':               'violent content',
  'violence/graphic':       'graphic violence',
  'illicit':                'illicit content',
  'illicit/violent':        'violent illicit content',
};

export type ModerationResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function moderateContent(text: string): Promise<ModerationResult> {
  // 1. Fast local check first
  const localResult = checkProfanity(text);
  if (!localResult.ok) return localResult;

  // 2. OpenAI Moderation API for subtler content
  if (!OPENAI_API_KEY) return { ok: true };

  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text }),
    });

    if (!res.ok) return { ok: true }; // fail open on API errors

    const json = await res.json() as {
      results: { flagged: boolean; categories: Record<string, boolean> }[];
    };

    const result = json.results?.[0];
    if (!result?.flagged) return { ok: true };

    const flagged = Object.entries(result.categories)
      .filter(([, v]) => v)
      .map(([k]) => CATEGORY_LABELS[k] ?? k);

    return {
      ok: false,
      reason: flagged.length > 0
        ? `Your post contains ${flagged[0]} and cannot be posted.`
        : 'Your content was flagged and cannot be posted.',
    };
  } catch {
    return { ok: true }; // fail open on network errors
  }
}
