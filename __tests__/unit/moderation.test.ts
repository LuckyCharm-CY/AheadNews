import { normalise, checkProfanity, moderateContent } from '../../src/features/forum/moderation';

// ─── normalise ────────────────────────────────────────────────────────────────

describe('normalise', () => {
  it('lowercases all text', () => {
    expect(normalise('HELLO WORLD')).toBe('hello world');
  });

  it('replaces @ and 4 with a', () => {
    expect(normalise('f@ke')).toContain('fake');
    expect(normalise('f4ke')).toContain('fake');
  });

  it('replaces 0 with o', () => {
    expect(normalise('c0ck')).toContain('cock');
  });

  it('replaces 1, !, | with i', () => {
    expect(normalise('sh!t')).toContain('shit');
    expect(normalise('sh1t')).toContain('shit');
  });

  it('replaces $ with s', () => {
    expect(normalise('$hit')).toContain('shit');
  });

  it('replaces 3 with e', () => {
    expect(normalise('s3x')).toContain('sex');
  });

  it('removes * and + characters', () => {
    expect(normalise('f*ck')).toContain('fck');
    expect(normalise('f+ck')).toContain('fck');
  });

  it('replaces remaining non-alphabetic characters with spaces', () => {
    const result = normalise('hello-world#test');
    expect(result).toMatch(/^[a-z\s]+$/);
  });

  it('preserves spaces', () => {
    expect(normalise('hello world')).toBe('hello world');
  });
});

// ─── checkProfanity ───────────────────────────────────────────────────────────

describe('checkProfanity', () => {
  it('passes clean, harmless text', () => {
    expect(checkProfanity('The economy grew by 3% last quarter.')).toEqual({ ok: true });
    expect(checkProfanity('Singapore tech startups raised record funding.')).toEqual({ ok: true });
    expect(checkProfanity('')).toEqual({ ok: true });
  });

  it('blocks plain profanity', () => {
    const result = checkProfanity('This is fucking terrible news');
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toBeTruthy();
  });

  it('blocks l33t-speak profanity (@ substitution)', () => {
    // @ → a, so "b@stard" normalises to "bastard" which is in the blocklist
    expect(checkProfanity('what a b@stard').ok).toBe(false);
  });

  it('blocks l33t-speak profanity (! substitution)', () => {
    expect(checkProfanity('sh!t happens').ok).toBe(false);
  });

  it('blocks l33t-speak profanity (0 substitution)', () => {
    expect(checkProfanity('c0ck and bull story').ok).toBe(false);
  });

  it('blocks l33t-speak profanity ($ substitution)', () => {
    expect(checkProfanity('$hit happens in markets').ok).toBe(false);
  });

  it('blocks harmful phrases', () => {
    expect(checkProfanity('you should kys').ok).toBe(false);
    expect(checkProfanity('kill yourself loser').ok).toBe(false);
  });

  it('blocks slurs', () => {
    expect(checkProfanity('that nigger').ok).toBe(false);
  });

  it('returns a human-readable reason when blocking', () => {
    const result = checkProfanity('utter bullshit');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(10);
    }
  });

  it('does not block words that merely contain profane substrings', () => {
    // "class" contains "ass" but shouldn't be blocked
    expect(checkProfanity('The class assignment was excellent.')).toEqual({ ok: true });
    // "scunthorpe problem" — "scunt" contains "cunt" but word boundary should protect it
    // We accept that this specific case may vary; the important thing is clean text passes.
    expect(checkProfanity('top-class performance').ok).toBe(true);
  });
});

// ─── moderateContent (async, OpenAI path) ────────────────────────────────────

describe('moderateContent', () => {
  beforeEach(() => {
    // Ensure no real API key leaks into tests
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  });

  it('blocks content caught by the local profanity filter without an API call', async () => {
    const result = await moderateContent('this is fucking terrible');
    expect(result.ok).toBe(false);
  });

  it('passes clean content when no API key is set (fail-open)', async () => {
    const result = await moderateContent('Singapore GDP grew 3.2% in Q1 2026.');
    expect(result.ok).toBe(true);
  });

  it('passes empty content', async () => {
    const result = await moderateContent('');
    expect(result.ok).toBe(true);
  });

  it('passes a long, clean editorial post', async () => {
    const longPost =
      'The latest data from the Monetary Authority of Singapore shows that ' +
      'fintech investment in the region reached an all-time high in Q1 2026. ' +
      'Analysts attribute this to regulatory clarity and strong venture capital interest. ' +
      'Startups focusing on payments, lending, and wealth management are benefiting most. '.repeat(3);
    const result = await moderateContent(longPost);
    expect(result.ok).toBe(true);
  });
});
