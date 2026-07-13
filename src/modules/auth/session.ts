import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/surfaces";
import type { Profile, UserRole } from "@/lib/db/types";

export interface Session {
  userId: string;
  email: string | null;
  profile: Profile;
}

function roleFromMetadata(value: unknown): UserRole {
  return value === "admin" || value === "provider" || value === "rider" || value === "customer"
    ? value
    : "customer";
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
    .maybeSingle();

  if (profile) return { userId: user.id, email: user.email ?? null, profile };

  const role = roleFromMetadata(user.app_metadata?.role);
  const admin = createAdminClient();
  const { data: repaired } = await admin
    .from("profiles")
    .upsert({
      id: user.id,
      role,
      full_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
      phone: typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null,
    }, { onConflict: "id" })
    .select("*")
    .single();

  if (!repaired) return null;
  return { userId: user.id, email: user.email ?? null, profile: repaired };
}

/** Redirects to /login when there is no session. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Gate a page on role. This is a UX boundary, not a security one - RLS is what
 * actually stops a rider reading a provider's payouts. Both exist on purpose.
 */
export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.profile.role)) {
    // homeForRole is absolute (the role's subdomain) in live mode, a path in dev.
    redirect(homeForRole(session.profile.role) as Route);
  }
  return session;
}

/**
 * Where a role lands after sign-in. In live subdomain mode this is the role's
 * own subdomain (vendor./rider./admin./root); in dev it is the internal path.
 * PRD Section 02 + Addendum Section 2.
 */
export function homePathForRole(role: UserRole): string {
  return homeForRole(role);
}
