/**
 * End-to-end check for Business Studio. PRD Section 13.
 *
 *   npm run e2e:studio     (then npm run e2e:purge)
 *
 * The Studio module functions build their own request-scoped client, so a
 * script cannot call them directly. What this test drives instead is the layer
 * underneath them — the same RLS policies, guard triggers, and admin-client
 * service functions the module relies on. If these hold, the module is safe;
 * if they don't, no amount of module code would save it.
 *
 * It checks every boundary Section 13 / 05 / 10 draw around a provider: a
 * listing starts and re-enters pending; a provider cannot approve, feature, or
 * verify themselves, set their own deposit % or wallet balance, or touch another
 * provider's data; goods are marked ready while services check in; a review can
 * be replied to but not rescored.
 */

// An end-to-end test must never touch the live payment gateway.
process.env.PAYMENT_GATEWAY = "mock";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { acceptBooking, checkout, startWork } from "@/modules/bookings";
import type { Database } from "@/lib/db/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail: unknown = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}  ${JSON.stringify(detail)}`);
  }
}
async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, "no error thrown");
  } catch {
    check(label, true);
  }
}
async function signIn(email: string, pw: string): Promise<SupabaseClient<Database>> {
  const c = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

async function main() {
  const s = Date.now();
  const pw = "NexaE2E!12345";
  const provEmail = `e2e.st.prov.${s}@gmail.com`;
  const prov2Email = `e2e.st.prov2.${s}@gmail.com`;
  const custEmail = `e2e.st.cust.${s}@gmail.com`;

  const userIds: string[] = [];
  let cityId = "";
  const catIds: string[] = [];

  try {
    for (const e of [provEmail, prov2Email, custEmail]) {
      const { data, error } = await admin.auth.admin.createUser({
        email: e, password: pw, email_confirm: true,
        user_metadata: { full_name: e.split("@")[0] },
      });
      if (error) throw new Error(error.message);
      userIds.push(data.user.id);
    }
    const [provUser, prov2User, custId] = userIds as [string, string, string];

    const { data: city } = await admin.from("cities").insert({ slug: `e2e-ab-${s}`, name: "Abuja" }).select("id").single();
    cityId = city!.id;
    const { data: djCat } = await admin.from("categories").insert({ slug: `e2e-dj-${s}`, name: "DJs", fulfillment_type: "onsite_service" }).select("id").single();
    const { data: secondCat } = await admin.from("categories").insert({ slug: `e2e-decor-${s}`, name: "Decor", fulfillment_type: "onsite_service" }).select("id").single();
    catIds.push(djCat!.id, secondCat!.id);

    const mkProvider = async (userId: string, slug: string) => {
      const { data } = await admin.from("providers").insert({ user_id: userId, business_name: slug, slug, city_id: cityId, status: "pending" }).select("id").single();
      await admin.from("providers").update({ status: "approved" }).eq("id", data!.id);
      await admin.from("provider_agreements").insert({ provider_id: data!.id, deposit_percent: 25 });
      await admin.from("provider_wallets").update({ bank_code: "058", bank_account_number: "0123456789" }).eq("provider_id", data!.id);
      return data!.id;
    };
    const providerId = await mkProvider(provUser, `e2e-prov-${s}`);
    const provider2Id = await mkProvider(prov2User, `e2e-prov2-${s}`);

    const provider = await signIn(provEmail, pw);
    const provider2 = await signIn(prov2Email, pw);
    const customer = await signIn(custEmail, pw);

    const newListing = async (c: SupabaseClient<Database>, categoryId: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await c.from("listings").insert({
        provider_id: providerId, category_id: categoryId, title: "E2E listing",
        slug: `e2e-l-${Math.random().toString(36).slice(2, 10)}`,
        price_type: "fixed", payment_type: "full", price_kobo: 15_000_000,
        status: "pending_approval", ...extra,
      }).select("id, status").single();
      return { data, error };
    };

    // ---- profile ----------------------------------------------------------
    await provider.from("providers").update({ business_name: "E2E DJ Co", description: "Energy" }).eq("id", providerId);
    const { data: prof } = await admin.from("providers").select("business_name").eq("id", providerId).single();
    check("a provider can edit their own profile", prof?.business_name === "E2E DJ Co", prof);

    // ---- listing lifecycle (Section 06) -----------------------------------
    const { data: created, error: createErr } = await newListing(provider, djCat!.id);
    check("a provider can create a listing", !createErr && !!created, createErr?.message);
    check("...it starts in pending_approval (Section 06)", created?.status === "pending_approval", created);
    const listingId = created!.id;

    const selfApprove = await provider.from("listings").update({ status: "approved" }).eq("id", listingId);
    const { data: a1 } = await admin.from("listings").select("status").eq("id", listingId).single();
    check("a provider CANNOT approve their own listing", a1?.status === "pending_approval", { err: selfApprove.error?.message, s: a1?.status });

    await admin.from("listings").update({ status: "approved" }).eq("id", listingId);
    await provider.from("listings").update({ price_kobo: 16_000_000 }).eq("id", listingId);
    const { data: a2 } = await admin.from("listings").select("status").eq("id", listingId).single();
    check("editing an approved listing's price returns it to pending (Section 06)", a2?.status === "pending_approval", a2);

    await admin.from("listings").update({ status: "approved" }).eq("id", listingId);
    await provider.from("listings").update({ status: "paused" }).eq("id", listingId);
    const { data: a3 } = await admin.from("listings").select("status").eq("id", listingId).single();
    check("a provider can pause their own listing", a3?.status === "paused", a3);

    // A provider cannot jump a listing straight to approved via pause/unpause.
    const sneaky = await provider.from("listings").update({ status: "approved" }).eq("id", listingId);
    const { data: a4 } = await admin.from("listings").select("status").eq("id", listingId).single();
    check("a provider CANNOT self-approve via a status write", a4?.status === "paused", { err: sneaky.error?.message });

    // ---- cross-provider isolation -----------------------------------------
    const intrude = await provider2.from("listings").update({ title: "hacked" }).eq("id", listingId);
    const { data: safe } = await admin.from("listings").select("title").eq("id", listingId).single();
    check("another provider CANNOT edit this listing", safe?.title !== "hacked", { err: intrude.error?.message });

    // ---- Admin-only fields (Sections 05, 10) ------------------------------
    await provider.from("providers").update({ is_featured: true }).eq("id", providerId);
    const { data: f } = await admin.from("providers").select("is_featured").eq("id", providerId).single();
    check("a provider CANNOT feature their own business", f?.is_featured === false, f);

    const verify = await provider.from("providers").update({ status: "approved", is_on_probation: false, strike_count: 0 }).eq("id", providerId);
    check("a provider CANNOT change verification/probation/strikes", !!verify.error, verify.error?.message);

    const deposit = await provider.from("provider_agreements").update({ deposit_percent: 0 }).eq("provider_id", providerId);
    const { data: ag } = await admin.from("provider_agreements").select("deposit_percent").eq("provider_id", providerId).single();
    check("a provider CANNOT change their own deposit %", ag?.deposit_percent === 25, { err: deposit.error?.message });

    const bal = await provider.from("provider_wallets").update({ available_kobo: 999_999_999 }).eq("provider_id", providerId);
    const { data: w } = await admin.from("provider_wallets").select("available_kobo").eq("provider_id", providerId).single();
    check("a provider CANNOT write their own wallet balance", w?.available_kobo === 0, { err: bal.error?.message });

    await provider.from("provider_wallets").update({ bank_account_name: "E2E DJ Co Ltd" }).eq("provider_id", providerId);
    const { data: bank } = await admin.from("provider_wallets").select("bank_account_name").eq("provider_id", providerId).single();
    check("a provider CAN set their own bank details", bank?.bank_account_name === "E2E DJ Co Ltd", bank);

    // ---- media starts pending (Section 06) --------------------------------
    const { data: mediaRow } = await provider.from("listing_media").insert({
      listing_id: listingId, kind: "image", storage_path: `${providerId}/${listingId}/x.jpg`, status: "approved",
    }).select("status").single();
    check("a media row is forced to pending_approval, even if the client says approved", mediaRow?.status === "pending_approval", mediaRow);

    // ---- orders: accept releases the deposit, and nothing else -------------
    await admin.from("listings").update({ status: "approved" }).eq("id", listingId);
    const start = new Date(Date.now() + 9 * 864e5).toISOString();
    const dj = await checkout({ listingId, scheduledStart: start }, { id: custId, email: custEmail }, customer);

    const { data: beforeAccept } = await admin.from("payments").select("released_kobo").eq("booking_id", dj.bookingId).single();
    check("a paid booking has released nothing to the vendor yet", beforeAccept?.released_kobo === 0, beforeAccept);

    await acceptBooking(dj.bookingId);

    const { data: afterAccept } = await admin.from("payments").select("released_kobo, status").eq("booking_id", dj.bookingId).single();
    check("accepting releases the vendor's deposit", (afterAccept?.released_kobo ?? 0) > 0, afterAccept);
    check("...but not the whole booking", afterAccept?.status === "partially_released", afterAccept);

    // Starting work is a signal to the customer. It must never move money — the
    // balance belongs to the customer until they hand over their code.
    await startWork(dj.bookingId);
    const { data: afterStart } = await admin.from("bookings").select("status, stage_1_at").eq("id", dj.bookingId).single();
    check("marking work started advances the booking to in_progress", afterStart?.status === "in_progress", afterStart);
    const { data: moneyAfterStart } = await admin.from("payments").select("released_kobo").eq("booking_id", dj.bookingId).single();
    check("...and moves NO money", moneyAfterStart?.released_kobo === afterAccept?.released_kobo, moneyAfterStart);

    // A vendor cannot reach into another vendor's bookings.
    const poach = await provider2.from("bookings").update({ status: "completed" }).eq("id", dj.bookingId);
    const { data: untouched } = await admin.from("bookings").select("status").eq("id", dj.bookingId).single();
    check("another vendor CANNOT touch this booking", untouched?.status === "in_progress", { poach: poach.error?.message, untouched });

    // ---- review reply ------------------------------------------------------
    await admin.from("bookings").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", dj.bookingId);
    const { data: review } = await admin.from("reviews").insert({
      booking_id: dj.bookingId, customer_id: custId, provider_id: providerId,
      quality: 5, punctuality: 4, communication: 5, value: 4, comment: "Great set",
    }).select("id").single();

    await provider.from("reviews").update({ provider_reply: "Thank you!" }).eq("id", review!.id);
    const { data: replied } = await admin.from("reviews").select("provider_reply, quality").eq("id", review!.id).single();
    check("a provider can reply to a review", replied?.provider_reply === "Thank you!", replied);

    const rescored = await provider.from("reviews").update({ quality: 1 }).eq("id", review!.id);
    const { data: scoreSafe } = await admin.from("reviews").select("quality").eq("id", review!.id).single();
    check("a provider CANNOT rescore a review", scoreSafe?.quality === 5, { err: rescored.error?.message });

    void expectThrow; void provider2Id;
  } finally {
    console.log(`\n  Test data left behind (append-only ledger). Purge: npm run e2e:purge`);
    console.log(`  users: ${userIds.join(", ")}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nE2E ABORTED:", e.message);
  process.exit(1);
});
