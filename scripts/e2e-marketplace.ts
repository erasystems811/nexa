/**
 * End-to-end check for Search & Book. PRD Sections 07, 09, 10, 14.
 *
 *   npm run e2e:marketplace
 *
 * Drives one Fixed listing (on-site service, one code) and one Negotiable
 * listing (delivery + return, two codes and a caution fee) all the way from
 * search to a completed booking with both payment stages released.
 *
 * Creates its own city, categories, provider, listings and accounts, then
 * deletes all of it.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkout, confirmWithCode, recordStage1, rejectBooking } from "@/modules/bookings";
import { calculatePayout } from "@/modules/payments";
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

async function signedIn(email: string, password: string): Promise<SupabaseClient<Database>> {
  const c = createClient<Database>(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}

const NAIRA = (kobo: number) => kobo / 100;

async function main() {
  const s = Date.now();
  const pw = "NexaE2E!12345";
  const customerEmail = `e2e.mk.customer.${s}@gmail.com`;
  const providerEmail = `e2e.mk.provider.${s}@gmail.com`;

  const userIds: string[] = [];
  let cityId = "";
  const categoryIds: string[] = [];

  try {
    for (const email of [customerEmail, providerEmail]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: pw,
        email_confirm: true,
        user_metadata: { full_name: email.split("@")[0] },
      });
      if (error) throw new Error(error.message);
      userIds.push(data.user.id);
    }
    const [customerId, providerUserId] = userIds as [string, string];

    // ---- admin creates the taxonomy (no seeded categories exist, S01) -------
    const { data: city } = await admin
      .from("cities")
      .insert({ slug: `e2e-abuja-${s}`, name: "Abuja" })
      .select("id")
      .single();
    cityId = city!.id;

    const { data: djCat } = await admin
      .from("categories")
      .insert({
        slug: `e2e-dj-${s}`,
        name: "DJs",
        fulfillment_type: "onsite_service",
        requires_video_proof: true,
      })
      .select("id")
      .single();

    const { data: chairCat } = await admin
      .from("categories")
      .insert({
        slug: `e2e-chairs-${s}`,
        name: "Chairs & Tables",
        fulfillment_type: "delivery_return",
        delivery_mode: "rider",
      })
      .select("id")
      .single();
    categoryIds.push(djCat!.id, chairCat!.id);

    // ---- an approved provider with an agreement and a payout account -------
    const { data: provider } = await admin
      .from("providers")
      .insert({
        user_id: providerUserId,
        business_name: "E2E Events Co",
        slug: `e2e-events-${s}`,
        city_id: cityId,
        status: "pending",
        is_featured: true,
      })
      .select("id")
      .single();
    const providerId = provider!.id;

    await admin.from("providers").update({ status: "approved" }).eq("id", providerId);
    await admin.from("provider_agreements").insert({
      provider_id: providerId,
      deposit_percent: 30,
    });
    await admin
      .from("provider_wallets")
      .update({ bank_code: "058", bank_account_number: "0123456789" })
      .eq("provider_id", providerId);

    // ---- listings ---------------------------------------------------------
    const DJ_PRICE = 15_000_000; // ₦150,000
    const { data: djListing } = await admin
      .from("listings")
      .insert({
        provider_id: providerId,
        category_id: djCat!.id,
        title: "Headline DJ, 5 hours",
        slug: `e2e-dj-listing-${s}`,
        price_kobo: DJ_PRICE,
        price_type: "fixed",
        payment_type: "full",
        status: "approved",
      })
      .select("id, slug")
      .single();

    const CAUTION = 5_000_000; // ₦50,000
    const { data: chairListing } = await admin
      .from("listings")
      .insert({
        provider_id: providerId,
        category_id: chairCat!.id,
        title: "200 chairs and 20 tables",
        slug: `e2e-chairs-listing-${s}`,
        price_type: "negotiable",
        price_min_kobo: 8_000_000,
        price_max_kobo: 20_000_000,
        payment_type: "full",
        caution_fee_kobo: CAUTION,
        status: "approved",
      })
      .select("id, slug")
      .single();

    const customer = await signedIn(customerEmail, pw);
    const provider2 = await signedIn(providerEmail, pw);

    // ---- discovery (Section 07) -------------------------------------------
    const { data: publicListings } = await createClient<Database>(URL, ANON)
      .from("listings")
      .select("id, title")
      .eq("status", "approved");
    check(
      "an anonymous visitor can browse approved listings",
      (publicListings?.length ?? 0) >= 2,
      publicListings?.length,
    );

    await admin.from("listings").update({ status: "pending_approval" }).eq("id", djListing!.id);
    const { data: hidden } = await createClient<Database>(URL, ANON)
      .from("listings")
      .select("id")
      .eq("id", djListing!.id);
    check("an unapproved listing is invisible to the public", hidden?.length === 0, hidden);
    await admin.from("listings").update({ status: "approved" }).eq("id", djListing!.id);

    // =======================================================================
    // FIXED: on-site service. One code. Stage 1 is provider check-in.
    // =======================================================================
    const start = new Date(Date.now() + 7 * 864e5).toISOString();

    // The client does not get to name the price (0016).
    const { data: forged } = await customer
      .from("bookings")
      .insert({
        customer_id: customerId,
        provider_id: providerId,
        listing_id: djListing!.id,
        scheduled_start: start,
        agreed_price_kobo: 1,
        fulfillment_type: "delivery",
        commission_percent: 0,
        stage_1_release_percent: 99,
      })
      .select("id, agreed_price_kobo, fulfillment_type, commission_percent, stage_1_release_percent")
      .single();

    check("a forged agreed_price_kobo is overwritten from the listing", forged?.agreed_price_kobo === DJ_PRICE, forged);
    check("a forged fulfillment_type is overwritten from the category", forged?.fulfillment_type === "onsite_service", forged);
    check("a forged commission_percent is overwritten from settings", forged?.commission_percent === 10, forged);
    check("a forged stage_1_release_percent is overwritten from settings", forged?.stage_1_release_percent === 50, forged);
    await admin.from("bookings").delete().eq("id", forged!.id);

    const fixed = await checkout(
      { listingId: djListing!.id, scheduledStart: start, address: "Transcorp Hilton" },
      { id: customerId, email: customerEmail },
      customer,
    );
    check("fixed-price checkout creates a booking", !!fixed.bookingId);
    check("...with a human reference", /^NX-\d{6}$/.test(fixed.reference), fixed.reference);

    const { data: paid } = await admin
      .from("bookings")
      .select("status, agreed_price_kobo, delivery_fee_kobo, caution_fee_kobo")
      .eq("id", fixed.bookingId)
      .single();
    check("...status is paid_held", paid?.status === "paid_held", paid);
    check("...an on-site service carries no delivery fee", paid?.delivery_fee_kobo === 0, paid);
    check("...and no caution fee", paid?.caution_fee_kobo === 0, paid);

    const { data: payment } = await admin
      .from("payments")
      .select("held_kobo, released_kobo, commission_kobo, status")
      .eq("booking_id", fixed.bookingId)
      .single();
    check("...money is HELD, nothing released", payment?.held_kobo === DJ_PRICE && payment?.released_kobo === 0, payment);
    check("...commission recorded at 10%", payment?.commission_kobo === DJ_PRICE * 0.1, payment);

    // Section 14: the code exists the moment payment is made.
    const { data: custCodes } = await customer
      .from("booking_confirmation_codes")
      .select("stage, code")
      .eq("booking_id", fixed.bookingId);
    check("one confirmation code is minted on payment", custCodes?.length === 1, custCodes);
    check("...it is stage 2", custCodes?.[0]?.stage === 2, custCodes);

    const { data: provCodes } = await provider2
      .from("booking_confirmation_codes")
      .select("code")
      .eq("booking_id", fixed.bookingId);
    check("the PROVIDER cannot see the confirmation code", provCodes?.length === 0, provCodes);

    // Section 09: provider confirms a booking that is already paid.
    await admin.from("bookings").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", fixed.bookingId);

    // Stage 1: provider checks in. No code — the customer is not there to read one.
    await recordStage1(fixed.bookingId);

    const expected = calculatePayout({
      agreedPriceKobo: DJ_PRICE,
      commissionPercent: 10,
      stage1ReleasePercent: 50,
      latePenaltyPercentPer30Min: 0,
    });

    const { data: afterStage1 } = await admin
      .from("payments")
      .select("released_kobo, status, stage_1_released_at")
      .eq("booking_id", fixed.bookingId)
      .single();
    check(
      `stage 1 releases 50% of the provider's ₦${NAIRA(expected.providerGrossKobo)}`,
      afterStage1?.released_kobo === expected.stage1Kobo,
      { got: afterStage1?.released_kobo, want: expected.stage1Kobo },
    );
    check("...payment is partially_released", afterStage1?.status === "partially_released", afterStage1);

    const { data: bookingMid } = await admin.from("bookings").select("status").eq("id", fixed.bookingId).single();
    check("...booking is in_progress", bookingMid?.status === "in_progress", bookingMid);

    await expectThrow("stage 1 cannot be released twice", () => recordStage1(fixed.bookingId));

    // Stage 2: only the customer's code moves it. Never a tap.
    await expectThrow("a WRONG code does not complete the booking", () =>
      confirmWithCode(fixed.bookingId, "ZZZZZZ"),
    );

    const { data: stillOpen } = await admin.from("bookings").select("status").eq("id", fixed.bookingId).single();
    check("...the booking is untouched by a wrong code", stillOpen?.status === "in_progress", stillOpen);

    await confirmWithCode(fixed.bookingId, custCodes![0]!.code);

    const { data: done } = await admin
      .from("bookings")
      .select("status, completed_at, stage_2_at")
      .eq("id", fixed.bookingId)
      .single();
    check("the correct code completes the booking", done?.status === "completed", done);

    const { data: finalPayment } = await admin
      .from("payments")
      .select("released_kobo, status")
      .eq("booking_id", fixed.bookingId)
      .single();
    check(
      "stage 2 releases the remainder; provider paid in full less commission",
      finalPayment?.released_kobo === expected.providerGrossKobo,
      { got: finalPayment?.released_kobo, want: expected.providerGrossKobo },
    );
    check("...payment is fully released", finalPayment?.status === "released", finalPayment);

    await expectThrow("a used code cannot be replayed", () =>
      confirmWithCode(fixed.bookingId, custCodes![0]!.code),
    );

    const { data: ledger } = await admin
      .from("payment_ledger_entries")
      .select("kind, amount_kobo")
      .eq("booking_id", fixed.bookingId);
    const releases = (ledger ?? []).filter((l) => l.kind === "stage_release");
    check("the ledger holds exactly two stage releases", releases.length === 2, ledger);
    check(
      "...summing to the provider's gross",
      releases.reduce((a, b) => a + b.amount_kobo, 0) === expected.providerGrossKobo,
      releases,
    );

    // =======================================================================
    // NEGOTIABLE: delivery + return. Two codes, caution fee, delivery fee.
    // =======================================================================
    await expectThrow("a negotiable listing cannot be booked without an agreed price", () =>
      checkout({ listingId: chairListing!.id, scheduledStart: start }, { id: customerId, email: customerEmail }, customer),
    );

    const { data: conv } = await admin
      .from("conversations")
      .insert({ customer_id: customerId, provider_id: providerId, listing_id: chairListing!.id })
      .select("id")
      .single();

    // The customer cannot quote themselves a price.
    const selfOffer = await customer.from("price_offers").insert({
      conversation_id: conv!.id,
      listing_id: chairListing!.id,
      provider_id: providerId,
      customer_id: customerId,
      amount_kobo: 100,
    });
    check("a customer CANNOT create their own price offer", !!selfOffer.error, selfOffer.error?.message);

    const AGREED = 12_500_000; // ₦125,000
    const { data: offer, error: offerErr } = await provider2
      .from("price_offers")
      .insert({
        conversation_id: conv!.id,
        listing_id: chairListing!.id,
        provider_id: providerId,
        customer_id: customerId,
        amount_kobo: AGREED,
      })
      .select("id")
      .single();
    check("the provider can send a price offer", !offerErr && !!offer, offerErr?.message);

    await provider2.from("price_offers").update({ status: "accepted" }).eq("id", offer!.id);
    const { data: notAccepted } = await admin
      .from("price_offers")
      .select("status")
      .eq("id", offer!.id)
      .single();
    check("the PROVIDER cannot accept their own offer", notAccepted?.status === "pending", notAccepted);

    await customer.from("price_offers").update({ status: "accepted" }).eq("id", offer!.id);
    const { data: accepted } = await admin
      .from("price_offers")
      .select("status, accepted_at")
      .eq("id", offer!.id)
      .single();
    check("the customer can accept the offer", accepted?.status === "accepted", accepted);

    const chairStart = new Date(Date.now() + 8 * 864e5).toISOString();
    const negotiable = await checkout(
      { listingId: chairListing!.id, scheduledStart: chairStart, address: "Wuse II" },
      { id: customerId, email: customerEmail },
      customer,
    );

    const { data: chairBooking } = await admin
      .from("bookings")
      .select("agreed_price_kobo, delivery_fee_kobo, caution_fee_kobo, fulfillment_type, status")
      .eq("id", negotiable.bookingId)
      .single();
    check("the booking is created at the AGREED price, not the listing range", chairBooking?.agreed_price_kobo === AGREED, chairBooking);
    check("...a goods category carries the platform delivery fee", chairBooking?.delivery_fee_kobo === 150_000, chairBooking);
    check("...delivery+return collects the caution fee", chairBooking?.caution_fee_kobo === CAUTION, chairBooking);

    const { data: chairPayment } = await admin
      .from("payments")
      .select("held_kobo, caution_held_kobo")
      .eq("booking_id", negotiable.bookingId)
      .single();
    check("the caution fee is held APART from escrow", chairPayment?.caution_held_kobo === CAUTION && chairPayment?.held_kobo === AGREED, chairPayment);

    const { data: chairCodes } = await customer
      .from("booking_confirmation_codes")
      .select("stage, code")
      .eq("booking_id", negotiable.bookingId)
      .order("stage");
    check("delivery + return mints TWO codes", chairCodes?.length === 2, chairCodes);
    check("...one per stage", chairCodes?.[0]?.stage === 1 && chairCodes?.[1]?.stage === 2, chairCodes);
    check("...and they differ", chairCodes?.[0]?.code !== chairCodes?.[1]?.code, chairCodes);

    await admin.from("bookings").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", negotiable.bookingId);

    // Here stage 1 DOES need a code — the customer is present at drop-off.
    await expectThrow("delivery+return stage 1 refuses a wrong drop-off code", () =>
      recordStage1(negotiable.bookingId, { code: "ZZZZZZ" }),
    );
    await expectThrow("delivery+return stage 1 refuses NO code", () => recordStage1(negotiable.bookingId));

    await recordStage1(negotiable.bookingId, { code: chairCodes![0]!.code });
    const { data: chairMid } = await admin.from("bookings").select("status").eq("id", negotiable.bookingId).single();
    check("the drop-off code advances stage 1", chairMid?.status === "in_progress", chairMid);

    await expectThrow("the drop-off code cannot also complete the booking", () =>
      confirmWithCode(negotiable.bookingId, chairCodes![0]!.code),
    );

    await confirmWithCode(negotiable.bookingId, chairCodes![1]!.code);
    const { data: chairDone } = await admin.from("bookings").select("status").eq("id", negotiable.bookingId).single();
    check("the return code completes the booking", chairDone?.status === "completed", chairDone);

    // ---- double booking ----------------------------------------------------
    const clash = await customer.from("bookings").insert({
      customer_id: customerId,
      provider_id: providerId,
      listing_id: djListing!.id,
      scheduled_start: start,
      agreed_price_kobo: 0,
      fulfillment_type: "onsite_service",
      commission_percent: 0,
      stage_1_release_percent: 0,
    });
    // The fixed booking above is completed, so the slot is free again.
    check("a completed booking frees the slot", !clash.error, clash.error?.message);
    if (!clash.error) {
      const { data: live } = await admin.from("bookings").select("id").eq("listing_id", djListing!.id).eq("status", "pending").single();
      const dupe = await customer.from("bookings").insert({
        customer_id: customerId,
        provider_id: providerId,
        listing_id: djListing!.id,
        scheduled_start: start,
        agreed_price_kobo: 0,
        fulfillment_type: "onsite_service",
        commission_percent: 0,
        stage_1_release_percent: 0,
      });
      check("a second live booking on the same slot is refused", !!dupe.error, dupe.error?.message);
      await admin.from("bookings").delete().eq("id", live!.id);
    }

    // ---- rejection refunds automatically (Section 09) ----------------------
    const rejStart = new Date(Date.now() + 20 * 864e5).toISOString();
    const rej = await checkout(
      { listingId: djListing!.id, scheduledStart: rejStart },
      { id: customerId, email: customerEmail },
      customer,
    );
    await rejectBooking(rej.bookingId, "Double booked");
    const { data: rejected } = await admin.from("bookings").select("status").eq("id", rej.bookingId).single();
    check("a rejected booking lands in 'rejected'", rejected?.status === "rejected", rejected);
    const { data: refundLedger } = await admin
      .from("payment_ledger_entries")
      .select("kind, amount_kobo")
      .eq("booking_id", rej.bookingId)
      .eq("kind", "refund")
      .single();
    check("...and refunds the customer automatically", refundLedger?.amount_kobo === -DJ_PRICE, refundLedger);
  } finally {
    // This script cannot delete after itself, and that is the schema behaving
    // correctly rather than a gap. `payment_ledger_entries` refuses DELETE
    // (reject_ledger_mutation, 0008) because a financial ledger is history;
    // `bookings.customer_id` is ON DELETE RESTRICT for the same reason. Neither
    // the service role nor anything short of a superuser disabling triggers can
    // undo them.
    //
    // So: purge with `npm run e2e:purge`, which connects as postgres.
    console.log(`\n  Test data left behind (append-only ledger). Purge with:`);
    console.log(`    npm run e2e:purge`);
    console.log(`  users: ${userIds.join(", ")}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nE2E ABORTED:", e.message);
  process.exit(1);
});
