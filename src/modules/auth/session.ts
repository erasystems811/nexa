import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/db/types";

export interface Session {
  userId: string;
  email: string | null;
  profile: Profile;
}

/** The signed-in user, or null. Never throws. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile };
}

/** Redirects to /login when there is no session. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Gate a page on role. This is a UX boundary, not a security one — RLS is what
 * actually stops a rider reading a provider's payouts. Both exist on purpose.
 */
export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.profile.role)) {
    redirect(homePathForRole(session.profile.role));
  }
  return session;
}

/** Where a role lands after sign-in. PRD Section 02: four surfaces. */
export function homePathForRole(role: UserRole): Route {
  switch (role) {
    case "admin":
      return "/admin";
    case "provider":
      return "/studio";
    case "rider":
      return "/rider";
    case "customer":
      return "/";
  }
}
