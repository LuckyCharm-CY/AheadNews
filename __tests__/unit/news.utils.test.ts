import {
  firstSentence,
  hotScore,
  extractFundingAmount,
  extractFundingStage,
  extractStartupName,
} from '../../src/utils/news';

// ─── firstSentence ────────────────────────────────────────────────────────────

describe('firstSentence', () => {
  it('returns the first sentence when terminated by a period', () => {
    expect(firstSentence('Apple unveiled a new product. The device launches in June.'))
      .toBe('Apple unveiled a new product.');
  });

  it('handles exclamation marks as terminators', () => {
    expect(firstSentence('Breaking news! More details follow.')).toBe('Breaking news!');
  });

  it('handles question marks as terminators', () => {
    expect(firstSentence('Is AI taking over? Experts weigh in.')).toBe('Is AI taking over?');
  });

  it('appends a period when no terminator exists', () => {
    expect(firstSentence('A sentence without punctuation')).toBe('A sentence without punctuation.');
  });

  it('does not double-append a period', () => {
    expect(firstSentence('Already has a period.')).toBe('Already has a period.');
  });

  it('returns the entire text when there is only one sentence', () => {
    expect(firstSentence('Only one sentence here.')).toBe('Only one sentence here.');
  });
});

// ─── hotScore ─────────────────────────────────────────────────────────────────

describe('hotScore', () => {
  const hours = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

  it('returns 0 for a post with zero votes', () => {
    expect(hotScore({ votes: 0, createdAt: hours(1) })).toBe(0);
  });

  it('gives a higher score to a newer post with equal votes', () => {
    const newer = hotScore({ votes: 50, createdAt: hours(1) });
    const older  = hotScore({ votes: 50, createdAt: hours(48) });
    expect(newer).toBeGreaterThan(older);
  });

  it('gives a higher score to a post with more votes at equal age', () => {
    const highVotes = hotScore({ votes: 100, createdAt: hours(6) });
    const lowVotes  = hotScore({ votes: 1,   createdAt: hours(6) });
    expect(highVotes).toBeGreaterThan(lowVotes);
  });

  it('returns a positive score for any post with votes > 0', () => {
    expect(hotScore({ votes: 1, createdAt: hours(2) })).toBeGreaterThan(0);
  });
});

// ─── extractFundingAmount ─────────────────────────────────────────────────────

describe('extractFundingAmount', () => {
  it('extracts million amounts', () => {
    expect(extractFundingAmount('Startup raises $35 million in Series A')).toBe('$35M');
    expect(extractFundingAmount('Startup raises $35M in Series A')).toBe('$35M');
  });

  it('extracts billion amounts', () => {
    expect(extractFundingAmount('Company valued at $1.2 billion')).toBe('$1.2B');
    expect(extractFundingAmount('Company valued at $2B')).toBe('$2B');
  });

  it('extracts thousand amounts', () => {
    expect(extractFundingAmount('Early-stage startup raises $500K')).toBe('$500K');
    expect(extractFundingAmount('Pre-seed round of $500 thousand')).toBe('$500K');
  });

  it('returns empty string when no amount is found', () => {
    expect(extractFundingAmount('Company announces new product launch')).toBe('');
    expect(extractFundingAmount('')).toBe('');
  });
});

// ─── extractFundingStage ──────────────────────────────────────────────────────

describe('extractFundingStage', () => {
  it('detects Pre-Seed', () => {
    expect(extractFundingStage('pre-seed funding round announced')).toBe('Pre-Seed');
    expect(extractFundingStage('pre seed capital')).toBe('Pre-Seed');
  });

  it('detects Seed', () => {
    expect(extractFundingStage('seed round of $2M')).toBe('Seed');
  });

  it('detects Series A', () => {
    expect(extractFundingStage('raises $10M in Series A')).toBe('Series A');
  });

  it('detects Series B', () => {
    expect(extractFundingStage('closes $50M Series B')).toBe('Series B');
  });

  it('detects Series C and above as Series C+', () => {
    expect(extractFundingStage('secures $200M in Series C')).toBe('Series C+');
    expect(extractFundingStage('Series D funding round')).toBe('Series C+');
    expect(extractFundingStage('Series E extension')).toBe('Series C+');
  });

  it('defaults to Seed when stage cannot be determined', () => {
    expect(extractFundingStage('company receives investment')).toBe('Seed');
  });
});

// ─── extractStartupName ───────────────────────────────────────────────────────

describe('extractStartupName', () => {
  it('extracts the company name before "raises"', () => {
    expect(extractStartupName('Acme Corp raises $5M in seed round')).toBe('Acme Corp');
  });

  it('extracts the company name before "secures"', () => {
    expect(extractStartupName('TechFlow secures $20M Series A')).toBe('TechFlow');
  });

  it('extracts the company name before "lands"', () => {
    expect(extractStartupName('DataBridge lands $8M to expand')).toBe('DataBridge');
  });

  it('extracts the company name before "announces"', () => {
    expect(extractStartupName('NovaStar announces $15M funding')).toBe('NovaStar');
  });

  it('truncates names longer than 40 characters', () => {
    const longName = 'A'.repeat(50) + ' raises $1M';
    expect(extractStartupName(longName).length).toBeLessThanOrEqual(40);
  });
});
