import { createClient } from '@supabase/supabase-js';

// Web build — WebSocket exists in the browser but not in Node.js 20 SSR (Metro).
// Fall back to the 'ws' package for the SSR context.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const wsTransport: typeof WebSocket =
  typeof WebSocket !== 'undefined' ? WebSocket : require('ws');

// Web storage — localStorage works in-browser; return null in SSR to skip persistence
const storage = {
  getItem: (key: string): Promise<string | null> => {
    if (typeof localStorage === 'undefined') return Promise.resolve(null);
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return Promise.resolve();
  },
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
    },
    realtime: { transport: wsTransport },
  },
);
