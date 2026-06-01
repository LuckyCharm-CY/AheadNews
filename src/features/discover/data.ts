import type { DiscoverCategory, DiscoverCategoryId, DiscoverStory } from './types';
import { discoverStoriesUpdatedAt, generatedDiscoverStories } from './generatedStories';

export const discoverCategories: DiscoverCategory[] = [
  { id: 'all',                label: 'All' },
  // World
  { id: 'world-news',         label: 'World News' },
  { id: 'ai-tech',            label: 'Tech & AI' },
  { id: 'business-finance',   label: 'Business' },
  { id: 'world-sports',       label: 'Sports' },
  { id: 'world-life',         label: 'Life' },
  // Singapore
  { id: 'singapore-news',     label: 'Singapore' },
  { id: 'singapore-tech',     label: 'Tech & AI' },
  { id: 'singapore-business', label: 'Business' },
  { id: 'singapore-sports',   label: 'Sports' },
  { id: 'singapore-life',     label: 'Life' },
];

const fallbackStories: DiscoverStory[] = [
  {
    id: 'ai-1',
    category: 'ai-tech',
    headline: 'Open models narrow the enterprise performance gap',
    summary: 'A benchmark cycle shows open models approaching premium performance in several enterprise workloads.',
    whyItMatters: 'Cost-to-performance changes can reshape software buying decisions.',
    source: 'VentureBeat',
    readTime: '3 min read',
    imageUrl: 'https://picsum.photos/seed/fallback-ai-1/1200/700',
  },
  {
    id: 'world-1',
    category: 'world-news',
    headline: 'Global energy agencies raise cross-border grid investment outlook',
    summary: 'Regional partners are accelerating shared-grid projects to reduce outage risks and support industrial demand.',
    whyItMatters: 'Power reliability is becoming a core competitiveness issue for national economies.',
    source: 'Reuters',
    readTime: '4 min read',
    imageUrl: 'https://picsum.photos/seed/world-1/1200/700',
  },
  {
    id: 'biz-1',
    category: 'business-finance',
    headline: 'Regional banks test AI copilots for SME loan reviews',
    summary: 'Pilot programs focus on faster document checks and risk scoring while maintaining human approval control.',
    whyItMatters: 'Lending speed can improve business cash flow and expansion outcomes.',
    source: 'Bloomberg',
    readTime: '4 min read',
    imageUrl: 'https://picsum.photos/seed/biz-1/1200/700',
  },
  {
    id: 'sg-1',
    category: 'singapore-news',
    headline: 'New digital services initiative expands support for local SMEs',
    summary: 'A public-private program offers digital advisory and implementation grants for smaller businesses.',
    whyItMatters: 'Adoption support helps local companies compete in a faster digital market.',
    source: 'Straits Times',
    readTime: '3 min read',
    imageUrl: 'https://picsum.photos/seed/sg-1/1200/700',
  },
];

export const discoverStories: DiscoverStory[] =
  generatedDiscoverStories.length > 0 ? generatedDiscoverStories : fallbackStories;
export const discoverFeedUpdatedAt = generatedDiscoverStories.length > 0 ? discoverStoriesUpdatedAt : '';

// Stories that belong to each "Browse All" bucket
const WORLD_CATS:     DiscoverCategoryId[] = ['world-news', 'ai-tech', 'business-finance', 'world-sports', 'world-life'];
const SINGAPORE_CATS: DiscoverCategoryId[] = ['singapore-news', 'singapore-tech', 'singapore-business', 'singapore-sports', 'singapore-life'];

export function getStoriesForCategory(category: DiscoverCategoryId) {
  if (category === 'all')           return discoverStories;
  if (category === 'world-news')    return discoverStories.filter((s) => WORLD_CATS.includes(s.category));
  if (category === 'singapore-news') return discoverStories.filter((s) => SINGAPORE_CATS.includes(s.category));
  return discoverStories.filter((story) => story.category === category);
}

export function getFeaturedStoryByCategory(category: Exclude<DiscoverCategoryId, 'all'>) {
  return discoverStories.find((story) => story.category === category);
}

export function getDiscoverStoryById(id: string) {
  return discoverStories.find((story) => story.id === id);
}
