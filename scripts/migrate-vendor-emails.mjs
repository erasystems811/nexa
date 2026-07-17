// One-time migration: move existing vendor logins onto their own tagged email.
//
// WHY
// ---
// Nexa used to keep ONE login per email, so a vendor who had ever been a
// customer shared a single account. The per-app model makes each app an
// independent account keyed by (real email, app): the customer app stores the
// bare email, the vendor app stores `local+nexa-vendor@domain`.
//
// Every vendor account created BEFORE that change is still stored under the bare
// email. This script re-stamps each existing vendor's auth email to the tagged
// form, so the new vendor-app login finds it — and frees the bare email for a
// separate customer account. The auth user id never changes, so all of a
// vendor's data (listings, bookings, wallet, payouts — keyed by that id) is
// untouched.
//
// CUTOVER ORDER (important)
// -------------------------
// Deploy the new code FIRST, then run this. Running it before the new code is
// live would break vendor login, because the live code would still be looking up
// the bare email.
//
// USAGE
// -----
//   Dry run (prints what it WOULD do, changes nothing):
//     NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-vendor-emails.mjs
//   Apply for real:
//     ... node scripts/migrate-vendor-emails.mjs --apply
//
// Safe to run more than once: an account already on the tagged email is skipped.

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Same rule as src/modules/auth/identity.ts — kept in sync by hand (this is a one-off). */
function tagVendorEmail(email) {
  const at = email.lastIndexOf("@");
  if (at === -1) return email;
  return `${email.slice(0, at)}+nexa-vendor@${email.slice(at + 1)}`;
}

function isAlreadyTagged(email) {
  return /\+nexa-vendor@/i.test(email);
}

async function allProviderUserIds() {
  const ids = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("providers")
      .select("user_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading providers failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) if (row.user_id) ids.push(row.user_id);
    if (data.length < PAGE) break;
  }
  return [...new Set(ids)];
}

async function main() {
  console.log(APPLY ? "APPLYING vendor-email migration.\n" : "DRY RUN — nothing will change. Pass --apply to migrate.\n");

  const userIds = await allProviderUserIds();
  console.log(`Found ${userIds.length} vendor account(s).\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of userIds) {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error || !data?.user) {
      console.warn(`- ${id}: could not load auth user (${error?.message ?? "not found"}) — SKIPPED`);
      failed += 1;
      continue;
    }

    const current = data.user.email ?? "";
    if (!current) {
      console.warn(`- ${id}: no email on the auth user — SKIPPED`);
      skipped += 1;
      continue;
    }
    if (isAlreadyTagged(current)) {
      skipped += 1;
      continue;
    }

    const next = tagVendorEmail(current.toLowerCase());
    console.log(`- ${current}  ->  ${next}`);

    if (APPLY) {
      const { error: updateError } = await admin.auth.admin.updateUserById(id, {
        email: next,
        email_confirm: true,
      });
      if (updateError) {
        console.warn(`    FAILED: ${updateError.message}`);
        failed += 1;
        continue;
      }
    }
    migrated += 1;
  }

  console.log(
    `\nDone. ${APPLY ? "migrated" : "would migrate"} ${migrated}, skipped ${skipped}` +
      (failed ? `, failed ${failed}` : "") + ".",
  );
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
