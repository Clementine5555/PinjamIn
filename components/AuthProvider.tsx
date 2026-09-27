'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<{ user: User | null; loading: boolean; error: string }>({ user: null, loading: true, error: '' });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ user: User | null; loading: boolean; error: string }>({ user: null, loading: true, error: '' });
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      if (active) setState({ user: session?.user ?? null, loading: false, error: '' });
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && (!receivedEvent || error)) setState({ user: data.session?.user ?? null, loading: false, error: error ? 'Sesi gagal dimuat. Muat ulang halaman.' : '' });
    }).catch(() => {
      if (active) setState({ user: null, loading: false, error: 'Sesi gagal dimuat. Muat ulang halaman.' });
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
