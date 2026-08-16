import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { apiGet, apiSend } from "../lib/api";
import type { StaffContext } from "../lib/permissions";

interface AuthState {
  loading: boolean;
  /** True while /admin/me is in flight — covers the gap right after sign-in where `session` is already set but `staff` isn't resolved yet, so route guards don't misread "no staff yet" as "not staff" and bounce back to /login. */
  staffLoading: boolean;
  session: Session | null;
  staff: StaffContext | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<StaffContext | null>(null);

  async function loadStaff() {
    setStaffLoading(true);
    try {
      const s = await apiGet<StaffContext>("/admin/me");
      setStaff(s);
    } catch {
      setStaff(null);
    } finally {
      setStaffLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadStaff();
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) await loadStaff();
      else setStaff(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(identifier: string, password: string) {
    // Two ways in: a fixed super-admin username (not an email — the one
    // bootstrap door into a fresh environment, see api-server's
    // /admin/bootstrap-super-admin), or an invited staff member's own email.
    // Only try the bootstrap when it plainly isn't an email, so a normal
    // staff login doesn't pay for an extra round trip.
    let email = identifier;
    if (!identifier.includes("@")) {
      const result = await apiSend<{ email: string }>("POST", "/admin/bootstrap-super-admin", {
        username: identifier,
        password,
      });
      email = result.email;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStaff(null);
  }

  return (
    <AuthContext.Provider value={{ loading, staffLoading, session, staff, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
