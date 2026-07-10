/**
 * End-to-end check for the Rider App. PRD Section 15, payment stages Section 10.
 *
 *   npm run e2e:rider     (then npm run e2e:purge)
 *
 * Runs a full plain-Delivery job and a full Delivery+Return job (two legs, two
 * codes, caution fee) through the real module, the real RLS, and the real
 * payment releases, checking who gets paid what at each checkpoint.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkout, acceptBooking } from "@/modules/bookings";
import {
  acceptAssignment,
  callRider,
  confirmDelivery,
  confirmReturn,
  markArrived,
  markEnRoute,
  markPickedUp,
  registerRider,
} from "@/modules/rider";
import type { Database } from "@/lib/db/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0, failed = 0;
function check(label: string, ok: boolean, detail: unknown = "") {
  if (ok) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}  ${JSON.stringify(detail)}`); }
}
async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false, "no throw"); } catch { check(label, true); }
}
async function signIn(email: string, pw: string): Promise<SupabaseClient<Database>> {
  const c = createClient<Database>(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}
const riderPaidFor = async (bookingId: string) => {
  const { data } = await admin.from("payment_ledger_entries").select("amount_kobo").eq("booking_id", bookingId).eq("kind", "rider_payout");
  return (data ?? []).reduce((a, b) => a + b.amount_kobo, 0);
};
const providerReleased = async (bookingId: string) => {
  const { data } = await admin.from("payments").select("released_kobo, status").eq("booking_id", bookingId).single();
  return data;
};

async function main() {
  const s = Date.now();
  const pw = "NexaE2E!12345";
  const emails = {
    rider: `e2e.rd.rider.${s}@gmail.com`,
    rider2: `e2e.rd.rider2.${s}@gmail.com`,
    prov: `e2e.rd.prov.${s}@gmail.com`,
    cust: `e2e.rd.cust.${s}@gmail.com`,
  };
  const userIds: string[] = [];
  let cityId = "";
  const catIds: string[] = [];

  try {
    const mk = async (email: string) => {
      const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: email.split("@")[0] } });
      if (error) throw new Error(error.message);
      userIds.push(data.user.id);
      return data.user.id;
    };
    const riderUser = await mk(emails.rider);
    const rider2User = await mk(emails.rider2);
    const provUser = await mk(emails.prov);
    const custId = await mk(emails.cust);

    const { data: city } = await admin.from("cities").insert({ slug: `e2e-ab-${s}`, name: "Abuja" }).select("id").single();
    cityId = city!.id;
    const { data: cakeCat } = await admin.from("categories").insert({ slug: `e2e-cake-${s}`, name: "Cakes", fulfillment_type: "delivery", delivery_mode: "rider" }).select("id").single();
    const { data: chairCat } = await admin.from("categories").insert({ slug: `e2e-chair-${s}`, name: "Chairs", fulfillment_type: "delivery_return", delivery_mode: "rider" }).select("id").single();
    catIds.push(cakeCat!.id, chairCat!.id);

    // provider + wallet + agreement
    const { data: prov } = await admin.from("providers").insert({ user_id: provUser, business_name: "E2E Bakery", slug: `e2e-bake-${s}`, city_id: cityId, address: "Provider St", status: "pending" }).select("id").single();
    const providerId = prov!.id;
    await admin.from("providers").update({ status: "approved" }).eq("id", providerId);
    await admin.from("provider_agreements").insert({ provider_id: providerId, deposit_percent: 25 });
    await admin.from("provider_wallets").update({ bank_code: "058", bank_account_number: "0000000001" }).eq("provider_id", providerId);

    // ---- registration (Section 15) ----------------------------------------
    const riderClient = await signIn(emails.rider, pw);
    const riderId = await registerRiderAs(riderClient, riderUser, "E2E Rider", "08030001111", "car", cityId);
    const { data: pendingRider } = await admin.from("riders").select("status").eq("id", riderId).single();
    check("a new rider starts in pending verification (Section 15)", pendingRider?.status === "pending", pendingRider);

    // A pending rider cannot self-approve.
    const selfApprove = await riderClient.from("riders").update({ status: "approved" }).eq("id", riderId);
    const { data: stillPending } = await admin.from("riders").select("status").eq("id", riderId).single();
    check("a rider CANNOT approve themselves", stillPending?.status === "pending", { err: selfApprove.error?.message });

    // Admin approves; role syncs to rider.
    await admin.from("riders").update({ status: "approved" }).eq("id", riderId);
    await admin.from("rider_wallets").update({ bank_code: "058", bank_account_number: "1111111111" }).eq("rider_id", riderId);
    const { data: rProfile } = await admin.from("profiles").select("role").eq("id", riderUser).single();
    check("approving a rider promotes their profile to role=rider", rProfile?.role === "rider", rProfile);

    // second approved rider (for the return leg / team), a van
    const rider2Client = await signIn(emails.rider2, pw);
    const rider2Id = await registerRiderAs(rider2Client, rider2User, "E2E Rider 2", "08030002222", "van", cityId);
    await admin.from("riders").update({ status: "approved" }).eq("id", rider2Id);
    await admin.from("rider_wallets").update({ bank_code: "058", bank_account_number: "2222222222" }).eq("rider_id", rider2Id);

    // listings
    const CAKE = 5_000_000; // ₦50,000
    const { data: cakeListing } = await admin.from("listings").insert({ provider_id: providerId, category_id: cakeCat!.id, title: "Birthday cake", slug: `e2e-cake-l-${s}`, price_kobo: CAKE, price_type: "fixed", payment_type: "full", status: "approved" }).select("id").single();
    const { data: chairListing } = await admin.from("listings").insert({ provider_id: providerId, category_id: chairCat!.id, title: "100 chairs", slug: `e2e-chair-l-${s}`, price_kobo: 8_000_000, price_type: "fixed", payment_type: "full", caution_fee_kobo: 3_000_000, status: "approved" }).select("id").single();

    const customer = await signIn(emails.cust, pw);

    // =======================================================================
    // PLAIN DELIVERY: stage 1 on pickup, stage 2 + full rider fee on the code.
    // =======================================================================
    const cake = await checkout({ listingId: cakeListing!.id, scheduledStart: new Date(Date.now() + 3 * 864e5).toISOString(), address: "10 Customer Rd" }, { id: custId, email: emails.cust }, customer);
    await acceptBooking(cake.bookingId);

    const { data: cakePay } = await admin.from("payments").select("delivery_fee_kobo").eq("booking_id", cake.bookingId).single();
    const DFEE = cakePay!.delivery_fee_kobo;
    check("a delivery booking carries the platform delivery fee", DFEE === 150_000, cakePay);

    // A provider from another business cannot call a rider for this booking.
    await expectThrow("only the owning provider can call a rider", () =>
      callRider("00000000-0000-0000-0000-000000000000", cake.bookingId, "car"));

    // The provider presses "Call a car" (0023). rider1 is the car; rider2 a van.
    await callRider(providerId, cake.bookingId, "car");
    const { data: cakeAssign } = await admin.from("rider_assignments").select("id, rider_id, leg, fee_share_kobo, status").eq("booking_id", cake.bookingId).maybeSingle();
    check("calling a car creates a rider assignment (0023)", !!cakeAssign, cakeAssign);
    check("...to the CAR rider, leg 1, status assigned", cakeAssign?.rider_id === riderId && cakeAssign?.status === "assigned" && cakeAssign?.leg === 1, cakeAssign);
    check("...with the full delivery fee as the rider's share", cakeAssign?.fee_share_kobo === DFEE, cakeAssign);

    const cakeAssignId = cakeAssign!.id;
    const cakeRider = cakeAssign!.rider_id;

    // Calling again while a rider is on it is refused.
    await expectThrow("a second call is refused while a rider is on the delivery", () =>
      callRider(providerId, cake.bookingId, "van"));

    // Another rider cannot act on this assignment.
    await expectThrow("a rider CANNOT accept another rider's assignment", () =>
      acceptAssignment(cakeRider === riderId ? rider2Id : riderId, cakeAssignId));

    await acceptAssignment(cakeRider, cakeAssignId);

    // Pickup from provider = stage 1 for plain delivery.
    await markPickedUp(cakeRider, cakeAssignId);
    const afterPickup = await providerReleased(cake.bookingId);
    check("pickup releases the provider's stage-1 payout (delivery)", (afterPickup?.released_kobo ?? 0) > 0 && afterPickup?.status === "partially_released", afterPickup);
    check("...but the rider is NOT paid yet", (await riderPaidFor(cake.bookingId)) === 0);

    await markEnRoute(cakeRider, cakeAssignId);
    await markArrived(cakeRider, cakeAssignId);

    // The code. A rider never has it; fetch it as the customer would read it out.
    const { data: cakeCode } = await admin.from("booking_confirmation_codes").select("code").eq("booking_id", cake.bookingId).eq("stage", 2).single();

    await expectThrow("a wrong delivery code does not complete the job", () =>
      confirmDelivery(cakeRider, cakeAssignId, "ZZZZZZ"));
    const stillOpen = await providerReleased(cake.bookingId);
    check("...and releases nothing further", stillOpen?.status === "partially_released", stillOpen);

    await confirmDelivery(cakeRider, cakeAssignId, cakeCode!.code);
    const cakeDone = await providerReleased(cake.bookingId);
    check("the correct code releases provider stage 2 and completes payment", cakeDone?.status === "released", cakeDone);
    check("...and pays the rider the FULL delivery fee (delivery-only)", (await riderPaidFor(cake.bookingId)) === DFEE, { paid: await riderPaidFor(cake.bookingId), fee: DFEE });

    const { data: cakeBooking } = await admin.from("bookings").select("status").eq("id", cake.bookingId).single();
    check("...and completes the booking", cakeBooking?.status === "completed", cakeBooking);

    const { data: rel } = await admin.from("rider_reliability").select("completed_deliveries").eq("rider_id", cakeRider).single();
    check("the rider's completed-delivery count goes up", rel?.completed_deliveries === 1, rel);

    // =======================================================================
    // DELIVERY + RETURN: half on drop-off (stage 1), half + caution on return.
    // =======================================================================
    const chair = await checkout({ listingId: chairListing!.id, scheduledStart: new Date(Date.now() + 4 * 864e5).toISOString(), address: "22 Party Ave" }, { id: custId, email: emails.cust }, customer);
    await acceptBooking(chair.bookingId);
    const { data: chairPay } = await admin.from("payments").select("caution_held_kobo, delivery_fee_kobo").eq("booking_id", chair.bookingId).single();
    check("delivery+return holds the caution fee apart", chairPay?.caution_held_kobo === 3_000_000, chairPay);

    await callRider(providerId, chair.bookingId, "car");
    const { data: outbound } = await admin.from("rider_assignments").select("id, rider_id, fee_share_kobo, leg").eq("booking_id", chair.bookingId).eq("leg", 1).single();
    check("the outbound rider share is HALF the fee (delivery+return)", outbound?.fee_share_kobo === Math.round(chairPay!.delivery_fee_kobo / 2), outbound);

    const rId = outbound!.rider_id;
    await acceptAssignment(rId, outbound!.id);
    await markPickedUp(rId, outbound!.id);              // from provider, no payout
    check("picking up from the provider pays nothing on delivery+return", (await riderPaidFor(chair.bookingId)) === 0);
    await markEnRoute(rId, outbound!.id);
    await markArrived(rId, outbound!.id);

    const { data: code1 } = await admin.from("booking_confirmation_codes").select("code").eq("booking_id", chair.bookingId).eq("stage", 1).single();
    await confirmDelivery(rId, outbound!.id, code1!.code);   // drop-off = stage 1

    const afterDrop = await providerReleased(chair.bookingId);
    check("the drop-off code releases provider stage 1", afterDrop?.status === "partially_released", afterDrop);
    check("...and pays the rider HALF the fee", (await riderPaidFor(chair.bookingId)) === outbound!.fee_share_kobo, { paid: await riderPaidFor(chair.bookingId) });

    // The return leg is now auto-created.
    const { data: returnLeg } = await admin.from("rider_assignments").select("id, rider_id, fee_share_kobo, leg, status").eq("booking_id", chair.bookingId).eq("leg", 2).maybeSingle();
    check("a return leg is created after drop-off (Section 15)", !!returnLeg && returnLeg.leg === 2, returnLeg);
    check("...with the remaining half of the fee", returnLeg?.fee_share_kobo === chairPay!.delivery_fee_kobo - outbound!.fee_share_kobo, returnLeg);

    const retRider = returnLeg!.rider_id;
    await acceptAssignment(retRider, returnLeg!.id);
    await markPickedUp(retRider, returnLeg!.id, "All items returned clean and intact");
    await markEnRoute(retRider, returnLeg!.id);
    await markArrived(retRider, returnLeg!.id);

    const { data: code2 } = await admin.from("booking_confirmation_codes").select("code").eq("booking_id", chair.bookingId).eq("stage", 2).single();
    await confirmReturn(retRider, returnLeg!.id, code2!.code, false); // good condition

    const chairDone = await providerReleased(chair.bookingId);
    check("the return code releases provider stage 2 and completes payment", chairDone?.status === "released", chairDone);
    check("...the rider is paid the full fee across both legs", (await riderPaidFor(chair.bookingId)) === chairPay!.delivery_fee_kobo, { paid: await riderPaidFor(chair.bookingId), fee: chairPay!.delivery_fee_kobo });

    const { data: cautionRefund } = await admin.from("payment_ledger_entries").select("amount_kobo").eq("booking_id", chair.bookingId).eq("kind", "caution_refund").maybeSingle();
    check("good condition refunds the caution fee to the customer", cautionRefund?.amount_kobo === -3_000_000, cautionRefund);

    const { data: chairBooking } = await admin.from("bookings").select("status").eq("id", chair.bookingId).single();
    check("...and completes the booking", chairBooking?.status === "completed", chairBooking);

    // ---- damage path: a dispute, not an auto-deduction (Section 10) --------
    const chair2 = await checkout({ listingId: chairListing!.id, scheduledStart: new Date(Date.now() + 6 * 864e5).toISOString() }, { id: custId, email: emails.cust }, customer);
    await acceptBooking(chair2.bookingId);
    await callRider(providerId, chair2.bookingId, "car");
    const { data: ob2 } = await admin.from("rider_assignments").select("id, rider_id").eq("booking_id", chair2.bookingId).eq("leg", 1).single();
    await acceptAssignment(ob2!.rider_id, ob2!.id);
    await markPickedUp(ob2!.rider_id, ob2!.id);
    await markEnRoute(ob2!.rider_id, ob2!.id);
    await markArrived(ob2!.rider_id, ob2!.id);
    const { data: c2code1 } = await admin.from("booking_confirmation_codes").select("code").eq("booking_id", chair2.bookingId).eq("stage", 1).single();
    await confirmDelivery(ob2!.rider_id, ob2!.id, c2code1!.code);
    const { data: rl2 } = await admin.from("rider_assignments").select("id, rider_id").eq("booking_id", chair2.bookingId).eq("leg", 2).single();
    await acceptAssignment(rl2!.rider_id, rl2!.id);
    await markPickedUp(rl2!.rider_id, rl2!.id, "Two chairs cracked");
    await markEnRoute(rl2!.rider_id, rl2!.id);
    await markArrived(rl2!.rider_id, rl2!.id);
    const { data: c2code2 } = await admin.from("booking_confirmation_codes").select("code").eq("booking_id", chair2.bookingId).eq("stage", 2).single();
    await confirmReturn(rl2!.rider_id, rl2!.id, c2code2!.code, true); // damaged

    const { data: refundAttempt } = await admin.from("payment_ledger_entries").select("id").eq("booking_id", chair2.bookingId).eq("kind", "caution_refund").maybeSingle();
    check("damage does NOT auto-refund the caution fee", !refundAttempt, refundAttempt);
    const { data: dispute } = await admin.from("disputes").select("is_damage_claim, caution_claim_kobo").eq("booking_id", chair2.bookingId).maybeSingle();
    check("damage raises a caution dispute for Admin instead (Section 10)", dispute?.is_damage_claim === true && dispute?.caution_claim_kobo === 3_000_000, dispute);
  } finally {
    console.log(`\n  Test data left behind (append-only ledger). Purge: npm run e2e:purge`);
    console.log(`  users: ${userIds.join(", ")}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

// Mirror the module functions that build a request client, using the caller's
// signed-in client directly (same RLS the module relies on).
async function registerRiderAs(c: SupabaseClient<Database>, userId: string, name: string, phone: string, vehicle: "bike" | "car" | "van", cityId: string) {
  const { data, error } = await c.from("riders").insert({ user_id: userId, full_name: name, phone, vehicle_type: vehicle, city_id: cityId, status: "pending" }).select("id").single();
  if (error) throw error;
  void registerRider;
  return data!.id;
}

main().catch((e) => { console.error("\nE2E ABORTED:", e.message); process.exit(1); });
