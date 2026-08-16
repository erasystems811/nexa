import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nexa/db-types/src/types";
import { ensureAuthUser, trySendPasswordSetupCode } from "../auth/provisioning.js";
import { env } from "../../env.js";
import { adminDb, audit, AdminError } from "./context.js";
import { bundleFor, ALL_PERMISSIONS, type Permission, type StaffRole } from "./permissions.js";

/**
 * Staff accounts, roles, and permissions.
 *
 * The gate for the whole Admin Console: a staff member is a profile with
 * role='admin' AND an active staff_members row. `requireStaff` establishes that;
 * `requirePermission` narrows it to a specific capability. Every privileged
 * route runs through `requirePermission`, so a Finance staffer calling a
 * provider-approval endpoint directly is refused the same as one clicking a
 * button they cannot see.
 */

export interface StaffContext {
  userId: string;
  staffId: string;
  role: StaffRole;
  permissions: Permission[];
  isSuperAdmin: boolean;
}

/** The signed-in staff member, or null. `supabase` is the caller's own request-scoped client. */
export async function currentStaff(supabase: SupabaseClient<Database>): Promise<StaffContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("staff_members")
    .select("id, staff_role, permissions, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data || data.status !== "active") return null;

  const isSuperAdmin = data.staff_role === "super_admin";
  return {
    userId: user.id,
    staffId: data.id,
    role: data.staff_role,
    // A super admin effectively holds every permission.
    permissions: isSuperAdmin ? ALL_PERMISSIONS : (data.permissions as Permission[]),
    isSuperAdmin,
  };
}

export async function requireStaff(supabase: SupabaseClient<Database>): Promise<StaffContext> {
  const staff = await currentStaff(supabase);
  if (!staff) throw new AdminError("You do not have Admin Console access");
  return staff;
}

/**
 * The single authorisation call every privileged route makes. Returns the
 * acting staff's user id (for audit), or throws if the permission is missing.
 */
export async function requirePermission(supabase: SupabaseClient<Database>, permission: Permission): Promise<string> {
  const staff = await requireStaff(supabase);
  if (!staff.isSuperAdmin && !staff.permissions.includes(permission)) {
    throw new AdminError("You do not have permission to do that");
  }
  return staff.userId;
}

export function can(staff: StaffContext | null, permission: Permission): boolean {
  if (!staff) return false;
  return staff.isSuperAdmin || staff.permissions.includes(permission);
}

// ---- staff administration (needs staff.manage) ----------------------------

export async function listStaff() {
  const db = adminDb();
  const { data } = await db
    .from("staff_members")
    .select("id, user_id, staff_role, department, permissions, status, last_login_at, created_at, profiles!staff_members_user_id_fkey ( full_name )")
    .order("created_at", { ascending: false });

  // Attach the email from auth for each staff row.
  const rows = data ?? [];
  const withEmail = await Promise.all(
    rows.map(async (r) => {
      const { data: u } = await db.auth.admin.getUserById(r.user_id);
      return { ...r, email: u.user?.email ?? null };
    }),
  );
  return withEmail;
}

export async function getStaffMember(staffId: string) {
  const db = adminDb();
  const { data } = await db
    .from("staff_members")
    .select("*, profiles ( full_name )")
    .eq("id", staffId)
    .maybeSingle();
  if (!data) return null;

  const { data: u } = await db.auth.admin.getUserById(data.user_id);
  const { data: logins } = await db
    .from("staff_login_events")
    .select("event, ip_address, created_at")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(20);

  return { ...data, email: u.user?.email ?? null, logins: logins ?? [] };
}

export interface StaffInviteResult {
  staffId: string;
  /** Set when the staff record exists but they could not be told how to sign in. */
  warning?: string;
}

/**
 * Invite a staff member. Reuses the login when the email already has one
 * (createUser on an existing email fails outright, which used to make inviting
 * an existing user impossible), marks the profile as internal staff, and seeds
 * their permissions from the role's default bundle — which the Super Admin can
 * then adjust per person.
 *
 * The login is created with no password: the invitee gets a code and sets their
 * own at /reset. If that email cannot be sent, the invite still stands and the
 * caller surfaces the warning — Forgot password is the same door.
 */
export async function inviteStaff(
  actorId: string,
  input: { email: string; fullName: string; role: StaffRole; department?: string },
): Promise<StaffInviteResult> {
  const db = adminDb();

  let user;
  try {
    user = (await ensureAuthUser({ email: input.email, fullName: input.fullName })).user;
  } catch (e) {
    throw new AdminError(`Could not create the login: ${e instanceof Error ? e.message : "unknown error"}`);
  }

  // staff_members.user_id is unique — an existing staffer is edited, not re-invited.
  const { data: alreadyStaff } = await db
    .from("staff_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (alreadyStaff) {
    throw new AdminError(`${input.email} is already a staff member. Open their staff page to change their role.`);
  }

  await db.from("profiles").update({ role: "admin", full_name: input.fullName }).eq("id", user.id);

  const { data: staff, error: staffErr } = await db
    .from("staff_members")
    .insert({
      user_id: user.id,
      staff_role: input.role,
      department: input.department ?? null,
      permissions: input.role === "super_admin" ? [] : bundleFor(input.role),
      invited_by: actorId,
    })
    .select("id")
    .single();
  if (staffErr || !staff) throw new AdminError(`Could not create the staff record: ${staffErr?.message}`);

  await audit(actorId, "invite_staff", "staff_member", staff.id, null, { email: input.email, role: input.role });

  const warning = await trySendPasswordSetupCode({ email: input.email, name: input.fullName, appUrl: env.ADMIN_APP_URL });
  return { staffId: staff.id, warning };
}

/** Change someone's role — which resets their permissions to that role's bundle. */
export async function setStaffRole(actorId: string, staffId: string, role: StaffRole): Promise<void> {
  const db = adminDb();
  const { error } = await db
    .from("staff_members")
    .update({ staff_role: role, permissions: role === "super_admin" ? [] : bundleFor(role) })
    .eq("id", staffId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, "set_staff_role", "staff_member", staffId, null, { role });
}

/** Grant or revoke a single permission — the per-person override on top of the role. */
export async function toggleStaffPermission(
  actorId: string,
  staffId: string,
  permission: Permission,
  grant: boolean,
): Promise<void> {
  const db = adminDb();
  const { data: staff } = await db.from("staff_members").select("permissions, staff_role").eq("id", staffId).single();
  if (!staff) throw new AdminError("No such staff member");
  if (staff.staff_role === "super_admin") throw new AdminError("A Super Admin already holds every permission");

  const set = new Set(staff.permissions as Permission[]);
  if (grant) set.add(permission);
  else set.delete(permission);

  const { error } = await db.from("staff_members").update({ permissions: [...set] }).eq("id", staffId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, grant ? "grant_permission" : "revoke_permission", "staff_member", staffId, null, { permission });
}

export async function setStaffStatus(actorId: string, staffId: string, status: "active" | "suspended"): Promise<void> {
  const db = adminDb();
  const { error } = await db.from("staff_members").update({ status }).eq("id", staffId);
  if (error) throw new AdminError(error.message);
  await audit(actorId, status === "suspended" ? "suspend_staff" : "reactivate_staff", "staff_member", staffId);
}

/** Records a login for the account's visible history */
export async function recordLogin(userId: string): Promise<void> {
  const db = adminDb();
  const { data: staff } = await db.from("staff_members").select("id").eq("user_id", userId).maybeSingle();
  if (!staff) return;
  await db.from("staff_members").update({ last_login_at: new Date().toISOString() }).eq("id", staff.id);
  await db.from("staff_login_events").insert({ staff_id: staff.id, event: "login" });
}

/**
 * The per-person activity log (the user's requirement: every action tied to the
 * account that did it). Reads audit_log for one staff member's user id.
 */
export async function staffActivity(userId: string, limit = 100) {
  const db = adminDb();
  const { data } = await db
    .from("audit_log")
    .select("action, entity_type, entity_id, created_at")
    .eq("actor_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** The whole platform's activity feed, newest first, with the actor's name. */
export async function activityFeed(limit = 150) {
  const db = adminDb();
  const { data } = await db
    .from("audit_log")
    .select("id, action, entity_type, entity_id, created_at, profiles!audit_log_actor_id_fkey ( full_name )")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * The one bootstrap door into the Admin Console: a fixed username/password
 * pair from env (Railway config, not a database row), checked here, that
 * provisions — or repairs — a real Supabase Auth user + profile +
 * super_admin staff row for NEXA_SUPER_ADMIN_EMAIL every time it's used.
 * Ported from apps/customer's modules/auth/actions.ts (ensureEnvSuperAdmin).
 *
 * Without this there is no way to reach the Admin Console at all on a fresh
 * environment — invited staff (inviteStaff()) can only be created BY an
 * existing admin, so the very first admin has to come from somewhere else.
 *
 * Returns the real email to sign in with, once the row is in place; throws
 * AdminError if the typed credentials don't match the configured pair, or if
 * the pair isn't configured yet.
 */
export async function ensureEnvSuperAdmin(username: string, password: string): Promise<{ email: string }> {
  const configuredUsername = env.NEXA_SUPER_ADMIN_USERNAME?.trim();
  const configuredEmail = env.NEXA_SUPER_ADMIN_EMAIL?.trim();
  const configuredPassword = env.NEXA_SUPER_ADMIN_PASSWORD?.trim();

  if (!configuredUsername || !configuredEmail || !configuredPassword) {
    throw new AdminError("Admin login is not configured yet. Set the Nexa Super Admin env values.");
  }
  if (username.trim().toLowerCase() !== configuredUsername.toLowerCase() || password.trim() !== configuredPassword) {
    throw new AdminError("Admin username and password do not match.");
  }

  const admin = adminDb();
  const normalizedEmail = configuredEmail.toLowerCase();
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new AdminError(listError.message);

  const existing = listed.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
  const appMetadata = { role: "admin" };
  const userMetadata = { full_name: "Nexa Super Admin" };

  let userId = existing?.id;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: configuredPassword,
      email_confirm: true,
      app_metadata: { ...(existing?.app_metadata ?? {}), ...appMetadata },
      user_metadata: { ...(existing?.user_metadata ?? {}), ...userMetadata },
    });
    if (error) throw new AdminError(error.message);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: configuredPassword,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    });
    if (error || !data.user) throw new AdminError(error?.message ?? "Could not create the admin login");
    userId = data.user.id;
  }
  if (!userId) throw new AdminError("Could not resolve the admin login");

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: userId, role: "admin", full_name: "Nexa Super Admin" }, { onConflict: "id" });
  if (profileError) throw new AdminError(profileError.message);

  const { error: staffError } = await admin
    .from("staff_members")
    .upsert({ user_id: userId, staff_role: "super_admin", permissions: [], status: "active" }, { onConflict: "user_id" });
  if (staffError) throw new AdminError(staffError.message);

  return { email: normalizedEmail };
}
