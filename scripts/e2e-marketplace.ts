/**
 * End-to-end check for the marketplace: discovery, booking, and the money.
 *
 *   npm run e2e:marketplace
 *
 * This is the script that guards the rules Nexa cannot afford to get wrong:
 *
 *   - the customer cannot name their own price;
 *   - money is HELD, not paid, when a booking is made;
 *   - the vendor's DEPOSIT — the percent Admin negotiated with them, not some
 *     platform-wide number — is released when they accept, and no earlier;
 *   - the balance moves only on the customer's completion code. Never on a tap,
 *     never on a wrong code, never twice.
 *
 * It creates its own city, category, vendor, listings and accounts.
 */

// An end-to-end test must never touch the live payment gateway.
process.env.PAYMENT_GATEWAY = "mock";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkout, acceptBooking, confirmWithCode, rejectBooking, startWork } from "@/modules/bookings";
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

const NAIRA = (kobo: number) => (kobo / 100).toLocaleString();

async function main() {
  const s = Date.now();
  const pw = "NexaE2E!12345";
  const customerEmail = `e2e.mk.customer.${s}@gmail.com`;
  const vendorEmail = `e2e.mk.vendor.${s}@gmail.com`;

  const userIds: string[] = [];

  try {
    for (const email of [customerEmail, vendorEmail]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: pw,
        email_confirm: true,
        user_metadata: { full_name: email.split("@")[0] },
      });
      if (error) throw new Error(error.message);
      userIds.push(data.user.id);
    }
    const [customerId, vendorUserId] = userIds as [string, string];

    const { data: city } = await admin
      .from("cities")
      .insert({ slug: `e2e-abuja-${s}`, name: "Abuja" })
      .select("id")
      .single();

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

    const { data: cateringCat } = await admin
      .from("categories")
      .insert({
        slug: `e2e-catering-${s}`,
        name: "Catering",
        fulfillment_type: "onsite_service",
      })
      .select("id")
      .single();

    // ---- an approved vendor, with a NEGOTIATED deposit and a payout account --
    // 30, deliberately not the platform default. If the code pays 50% anyway,
    // this script is the thing that catches it.
    const DEPOSIT_PERCENT = 30;

    const { data: vendor } = await admin
      .from("providers")
      .insert({
        user_id: vendorUserId,
        business_name: "E2E Events Co",
        slug: `e2e-events-${s}`,
        city_id: city!.id,
        status: "pending",
      })
      .select("id")
      .single();
    const vendorId = vendor!.id;

    await admin.from("providers").update({ status: "approved" }).eq("id", vendorId);
    await admin
      .from("provider_agreements")
      .insert({ provider_id: vendorId, deposit_percent: DEPOSIT_PERCENT });
    await admin
      .from("provider_wallets")
      .update({ bank_code: "058", bank_account_number: "0123456789" })
      .eq("provider_id", vendorId);

    // Approving a vendor should have given them a subscription automatically.
    const { data: sub } = await admin
      .from("provider_subscriptions")
      .select("status, amount_kobo")
      .eq("provider_id", vendorId)
      .maybeSingle();
    check("approving a vendor creates their subscription", !!sub, sub);

    // ---- listings -----------------------------------------------------------
    const DJ_PRICE = 15_000_000; // ₦150,000
    const { data: djListing } = await admin
      .from("listings")
      .insert({
        provider_id: vendorId,
        category_id: djCat!.id,
        title: "Headline DJ, 5 hours",
        slug: `e2e-dj-listing-${s}`,
        price_kobo: DJ_PRICE,
        price_type: "fixed",
        payment_type: "full",
        status: "approved",
      })
      .select("id")
      .single();

    const { data: cateringListing } = await admin
      .from("listings")
      .insert({
        provider_id: vendorId,
        category_id: cateringCat!.id,
        title: "Catering for 200 guests",
        slug: `e2e-catering-listing-${s}`,
        price_type: "negotiable",
        price_min_kobo: 8_000_000,
        price_max_kobo: 20_000_000,
        payment_type: "deposit",
        status: "approved",
      })
      .select("id")
      .single();

    const customer = await signedIn(customerEmail, pw);
    const vendorClient = await signedIn(vendorEmail, pw);
    const anon = createClient<Database>(URL, ANON);

    // ---- discovery ----------------------------------------------------------
    const { data: publicListings } = await anon
      .from("listings")
      .select("id")
      .in("id", [djListing!.id, cateringListing!.id]);
    check("a logged-out visitor can browse approved listings", publicListings?.length === 2, publicListings?.length);

    await admin.from("listings").update({ status: "pending_approval" }).eq("id", djListing!.id);
    const { data: hidden } = await anon.from("listings").select("id").eq("id", djListing!.id);
    check("an unapproved listing is invisible to the public", hidden?.length === 0, hidden);
    await admin.from("listings").update({ status: "approved" }).eq("id", djListing!.id);

    // ---- a lapsed vendor leaves the marketplace -----------------------------
    // This is the monthly fee's teeth. It is enforced in RLS, so no bug in the
    // app can put a non-paying vendor back in front of customers.
    for (const status of ["past_due", "cancelled"] as const) {
      await admin.from("provider_subscriptions").update({ status }).eq("provider_id", vendorId);
      const { data: gone } = await anon.from("listings").select("id").eq("id", djListing!.id);
      check(`a ${status} vendor's listings vanish from the marketplace`, gone?.length === 0, gone);
    }
    await admin.from("provider_subscriptions").update({ status: "active" }).eq("provider_id", vendorId);
    const { data: back } = await anon.from("listings").select("id").eq("id", djListing!.id);
    check("...and come back when they pay", back?.length === 1, back);

    // =======================================================================
    // FIXED PRICE. One code. Deposit on accept, balance on the code.
    // =======================================================================
    const start = new Date(Date.now() + 7 * 864e5).toISOString();

    // The client does not get to name its own terms.
    const { data: forged } = await customer
      .from("bookings")
      .insert({
        customer_id: customerId,
        provider_id: vendorId,
        listing_id: djListing!.id,
        scheduled_start: start,
        agreed_price_kobo: 1,
        fulfillment_type: "vendor_location_service",
        commission_percent: 0,
        stage_1_release_percent: 99,
      })
      .select("id, agreed_price_kobo, fulfillment_type, commission_percent, stage_1_release_percent")
      .single();

    check("a forged price is overwritten from the listing", forged?.agreed_price_kobo === DJ_PRICE, forged);
    check("a forged fulfillment_type is overwritten from the category", forged?.fulfillment_type === "onsite_service", forged);
    check("a forged commission is overwritten from settings", forged?.commission_percent === 10, forged);
    check(
      `the booking's deposit is the vendor's negotiated ${DEPOSIT_PERCENT}%, not a platform default`,
      Number(forged?.stage_1_release_percent) === DEPOSIT_PERCENT,
      { got: forged?.stage_1_release_percent, want: DEPOSIT_PERCENT },
    );
    await admin.from("bookings").delete().eq("id", forged!.id);

    const booking = await checkout(
      { listingId: djListing!.id, scheduledStart: start, address: "Transcorp Hilton" },
      { id: customerId, email: customerEmail },
      customer,
    );
    check("checkout creates a booking", !!booking.bookingId);
    check("...with a human reference", /^NX-\d{6}$/.test(booking.reference), booking.reference);

    const { data: held } = await admin
      .from("payments")
      .select("held_kobo, released_kobo, commission_kobo, status")
      .eq("booking_id", booking.bookingId)
      .single();
    check("money is HELD, nothing released yet", held?.held_kobo === DJ_PRICE && held?.released_kobo === 0, held);
    check("...commission is recorded at 10%", held?.commission_kobo === DJ_PRICE * 0.1, held);

    // ---- the code -----------------------------------------------------------
    const { data: codes } = await customer
      .from("booking_confirmation_codes")
      .select("stage, code")
      .eq("booking_id", booking.bookingId);
    check("exactly ONE code is minted (services have one checkpoint)", codes?.length === 1, codes);
    check("...it is the completion code", codes?.[0]?.stage === 2, codes);

    const { data: vendorCodes } = await vendorClient
      .from("booking_confirmation_codes")
      .select("code")
      .eq("booking_id", booking.bookingId);
    check("the VENDOR cannot see the customer's code", vendorCodes?.length === 0, vendorCodes);

    const expected = calculatePayout({
      agreedPriceKobo: DJ_PRICE,
      commissionPercent: 10,
      stage1ReleasePercent: DEPOSIT_PERCENT,
      latePenaltyPercentPer30Min: 0,
    });

    // ---- accepting releases the deposit, and only the deposit ---------------
    await acceptBooking(booking.bookingId);

    const { data: afterAccept } = await admin
      .from("payments")
      .select("released_kobo, status")
      .eq("booking_id", booking.bookingId)
      .single();
    check(
      `accepting releases the ${DEPOSIT_PERCENT}% deposit — ₦${NAIRA(expected.stage1Kobo)} of the vendor's ₦${NAIRA(expected.providerGrossKobo)}`,
      afterAccept?.released_kobo === expected.stage1Kobo,
      { got: afterAccept?.released_kobo, want: expected.stage1Kobo },
    );
    check("...and no more than the deposit", afterAccept?.released_kobo !== expected.providerGrossKobo, afterAccept);
    check("...the payment is partially released", afterAccept?.status === "partially_released", afterAccept);

    // A release is a real bank transfer out of Nexa's balance, so the money
    // leaves `pending` and lands in `withdrawn`. It has been PAID, not parked.
    const { data: wallet } = await admin
      .from("provider_wallets")
      .select("pending_kobo, withdrawn_kobo")
      .eq("provider_id", vendorId)
      .single();
    check(
      "...the deposit is actually paid out of the vendor's wallet",
      wallet?.withdrawn_kobo === expected.stage1Kobo,
      { got: wallet?.withdrawn_kobo, want: expected.stage1Kobo },
    );
    check(
      "...and the balance they have not earned yet stays pending",
      wallet?.pending_kobo === expected.providerGrossKobo - expected.stage1Kobo,
      { got: wallet?.pending_kobo, want: expected.providerGrossKobo - expected.stage1Kobo },
    );

    // Starting work is a courtesy signal. It must not move money.
    await startWork(booking.bookingId);
    const { data: afterStart } = await admin
      .from("payments")
      .select("released_kobo")
      .eq("booking_id", booking.bookingId)
      .single();
    check("marking work started moves NO money", afterStart?.released_kobo === expected.stage1Kobo, afterStart);

    // ---- only the customer's code releases the balance ----------------------
    await expectThrow("a WRONG code does not complete the booking", () =>
      confirmWithCode(booking.bookingId, "ZZZZZZ"),
    );
    const { data: stillOpen } = await admin
      .from("bookings")
      .select("status")
      .eq("id", booking.bookingId)
      .single();
    check("...the booking is untouched by a wrong code", stillOpen?.status === "in_progress", stillOpen);

    await confirmWithCode(booking.bookingId, codes![0]!.code);

    const { data: done } = await admin
      .from("bookings")
      .select("status")
      .eq("id", booking.bookingId)
      .single();
    check("the correct code completes the booking", done?.status === "completed", done);

    const { data: settled } = await admin
      .from("payments")
      .select("released_kobo, status")
      .eq("booking_id", booking.bookingId)
      .single();
    check(
      "...and releases the balance: vendor paid in full, less commission",
      settled?.released_kobo === expected.providerGrossKobo,
      { got: settled?.released_kobo, want: expected.providerGrossKobo },
    );
    check("...the payment is fully released", settled?.status === "released", settled);

    await expectThrow("a used code cannot be replayed", () =>
      confirmWithCode(booking.bookingId, codes![0]!.code),
    );

    const { data: ledger } = await admin
      .from("payment_ledger_entries")
      .select("kind, amount_kobo")
      .eq("booking_id", booking.bookingId);
    const releases = (ledger ?? []).filter((l) => l.kind === "stage_release");
    check("the ledger holds exactly two releases: deposit, then balance", releases.length === 2, ledger);
    check(
      "...summing to the vendor's gross",
      releases.reduce((a, b) => a + b.amount_kobo, 0) === expected.providerGrossKobo,
      releases,
    );
    // Commission has no ledger row because it never MOVES. It is simply what is
    // left in escrow after the vendor has been paid out in full — which is the
    // strongest possible guarantee that Nexa gets paid: it never has to collect.
    const { data: finalPayment } = await admin
      .from("payments")
      .select("held_kobo, released_kobo, commission_kobo")
      .eq("booking_id", booking.bookingId)
      .single();
    check(
      "Nexa's commission is what remains in escrow once the vendor is paid",
      (finalPayment?.held_kobo ?? 0) - (finalPayment?.released_kobo ?? 0) === finalPayment?.commission_kobo,
      finalPayment,
    );

    // =======================================================================
    // NEGOTIABLE. A price must be agreed in chat before there is a booking.
    // =======================================================================
    await expectThrow("a negotiable listing cannot be booked without an agreed price", () =>
      checkout(
        { listingId: cateringListing!.id, scheduledStart: start },
        { id: customerId, email: customerEmail },
        customer,
      ),
    );

    const { data: conv } = await admin
      .from("conversations")
      .insert({ customer_id: customerId, provider_id: vendorId, listing_id: cateringListing!.id })
      .select("id")
      .single();

    const selfOffer = await customer.from("price_offers").insert({
      conversation_id: conv!.id,
      listing_id: cateringListing!.id,
      provider_id: vendorId,
      customer_id: customerId,
      amount_kobo: 100,
    });
    check("a customer CANNOT quote themselves a price", !!selfOffer.error, selfOffer.error?.message);

    const AGREED = 12_500_000; // ₦125,000
    const { data: offer, error: offerErr } = await vendorClient
      .from("price_offers")
      .insert({
        conversation_id: conv!.id,
        listing_id: cateringListing!.id,
        provider_id: vendorId,
        customer_id: customerId,
        amount_kobo: AGREED,
      })
      .select("id")
      .single();
    check("the vendor can send a price offer", !offerErr && !!offer, offerErr?.message);

    await vendorClient.from("price_offers").update({ status: "accepted" }).eq("id", offer!.id);
    const { data: notAccepted } = await admin
      .from("price_offers")
      .select("status")
      .eq("id", offer!.id)
      .single();
    check("the VENDOR cannot accept their own offer", notAccepted?.status === "pending", notAccepted);

    await customer.from("price_offers").update({ status: "accepted" }).eq("id", offer!.id);

    const cateringStart = new Date(Date.now() + 8 * 864e5).toISOString();
    const negotiated = await checkout(
      { listingId: cateringListing!.id, scheduledStart: cateringStart, address: "Wuse II" },
      { id: customerId, email: customerEmail },
      customer,
    );

    const { data: negBooking } = await admin
      .from("bookings")
      .select("agreed_price_kobo, status")
      .eq("id", negotiated.bookingId)
      .single();
    check(
      "the booking is created at the AGREED price, not the listing range",
      negBooking?.agreed_price_kobo === AGREED,
      negBooking,
    );
    check("...and a deposit listing can now be booked at all", negBooking?.status === "paid_held", negBooking);

    // ---- declining refunds the customer, with nothing released --------------
    const rejStart = new Date(Date.now() + 20 * 864e5).toISOString();
    const rej = await checkout(
      { listingId: djListing!.id, scheduledStart: rejStart },
      { id: customerId, email: customerEmail },
      customer,
    );
    await rejectBooking(rej.bookingId, "Double booked");

    const { data: rejected } = await admin
      .from("bookings")
      .select("status")
      .eq("id", rej.bookingId)
      .single();
    check("a declined booking lands in 'rejected'", rejected?.status === "rejected", rejected);

    const { data: refundLedger } = await admin
      .from("payment_ledger_entries")
      .select("amount_kobo")
      .eq("booking_id", rej.bookingId)
      .eq("kind", "refund")
      .single();
    check(
      "...and the customer is refunded the WHOLE price automatically",
      refundLedger?.amount_kobo === -DJ_PRICE,
      refundLedger,
    );
  } finally {
    // This script cannot fully delete after itself, and that is the schema
    // behaving correctly rather than a gap. `payment_ledger_entries` refuses
    // DELETE because a financial ledger is history, and `bookings.customer_id`
    // is ON DELETE RESTRICT for the same reason.
    console.log(`\n  Test data left behind (the ledger is append-only). Purge with:`);
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
