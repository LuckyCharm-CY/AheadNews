import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { discoverStories } from './data';
import type { DiscoverStory } from './types';

type SavedCtx = {
  savedIds: string[];
  toggleSave: (id: string) => void;
  registerExtra: (story: DiscoverStory) => void;
  savedStories: DiscoverStory[];
};

const SavedContext = createContext<SavedCtx | null>(null);

export function SavedStoriesProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds]   = useState<string[]>([]);
  const [extras,   setExtras]     = useState<Map<string, DiscoverStory>>(new Map());

  const toggleSave = useCallback((id: string) => {
    setSavedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }, []);

  // Register a story that isn't in discoverStories (e.g. Startup of the Day)
  // so it can appear in the Saved Stories list on the profile.
  const registerExtra = useCallback((story: DiscoverStory) => {
    setExtras((prev) => {
      if (prev.has(story.id)) return prev;
      const next = new Map(prev);
      next.set(story.id, story);
      return next;
    });
  }, []);

  const savedStories = savedIds
    .map((id) => discoverStories.find((s) => s.id === id) ?? extras.get(id))
    .filter((s): s is DiscoverStory => s != null);

  return (
    <SavedContext.Provider value={{ savedIds, toggleSave, registerExtra, savedStories }}>
      {children}
    </SavedContext.Provider>
  );
}

export function useSavedStories() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSavedStories must be inside SavedStoriesProvider');
  return ctx;
}
