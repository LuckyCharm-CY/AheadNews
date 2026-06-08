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

export const discoverStories: DiscoverStory[] = generatedDiscoverStories;
export const discoverFeedUpdatedAt = discoverStoriesUpdatedAt;

const WORLD_CATS:     DiscoverCategoryId[] = ['world-news', 'ai-tech', 'business-finance', 'world-sports', 'world-life'];
const SINGAPORE_CATS: DiscoverCategoryId[] = ['singapore-news', 'singapore-tech', 'singapore-business', 'singapore-sports', 'singapore-life'];

export function getStoriesForCategory(category: DiscoverCategoryId) {
  if (category === 'all')            return discoverStories;
  if (category === 'world-news')     return discoverStories.filter((s) => WORLD_CATS.includes(s.category));
  if (category === 'singapore-news') return discoverStories.filter((s) => SINGAPORE_CATS.includes(s.category));
  return discoverStories.filter((s) => s.category === category);
}

export function getFeaturedStoryByCategory(category: Exclude<DiscoverCategoryId, 'all'>) {
  return discoverStories.find((s) => s.category === category) ?? null;
}

export function getDiscoverStoryById(id: string) {
  return discoverStories.find((s) => s.id === id) ?? null;
}
