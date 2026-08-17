import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, vendorAuthEmail } from "../lib/supabase";
import { apiGet } from "../lib/api";

export interface Provider {
  id: string;
  business_name: string;
  slug: string;
  status: string;
  is_on_probation: boolean;
  is_featured: boolean;
  strike_count: number;
  city_id: string | null;
  [key: string]: unknown;
}

interface AuthState {
  loading: boolean;
  /** True while /provider/me is in flight — covers the gap right after sign-in where `session` is already set but `provider` isn't resolved yet, so route guards don't misread "no provider yet" as "not a provider" and bounce back to /login. */
  providerLoading: boolean;
  session: Session | null;
  provider: Provider | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProvider: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [providerLoading, setProviderLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);

  async function loadProvider() {
    setProviderLoading(true);
    try {
      const p = await apiGet<Provider>("/provider/me");
      setProvider(p);
    } catch {
      setProvider(null);
    } finally {
      setProviderLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProvider();
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // TOKEN_REFRESHED fires whenever the tab regains focus and Supabase
      // silently rotates the access token in the background — the signed-in
      // user hasn't changed, so don't blank the page and refetch /provider/me.
      // INITIAL_SESSION is already handled by the getSession() call above;
      // handling it here too would double-fetch on every mount.
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        setSession(newSession);
        return;
      }
      setSession(newSession);
      if (newSession) await loadProvider();
      else setProvider(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    // A vendor's account is stored under a tagged address, kept separate from
    // any customer account under the same real email.
    const { error } = await supabase.auth.signInWithPassword({ email: vendorAuthEmail(email), password });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProvider(null);
  }

  return (
    <AuthContext.Provider
      value={{ loading, providerLoading, session, provider, signIn, signOut, refreshProvider: loadProvider }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
