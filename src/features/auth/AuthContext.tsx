import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/src/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  memberSince: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToUser(session: Session): AuthUser {
  const u = session.user;
  return {
    id:          u.id,
    name:        (u.user_metadata?.name as string | undefined) ?? u.email?.split('@')[0] ?? 'User',
    email:       u.email ?? '',
    memberSince: u.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore persisted session on launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session ? sessionToUser(session) : null);
      setIsLoading(false);
    });

    // Keep state in sync with Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? sessionToUser(session) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(name: string, email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
    // Supabase returns session=null when email confirmation is required
    return { needsEmailConfirm: !data.session };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
