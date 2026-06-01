import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { DiscoverCategoryId } from '@/src/features/discover/types';

export type InterestId = Extract<
  DiscoverCategoryId,
  'ai-tech' | 'world-news' | 'business-finance' | 'world-sports' | 'world-life' | 'singapore-news'
>;

const INTERESTS_KEY   = 'ahead_interests';
const ONBOARDING_KEY  = 'ahead_onboarding_done';

async function read(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return await SecureStore.getItemAsync(key);
  } catch { return null; }
}

async function write(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch { /* best-effort */ }
}

type InterestsContextValue = {
  interests: InterestId[];
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  completeOnboarding: (ids: InterestId[]) => Promise<void>;
  updateInterests: (ids: InterestId[]) => Promise<void>;
};

const InterestsContext = createContext<InterestsContextValue>({
  interests: [],
  hasCompletedOnboarding: false,
  isLoading: true,
  completeOnboarding: async () => {},
  updateInterests: async () => {},
});

export function InterestsProvider({ children }: { children: React.ReactNode }) {
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [hasCompletedOnboarding, setCompleted] = useState(false);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [raw, done] = await Promise.all([read(INTERESTS_KEY), read(ONBOARDING_KEY)]);
      if (raw) {
        try { setInterests(JSON.parse(raw) as InterestId[]); } catch {}
      }
      setCompleted(done === 'true');
      setLoading(false);
    })();
  }, []);

  const completeOnboarding = useCallback(async (ids: InterestId[]) => {
    setInterests(ids);
    setCompleted(true);
    await Promise.all([
      write(INTERESTS_KEY, JSON.stringify(ids)),
      write(ONBOARDING_KEY, 'true'),
    ]);
  }, []);

  const updateInterests = useCallback(async (ids: InterestId[]) => {
    setInterests(ids);
    await write(INTERESTS_KEY, JSON.stringify(ids));
  }, []);

  return (
    <InterestsContext.Provider value={{ interests, hasCompletedOnboarding, isLoading, completeOnboarding, updateInterests }}>
      {children}
    </InterestsContext.Provider>
  );
}

export const useInterests = () => useContext(InterestsContext);
