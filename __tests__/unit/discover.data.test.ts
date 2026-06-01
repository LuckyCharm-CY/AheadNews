import type { DiscoverStory } from '../../src/features/discover/types';

// ─── Mock generated stories so tests are deterministic ───────────────────────
// Data is inlined inside the factory because jest.mock is hoisted above const
// declarations, so outer-scope variables would be undefined at factory time.

jest.mock('../../src/features/discover/generatedStories', () => ({
  generatedDiscoverStories: [
    { id: 'ai-1',     category: 'ai-tech',            headline: 'AI Story 1',      summary: 'AI summary.',      whyItMatters: 'AI matters.',   source: 'VentureBeat',   readTime: '3 min read' },
    { id: 'ai-2',     category: 'ai-tech',            headline: 'AI Story 2',      summary: 'AI summary 2.',    whyItMatters: 'AI matters 2.', source: 'The Verge',     readTime: '4 min read' },
    { id: 'world-1',  category: 'world-news',         headline: 'World Story 1',   summary: 'World summary.',   whyItMatters: 'World matters.', source: 'Reuters',      readTime: '2 min read' },
    { id: 'biz-1',    category: 'business-finance',   headline: 'Finance Story 1', summary: 'Finance summary.', whyItMatters: 'Biz matters.',  source: 'Bloomberg',     readTime: '5 min read' },
    { id: 'sg-1',     category: 'singapore-news',     headline: 'SG Story 1',      summary: 'SG summary.',      whyItMatters: 'SG matters.',   source: 'Straits Times', readTime: '3 min read' },
    { id: 'sg-tech-1',category: 'singapore-tech',     headline: 'SG Tech Story',   summary: 'SG tech summary.', whyItMatters: 'SG tech.',      source: 'CNA',           readTime: '3 min read' },
    { id: 'sports-1', category: 'world-sports',       headline: 'Sports Story',    summary: 'Sports summary.',  whyItMatters: 'Sports.',        source: 'BBC',           readTime: '2 min read' },
  ] as DiscoverStory[],
  discoverStoriesUpdatedAt: '2026-05-17T00:00:00.000Z',
}));

// Import AFTER mocking
import {
  discoverCategories,
  getStoriesForCategory,
  getFeaturedStoryByCategory,
  getDiscoverStoryById,
} from '../../src/features/discover/data';

// ─── discoverCategories ───────────────────────────────────────────────────────

describe('discoverCategories', () => {
  it('includes "all" as the first category', () => {
    expect(discoverCategories[0].id).toBe('all');
  });

  it('contains all expected category IDs', () => {
    const ids = discoverCategories.map(c => c.id);
    expect(ids).toContain('ai-tech');
    expect(ids).toContain('world-news');
    expect(ids).toContain('business-finance');
    expect(ids).toContain('singapore-news');
    expect(ids).toContain('world-sports');
    expect(ids).toContain('world-life');
  });

  it('every category has a non-empty label', () => {
    discoverCategories.forEach(c => {
      expect(c.label.length).toBeGreaterThan(0);
    });
  });
});

// ─── getStoriesForCategory ────────────────────────────────────────────────────

describe('getStoriesForCategory', () => {
  it('"all" returns every story', () => {
    // 7 stories in the mock above
    expect(getStoriesForCategory('all')).toHaveLength(7);
  });

  it('returns only ai-tech stories for "ai-tech"', () => {
    const stories = getStoriesForCategory('ai-tech');
    expect(stories.length).toBeGreaterThan(0);
    stories.forEach(s => expect(s.category).toBe('ai-tech'));
  });

  it('"world-news" returns all world-* categories (Browse All bucket)', () => {
    const stories = getStoriesForCategory('world-news');
    const WORLD_CATS = ['world-news', 'ai-tech', 'business-finance', 'world-sports', 'world-life'];
    stories.forEach(s => expect(WORLD_CATS).toContain(s.category));
  });

  it('"singapore-news" returns all singapore-* categories (Browse All bucket)', () => {
    const stories = getStoriesForCategory('singapore-news');
    const SG_CATS = ['singapore-news', 'singapore-tech', 'singapore-business', 'singapore-sports', 'singapore-life'];
    stories.forEach(s => expect(SG_CATS).toContain(s.category));
  });

  it('returns an empty array for a category with no stories', () => {
    expect(getStoriesForCategory('singapore-sports')).toHaveLength(0);
  });

  it('every returned story has required fields', () => {
    getStoriesForCategory('all').forEach(s => {
      expect(typeof s.id).toBe('string');
      expect(typeof s.headline).toBe('string');
      expect(typeof s.summary).toBe('string');
      expect(typeof s.source).toBe('string');
      expect(s.headline.length).toBeGreaterThan(0);
    });
  });
});

// ─── getFeaturedStoryByCategory ───────────────────────────────────────────────

describe('getFeaturedStoryByCategory', () => {
  it('returns the first story matching a category', () => {
    const story = getFeaturedStoryByCategory('ai-tech');
    expect(story).toBeDefined();
    expect(story?.category).toBe('ai-tech');
  });

  it('returns undefined for a category with no stories', () => {
    const story = getFeaturedStoryByCategory('singapore-sports');
    expect(story).toBeUndefined();
  });
});

// ─── getDiscoverStoryById ─────────────────────────────────────────────────────

describe('getDiscoverStoryById', () => {
  it('returns the correct story for a known ID', () => {
    const story = getDiscoverStoryById('ai-1');
    expect(story).toBeDefined();
    expect(story?.id).toBe('ai-1');
    expect(story?.headline).toBe('AI Story 1');
  });

  it('returns undefined for an unknown ID', () => {
    expect(getDiscoverStoryById('does-not-exist')).toBeUndefined();
  });

  it('returns undefined for an empty string ID', () => {
    expect(getDiscoverStoryById('')).toBeUndefined();
  });
});
