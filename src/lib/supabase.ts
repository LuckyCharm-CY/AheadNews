import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Native (iOS / Android) — WebSocket is always available globally
const storage = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
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
    realtime: { transport: WebSocket },
  },
);
