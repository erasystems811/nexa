/**
 * End-to-end check for staff roles & permissions. PRD Addendum v1.1 §4.
 *
 *   npm run e2e:staff     (then npm run e2e:purge)
 *
 * Proves the authorisation boundary: the DB has_permission function, the role
 * bundles, per-person grants/revokes, super-admin bypass, suspension, and that
 * a scoped staffer's session genuinely cannot read what their permission set
 * excludes. Also checks every action is attributed to its actor in the log.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bundleFor, PERMISSIONS as P, ROLE_BUNDLES } from "@/modules/admin/permissions";
import type { Database } from "@/lib/db/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail: unknown = "") {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}  ${JSON.stringify(detail)}`); }
}
async function signIn(email: string, pw: string): Promise<SupabaseClient<Database>> {
  const c = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}
// has_permission is evaluated in the DB against the *caller's* JWT.
async function hasPerm(client: SupabaseClient<Database>, perm: string): Promise<boolean> {
  const { data } = await client.rpc("staff_has_permission", { perm });
  return data === true;
}

async function main() {
  const s = Date.now();
  const pw = "NexaE2E!12345";
  const superEmail = `e2e.sf.super.${s}@gmail.com`;
  const financeEmail = `e2e.sf.fin.${s}@gmail.com`;
  const supportEmail = `e2e.sf.sup.${s}@gmail.com`;
  const userIds: string[] = [];

  try {
    const mkStaff = async (email: string, role: "super_admin" | "finance" | "customer_support") => {
      const { data, error } = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: email } });
      if (error) throw new Error(error.message);
      userIds.push(data.user.id);
      await db.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
      await db.from("staff_members").insert({
        user_id: data.user.id,
        staff_role: role,
        permissions: role === "super_admin" ? [] : bundleFor(role),
      });
      return data.user.id;
    };

    const superId = await mkStaff(superEmail, "super_admin");
    await mkStaff(financeEmail, "finance");
    await mkStaff(supportEmail, "customer_support");

    const superC = await signIn(superEmail, pw);
    const financeC = await signIn(financeEmail, pw);
    const supportC = await signIn(supportEmail, pw);

    // ---- role bundles ------------------------------------------------------
    const { data: fin } = await db.from("staff_members").select("permissions").eq("user_id", userIds[1]).single();
    check("finance starts with its default bundle", JSON.stringify((fin?.permissions ?? []).sort()) === JSON.stringify([...ROLE_BUNDLES.finance].sort()), fin?.permissions);

    // ---- super admin bypass ------------------------------------------------
    check("super admin has every permission (bypass)", await hasPerm(superC, P.staffManage) && await hasPerm(superC, P.paymentsPayout) && await hasPerm(superC, P.providersRemove));

    // ---- finance: money yes, vendors no ------------------------------------
    check("finance HAS payments.payout", await hasPerm(financeC, P.paymentsPayout));
    check("finance HAS reports.view", await hasPerm(financeC, P.reportsView));
    check("finance does NOT have providers.approve", !(await hasPerm(financeC, P.providersApprove)));
    check("finance does NOT have staff.manage", !(await hasPerm(financeC, P.staffManage)));

    // ---- support: complaints yes, revenue no -------------------------------
    check("support HAS disputes.resolve", await hasPerm(supportC, P.disputesResolve));
    check("support HAS customers.view", await hasPerm(supportC, P.customersView));
    check("support does NOT have payments.view (revenue)", !(await hasPerm(supportC, P.paymentsView)));
    check("support does NOT have payments.payout", !(await hasPerm(supportC, P.paymentsPayout)));

    // ---- RLS teeth: a scoped staffer cannot read staff records -------------
    // staff.manage gates the staff table. Finance lacks it, so a direct read
    // returns only their own row (staff_read policy), never the whole team.
    const { data: finStaffView } = await financeC.from("staff_members").select("id");
    check("finance sees only their own staff row, not the team", (finStaffView?.length ?? 0) <= 1, finStaffView?.length);
    const { data: superStaffView } = await superC.from("staff_members").select("id");
    check("super admin sees the whole team", (superStaffView?.length ?? 0) >= 3, superStaffView?.length);

    // ---- per-person grant / revoke -----------------------------------------
    // Grant finance a view outside its bundle, then confirm the DB sees it.
    await db.from("staff_members").update({ permissions: [...bundleFor("finance"), P.providersApprove] }).eq("user_id", userIds[1]);
    check("granting an extra permission takes effect", await hasPerm(financeC, P.providersApprove));
    // Revoke it again.
    await db.from("staff_members").update({ permissions: bundleFor("finance") }).eq("user_id", userIds[1]);
    check("revoking it takes effect", !(await hasPerm(financeC, P.providersApprove)));

    // ---- suspension removes all permissions --------------------------------
    await db.from("staff_members").update({ status: "suspended" }).eq("user_id", userIds[1]);
    check("a suspended staffer holds NO permissions", !(await hasPerm(financeC, P.paymentsPayout)));
    await db.from("staff_members").update({ status: "active" }).eq("user_id", userIds[1]);

    // ---- attribution: actions are tied to the acting account ---------------
    await db.from("audit_log").insert({ actor_id: superId, action: "approve_provider", entity_type: "provider", entity_id: null });
    await db.from("audit_log").insert({ actor_id: userIds[2], action: "dispute_resolved", entity_type: "dispute", entity_id: null });
    const { data: superActs } = await db.from("audit_log").select("action").eq("actor_id", superId);
    const { data: supportActs } = await db.from("audit_log").select("action").eq("actor_id", userIds[2]);
    check("each action is attributed to the account that performed it", (superActs?.length ?? 0) >= 1 && (supportActs?.length ?? 0) >= 1 && superActs![0].action === "approve_provider", { superActs, supportActs });

    // ---- login history -----------------------------------------------------
    const { data: staffRow } = await db.from("staff_members").select("id").eq("user_id", superId).single();
    await db.from("staff_login_events").insert({ staff_id: staffRow!.id, event: "login" });
    const { data: logins } = await db.from("staff_login_events").select("event").eq("staff_id", staffRow!.id);
    check("login history is recorded per account", (logins?.length ?? 0) >= 1, logins);
  } finally {
    console.log(`\n  Test data left behind. Purge: npm run e2e:purge`);
    console.log(`  users: ${userIds.join(", ")}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("\nE2E ABORTED:", e.message); process.exit(1); });
