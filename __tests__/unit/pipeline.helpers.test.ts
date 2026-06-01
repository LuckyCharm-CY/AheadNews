import {
  classifyRelease,
  classifySector,
  decodeHtml,
  stripTags,
  getDomain,
  makeInitials,
} from '../../src/utils/pipeline';

// ─── classifyRelease ──────────────────────────────────────────────────────────

describe('classifyRelease', () => {
  it('classifies AI / ML releases', () => {
    expect(classifyRelease('OpenAI releases GPT-5 model').cat).toBe('AI / ML');
    expect(classifyRelease('Google DeepMind announces new LLM').cat).toBe('AI / ML');
    expect(classifyRelease('Claude 4 by Anthropic').cat).toBe('AI / ML');
  });

  it('classifies Mobile releases', () => {
    expect(classifyRelease('Apple releases iOS 19 beta').cat).toBe('Mobile');
    expect(classifyRelease('New Android feature drops').cat).toBe('Mobile');
  });

  it('classifies Dev Tools releases', () => {
    expect(classifyRelease('VS Code ships new API').cat).toBe('Dev Tools');
    expect(classifyRelease('npm package manager update').cat).toBe('Dev Tools');
  });

  it('classifies Security releases', () => {
    expect(classifyRelease('Critical zero-day vulnerability patched').cat).toBe('Security');
    expect(classifyRelease('password breach disclosed').cat).toBe('Security');
  });

  it('classifies Hardware releases', () => {
    expect(classifyRelease('NVIDIA GPU benchmark results').cat).toBe('Hardware');
    expect(classifyRelease('New chip from Intel').cat).toBe('Hardware');
  });

  it('defaults to Web for unclassified text', () => {
    expect(classifyRelease('Company launches new website redesign').cat).toBe('Web');
    expect(classifyRelease('').cat).toBe('Web');
  });

  it('returns a non-empty bg color for every category', () => {
    const samples = [
      'new LLM model',
      'iOS update',
      'npm package',
      'zero-day vulnerability',
      'NVIDIA GPU',
      'website redesign',
    ];
    samples.forEach(s => {
      expect(classifyRelease(s).bg.startsWith('#')).toBe(true);
    });
  });
});

// ─── classifySector ───────────────────────────────────────────────────────────

describe('classifySector', () => {
  it('detects AI sector', () => {
    expect(classifySector('AI startup raises seed round')).toBe('AI');
    expect(classifySector('generative AI platform')).toBe('AI');
  });

  it('detects HealthTech sector', () => {
    expect(classifySector('biotech company developing genomics tools')).toBe('HealthTech');
    expect(classifySector('medtech startup for clinical trials')).toBe('HealthTech');
  });

  it('detects FinTech sector', () => {
    expect(classifySector('fintech payments startup')).toBe('FinTech');
    expect(classifySector('crypto and DeFi platform')).toBe('FinTech');
  });

  it('detects CleanTech sector', () => {
    expect(classifySector('solar energy and EV charging')).toBe('CleanTech');
    expect(classifySector('carbon capture startup')).toBe('CleanTech');
  });

  it('detects SaaS sector', () => {
    expect(classifySector('B2B SaaS enterprise workflow automation')).toBe('SaaS');
  });

  it('defaults to Tech for unmatched text', () => {
    expect(classifySector('e-commerce marketplace')).toBe('Tech');
    expect(classifySector('')).toBe('Tech');
  });
});

// ─── decodeHtml ───────────────────────────────────────────────────────────────

describe('decodeHtml', () => {
  it('decodes named HTML entities', () => {
    expect(decodeHtml('AT&amp;T')).toBe('AT&T');
    expect(decodeHtml('1 &lt; 2 &gt; 0')).toBe('1 < 2 > 0');
    expect(decodeHtml('say &quot;hello&quot;')).toBe('say "hello"');
    expect(decodeHtml('it&#39;s')).toBe("it's");
    expect(decodeHtml('hello&nbsp;world')).toBe('hello world');
  });

  it('decodes decimal numeric entities', () => {
    expect(decodeHtml('&#65;')).toBe('A'); // A = 65
    expect(decodeHtml('&#8364;')).toBe('€'); // euro sign
  });

  it('decodes hex numeric entities', () => {
    expect(decodeHtml('&#x41;')).toBe('A');
    expect(decodeHtml('&#x20AC;')).toBe('€');
  });

  it('leaves plain text unchanged', () => {
    expect(decodeHtml('hello world')).toBe('hello world');
    expect(decodeHtml('')).toBe('');
  });
});

// ─── stripTags ────────────────────────────────────────────────────────────────

describe('stripTags', () => {
  it('removes HTML tags', () => {
    expect(stripTags('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('decodes named entities while stripping tags', () => {
    // &amp; → &, but &lt;rocks&gt; first decodes to <rocks> which stripTags then removes as a tag
    expect(stripTags('<p>AT&amp;T</p>')).toBe('AT&T');
    expect(stripTags('Revenue &amp; Profit')).toBe('Revenue & Profit');
  });

  it('collapses multiple spaces', () => {
    expect(stripTags('<div>  hello   world  </div>')).toBe('hello world');
  });

  it('handles empty input', () => {
    expect(stripTags('')).toBe('');
  });

  it('strips self-closing tags', () => {
    expect(stripTags('line1<br/>line2')).toBe('line1 line2');
  });
});

// ─── getDomain ────────────────────────────────────────────────────────────────

describe('getDomain', () => {
  it('extracts domain without www prefix', () => {
    expect(getDomain('https://www.techcrunch.com/article/123')).toBe('techcrunch.com');
    expect(getDomain('https://www.reuters.com/')).toBe('reuters.com');
  });

  it('returns bare domain when no www', () => {
    expect(getDomain('https://venturebeat.com/2026/01/ai')).toBe('venturebeat.com');
  });

  it('returns empty string for invalid URLs', () => {
    expect(getDomain('not-a-url')).toBe('');
    expect(getDomain('')).toBe('');
  });

  it('handles subdomain correctly', () => {
    expect(getDomain('https://blog.example.com/post')).toBe('blog.example.com');
  });
});

// ─── makeInitials ─────────────────────────────────────────────────────────────

describe('makeInitials', () => {
  it('returns two uppercase initials for a two-word name', () => {
    expect(makeInitials('John Doe')).toBe('JD');
    expect(makeInitials('Alice Smith')).toBe('AS');
  });

  it('returns one initial for a single word', () => {
    expect(makeInitials('Apple')).toBe('A');
  });

  it('uses only the first two words for longer names', () => {
    expect(makeInitials('International Business Machines')).toBe('IB');
  });

  it('handles leading/trailing spaces', () => {
    expect(makeInitials('  Jane  Doe  ')).toBe('JD');
  });

  it('uppercases initials regardless of input case', () => {
    expect(makeInitials('john doe')).toBe('JD');
  });
});
