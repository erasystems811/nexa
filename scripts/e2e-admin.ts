/**
 * End-to-end check for the Admin Console. PRD Section 12 (+ 05, 08, 10).
 *
 *   npm run e2e:admin     (then npm run e2e:purge)
 *
 * Drives the admin workflows that move money or change lifecycle state:
 * provider approval with terms, listing approval, the no-show ->
 * suspend -> appeal -> strike chain, a late penalty (30/70 split), a
 * subscription lifecycle, a flag -> strike conversion, and the dashboard totals.
 */

// An end-to-end test must never touch the live payment gateway.
process.env.PAYMENT_GATEWAY = "mock";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as admin from "@/modules/admin";
import { checkout, acceptBooking } from "@/modules/bookings";
import type { Database } from "@/lib/db/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
/** A logged-out customer browsing the marketplace. RLS is all that protects this. */
const anonClient = createClient<Database>(URL, ANON, { auth: { persistSession: false } });

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
const ledgerKinds = async (bookingId: string) => {
  const { data } = await db.from("payment_ledger_entries").select("kind, amount_kobo").eq("booking_id", bookingId);
  return data ?? [];
};

async function main() {
  const s = Date.now();
  const pw = "NexaE2E!12345";
  const adminEmail = `e2e.ad.admin.${s}@gmail.com`;
  const provEmail = `e2e.ad.prov.${s}@gmail.com`;
  const custEmail = `e2e.ad.cust.${s}@gmail.com`;
  const userIds: string[] = [];
  let cityId = "", chairCat = "";

  try {
    const mk = async (email: string, role?: "admin") => {
      const { data, error } = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: email.split("@")[0] } });
      if (error) throw new Error(error.message);
      userIds.push(data.user.id);
      if (role === "admin") await db.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
      return data.user.id;
    };
    const adminId = await mk(adminEmail, "admin");
    const provUser = await mk(provEmail);
    const custId = await mk(custEmail);

    const { data: city } = await db.from("cities").insert({ slug: `e2e-ab-${s}`, name: "Abuja" }).select("id").single();
    cityId = city!.id;
    const { data: cat } = await db.from("categories").insert({ slug: `e2e-cat-${s}`, name: "Catering", fulfillment_type: "onsite_service" }).select("id").single();
    chairCat = cat!.id;

    // A pending provider application.
    const { data: prov } = await db.from("providers").insert({ user_id: provUser, business_name: "E2E Rentals", slug: `e2e-rent-${s}`, city_id: cityId, status: "pending" }).select("id").single();
    const providerId = prov!.id;

    // ---- approve with terms (Section 05) ----------------------------------
    await admin.approveProvider(adminId, providerId, { depositPercent: 30, latePenaltyOverride: 2 });
    const { data: approved } = await db.from("providers").select("status").eq("id", providerId).single();
    const { data: agreement } = await db.from("provider_agreements").select("deposit_percent, late_penalty_percent_per_30min_override, is_active").eq("provider_id", providerId).single();
    check("approving a provider flips them to approved", approved?.status === "approved", approved);
    check("...records the deposit % and penalty override on the agreement", agreement?.deposit_percent === 30 && agreement?.late_penalty_percent_per_30min_override === 2, agreement);
    const { data: role } = await db.from("profiles").select("role").eq("id", provUser).single();
    check("...and promotes the profile to the provider role", role?.role === "provider", role);

    await db.from("provider_wallets").update({ bank_code: "058", bank_account_number: "0000000001" }).eq("provider_id", providerId);

    // ---- listing approval queue (Section 06, 12) --------------------------
    const { data: listing } = await db.from("listings").insert({ provider_id: providerId, category_id: chairCat, title: "Catering, 50 guests", slug: `e2e-cat-l-${s}`, price_kobo: 10_000_000, price_type: "fixed", payment_type: "full", status: "pending_approval" }).select("id").single();
    const queueBefore = await admin.listingQueue();
    check("a pending listing shows in the approval queue", queueBefore.some((l) => l.id === listing!.id), queueBefore.length);

    await admin.decideListing(adminId, listing!.id, "approved");
    const { data: liveListing } = await db.from("listings").select("status").eq("id", listing!.id).single();
    check("approving a listing publishes it", liveListing?.status === "approved", liveListing);

    // ---- a booking to operate on ------------------------------------------
    const customer = await signIn(custEmail, pw);
    const booking = await checkout({ listingId: listing!.id, scheduledStart: new Date(Date.now() + 5 * 864e5).toISOString() }, { id: custId, email: custEmail }, customer);
    await acceptBooking(booking.bookingId);

    // ---- late penalty: 2%/30min override, 30/70 split (Section 10) --------
    // 60 min late -> 2 increments x 2% = 4% of 10,000,000 = 400,000; 30% to customer.
    const pen = await admin.adminApplyPenalty(adminId, booking.bookingId, 60);
    check("late penalty uses the provider's override (4% of price)", pen.penaltyKobo === 400_000, pen);
    check("...split 30% to the customer", pen.customerShareKobo === 120_000, pen);
    check("...70% retained by Nexa", pen.platformShareKobo === 280_000, pen);
    const penLedger = (await ledgerKinds(booking.bookingId)).filter((l) => l.kind === "penalty");
    check("...recorded on the ledger against the provider and customer", penLedger.length === 2, penLedger);

    // ---- the monthly platform fee ------------------------------------------
    // Nexa's second revenue line. A vendor who stops paying stops being findable;
    // Admin can see who, and put them back.
    const { data: sub0 } = await db.from("provider_subscriptions").select("status").eq("provider_id", providerId).maybeSingle();
    check("an approved vendor gets a subscription automatically", !!sub0, sub0);

    await admin.setSubscriptionStatus(adminId, providerId, "past_due");
    const { data: gone } = await anonClient.from("listings").select("id").eq("id", listing!.id);
    check("marking a vendor past due removes them from the marketplace", gone?.length === 0, gone);

    await admin.markSubscriptionPaid(adminId, providerId);
    const { data: subPaid } = await db.from("provider_subscriptions").select("status, last_paid_at, current_period_end").eq("provider_id", providerId).single();
    check("recording a payment makes them active again", subPaid?.status === "active", subPaid);
    check("...and rolls their period forward", !!subPaid?.current_period_end && new Date(subPaid.current_period_end) > new Date(), subPaid);

    const { data: receipts } = await db.from("subscription_payments").select("amount_kobo").eq("provider_id", providerId);
    check("...and leaves a receipt", (receipts?.length ?? 0) === 1, receipts);

    const { data: visible } = await anonClient.from("listings").select("id").eq("id", listing!.id);
    check("...and the vendor is findable again", visible?.length === 1, visible);

    // ---- no-show -> suspend -> appeal -> strike (Section 05) --------------
    const booking2 = await checkout({ listingId: listing!.id, scheduledStart: new Date(Date.now() + 9 * 864e5).toISOString() }, { id: custId, email: custEmail }, customer);
    await acceptBooking(booking2.bookingId);
    await admin.recordNoShow(adminId, booking2.bookingId);

    const { data: suspended } = await db.from("providers").select("status").eq("id", providerId).single();
    check("a no-show suspends the provider pending appeal", suspended?.status === "suspended", suspended);
    const { data: b2 } = await db.from("bookings").select("status").eq("id", booking2.bookingId).single();
    check("...and cancels + refunds the booking", b2?.status === "cancelled", b2);
    const refund2 = (await ledgerKinds(booking2.bookingId)).find((l) => l.kind === "refund");
    check("...with a refund on the ledger", !!refund2, refund2);

    const { data: strike } = await db.from("provider_strikes").select("id").eq("provider_id", providerId).eq("reason", "no_show").single();

    // Appeal fails -> a strike is counted, but the provider is NOT auto-removed.
    await admin.resolveAppeal(adminId, strike!.id, false);
    const { data: afterFail } = await db.from("providers").select("status, strike_count").eq("id", providerId).single();
    check("a failed appeal records a strike", afterFail?.strike_count === 1, afterFail);
    check("...and never auto-removes the provider (manual decision, Section 05)", afterFail?.status !== "removed", afterFail);

    // Reinstate, then test an upheld appeal on a fresh no-show lifts suspension.
    await admin.setProviderSuspended(adminId, providerId, false);
    const booking3 = await checkout({ listingId: listing!.id, scheduledStart: new Date(Date.now() + 12 * 864e5).toISOString() }, { id: custId, email: custEmail }, customer);
    await acceptBooking(booking3.bookingId);
    await admin.recordNoShow(adminId, booking3.bookingId);
    const { data: strike3 } = await db.from("provider_strikes").select("id, created_at").eq("provider_id", providerId).eq("reason", "no_show").order("created_at", { ascending: false }).limit(1).single();
    await admin.resolveAppeal(adminId, strike3!.id, true);
    const { data: afterUpheld } = await db.from("providers").select("status, strike_count").eq("id", providerId).single();
    check("an upheld appeal lifts the suspension", afterUpheld?.status === "approved", afterUpheld);
    check("...and does not add a strike", afterUpheld?.strike_count === 1, afterUpheld);

    // ---- flag -> strike (Section 08) --------------------------------------
    const { data: conv } = await db.from("conversations").insert({ customer_id: custId, provider_id: providerId }).select("id").single();
    // A message from the provider that trips the scanner, then confirm + convert.
    await db.from("messages").insert({ conversation_id: conv!.id, sender_id: provUser, body: "just pay me on 08034567890" });
    const { data: flag } = await db.from("moderation_flags").select("id").eq("subject_id", provUser).limit(1).single();
    await admin.resolveFlag(adminId, flag!.id, "confirmed");
    await admin.convertFlagToStrike(adminId, flag!.id);
    const { data: afterFlagStrike } = await db.from("providers").select("strike_count").eq("id", providerId).single();
    check("converting a confirmed flag adds a strike to the provider (Section 08)", afterFlagStrike?.strike_count === 2, afterFlagStrike);
    const { data: linkedFlag } = await db.from("moderation_flags").select("resulted_in_strike, strike_id").eq("id", flag!.id).single();
    check("...and links the flag to the strike for traceability", linkedFlag?.resulted_in_strike === true && !!linkedFlag?.strike_id, linkedFlag);

    // ---- dashboard totals --------------------------------------------------
    const dash = await admin.adminDashboard();
    check("the dashboard counts the active provider", dash.providers >= 1, dash.providers);
    check("...and reports commission earned from released stages", dash.commissionKobo >= 0, dash.commissionKobo);

    // ---- reports -----------------------------------------------------------
    const rep = await admin.reports();
    check("reports run without error", Array.isArray(rep.topProviders), rep);
  } finally {
    console.log(`\n  Test data left behind (append-only ledger). Purge: npm run e2e:purge`);
    console.log(`  users: ${userIds.join(", ")}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("\nE2E ABORTED:", e.message); process.exit(1); });
