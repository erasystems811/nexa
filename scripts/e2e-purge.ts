/**
 * Removes leftover e2e-* test data. PRD Section 08/10 make the financial ledger
 * append-only and bookings ON DELETE RESTRICT, so the test scripts genuinely
 * cannot delete after themselves — that is the schema working, not a bug.
 *
 * This connects with the service role and issues deletes in FK order. It still
 * cannot remove payment_ledger_entries (the trigger refuses every role), so it
 * reports what it had to leave behind rather than pretending it is gone.
 *
 *   npm run e2e:purge
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: users } = await admin.auth.admin.listUsers();
  const testUsers = (users?.users ?? []).filter((u) => u.email?.startsWith("e2e."));

  for (const u of testUsers) {
    await admin.from("bookings").delete().eq("customer_id", u.id);
  }

  await admin.from("price_offers").delete().like("id", "%");
  await admin.from("listings").delete().like("slug", "e2e-%");
  await admin.from("providers").delete().like("slug", "e2e-%");
  await admin.from("categories").delete().like("slug", "e2e-%");
  await admin.from("cities").delete().like("slug", "e2e-%");

  for (const u of testUsers) {
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }

  console.log(`Removed ${testUsers.length} test users and their e2e-* rows.`);
  console.log(
    "payment_ledger_entries are append-only and were left in place. To wipe " +
      "them you need a superuser session that can disable the guard trigger.",
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
