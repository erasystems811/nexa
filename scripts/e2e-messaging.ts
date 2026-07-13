/**
 * End-to-end check for PRD Section 08, run against the live Supabase project.
 *
 *   npx tsx --env-file=.env.local scripts/e2e-messaging.ts
 *
 * Creates two throwaway accounts, exercises chat / flagging / masked calling
 * through the real module and the real RLS policies, then deletes everything.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient<Database>(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CUSTOMER_PHONE = "08031112222";
const PROVIDER_PHONE = "08039994444";

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

async function signedInClient(email: string, password: string) {
  const c = createClient<Database>(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in failed for ${email}: ${error.message}`);
  return c;
}

async function main() {
  const stamp = Date.now();
  const customerEmail = `e2e.customer.${stamp}@gmail.com`;
  const providerEmail = `e2e.provider.${stamp}@gmail.com`;
  const strangerEmail = `e2e.stranger.${stamp}@gmail.com`;
  const password = "NexaE2E!12345";

  const ids: string[] = [];

  try {
    // ---- accounts -------------------------------------------------------
    for (const email of [customerEmail, providerEmail, strangerEmail]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: email.split("@")[0] },
      });
      if (error) throw new Error(`createUser ${email}: ${error.message}`);
      ids.push(data.user.id);
    }
    const [customerId, providerUserId, strangerId] = ids as [string, string, string];

    await admin.from("profiles").update({ phone: CUSTOMER_PHONE }).eq("id", customerId);

    // ---- an approved provider -------------------------------------------
    const { data: providerRow, error: provErr } = await admin
      .from("providers")
      .insert({
        user_id: providerUserId,
        business_name: "E2E Sound Systems",
        slug: `e2e-sound-${stamp}`,
        status: "pending",
      })
      .select("id")
      .single();
    if (provErr || !providerRow) throw new Error(`provider insert: ${provErr?.message}`);
    const providerId = providerRow.id;

    await admin
      .from("provider_contacts")
      .update({ contact_phone: PROVIDER_PHONE })
      .eq("provider_id", providerId);

    await admin.from("providers").update({ status: "approved" }).eq("id", providerId);

    const { data: promoted } = await admin
      .from("profiles")
      .select("role")
      .eq("id", providerUserId)
      .single();
    check("approving a provider promotes their profile to role=provider", promoted?.role === "provider", promoted);

    // ---- conversation ----------------------------------------------------
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .insert({ customer_id: customerId, provider_id: providerId })
      .select("id")
      .single();
    if (convErr || !conv) throw new Error(`conversation insert: ${convErr?.message}`);
    const conversationId = conv.id;

    const customer = await signedInClient(customerEmail, password);
    const provider = await signedInClient(providerEmail, password);
    const stranger = await signedInClient(strangerEmail, password);

    // ---- chat ------------------------------------------------------------
    const { data: clean, error: cleanErr } = await customer
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: customerId, body: "Can you do 50 chairs on Saturday?" })
      .select("id, is_flagged, flag_reasons")
      .single();
    check("customer can send a message", !cleanErr && !!clean, cleanErr?.message);
    check("an ordinary message is not flagged", clean?.is_flagged === false, clean);

    const { data: reply } = await provider
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: providerUserId, body: "Yes, 50 chairs is fine." })
      .select("id")
      .single();
    check("provider can reply in the same conversation", !!reply);

    const { data: providerView } = await provider
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId);
    check("provider sees both messages", providerView?.length === 2, providerView?.length);

    // ---- flagging --------------------------------------------------------
    const { data: bad, error: badErr } = await customer
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: customerId,
        body: "just call me on 08034567890 instead",
      })
      .select("id, is_flagged, flag_reasons")
      .single();

    check("a flagged message STILL SENDS (never silently blocked)", !badErr && !!bad, badErr?.message);
    check("...and is marked flagged", bad?.is_flagged === true, bad);
    check("...with the phone_number reason", (bad?.flag_reasons ?? []).includes("phone_number"), bad?.flag_reasons);

    const { data: delivered } = await provider.from("messages").select("id").eq("id", bad!.id);
    check("...and the provider still receives it", delivered?.length === 1);

    const { data: flags } = await admin
      .from("moderation_flags")
      .select("id, reason, subject_id, status")
      .eq("message_id", bad!.id);
    check("...and an admin flag row was raised", (flags?.length ?? 0) >= 1, flags);
    check("...attributed to the sender", (flags ?? []).every((f) => f.subject_id === customerId), flags);

    // A sender must not be able to talk their way out of the scanner.
    const { error: forgeErr } = await customer
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: customerId,
        body: "my account is 0123456789",
        is_flagged: false,
      })
      .select("id, is_flagged")
      .single();
    const { data: forged } = await admin
      .from("messages")
      .select("is_flagged")
      .eq("conversation_id", conversationId)
      .eq("body", "my account is 0123456789")
      .single();
    check("a client CANNOT post is_flagged=false to evade the scanner", !forgeErr && forged?.is_flagged === true, forged);

    // A denied UPDATE under RLS matches zero rows and reports no error, so the
    // stored row is the only thing worth asserting on.
    await customer.from("messages").update({ body: "innocent" }).eq("id", bad!.id);
    const { data: afterEdit } = await admin
      .from("messages")
      .select("body, is_flagged")
      .eq("id", bad!.id)
      .single();
    check(
      "a sender CANNOT edit a flagged message afterwards",
      afterEdit?.body !== "innocent" && afterEdit?.is_flagged === true,
      afterEdit,
    );

    // ---- direction: providers get flagged too (Section 08) ---------------
    const { data: provBad } = await provider
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: providerUserId, body: "pay me directly, cheaper" })
      .select("id, is_flagged")
      .single();
    check("a PROVIDER soliciting off-platform is flagged the same way", provBad?.is_flagged === true, provBad);

    // ---- isolation -------------------------------------------------------
    const { data: strangerMsgs } = await stranger.from("messages").select("id");
    check("an unrelated user sees ZERO messages", strangerMsgs?.length === 0, strangerMsgs?.length);

    const { data: strangerConvs } = await stranger.from("conversations").select("id");
    check("an unrelated user sees ZERO conversations", strangerConvs?.length === 0, strangerConvs?.length);

    const { error: intrudeErr } = await stranger
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: strangerId, body: "hello" })
      .select()
      .single();
    check("an unrelated user CANNOT post into the conversation", !!intrudeErr, intrudeErr?.message);

    // ---- real phone numbers never reach a client -------------------------
    const custSelect = await customer.from("provider_contacts").select("contact_phone");
    check(
      "customer CANNOT read the provider's phone",
      (custSelect.data?.length ?? 0) === 0,
      custSelect.data ?? custSelect.error?.message,
    );

    const anon = createClient<Database>(URL, ANON);
    const anonSelect = await anon.from("provider_contacts").select("contact_phone");
    check(
      "anon CANNOT read any provider phone",
      (anonSelect.data?.length ?? 0) === 0,
      anonSelect.data ?? anonSelect.error?.message,
    );

    const anonProviders = await anon.from("providers").select("*").limit(1);
    check(
      "the public provider row carries no phone column at all",
      !JSON.stringify(anonProviders.data ?? []).includes("contact_phone"),
      anonProviders.data,
    );

    const ownContact = await provider.from("provider_contacts").select("contact_phone");
    check(
      "a provider CAN still read their own phone",
      ownContact.data?.[0]?.contact_phone === PROVIDER_PHONE,
      ownContact.data ?? ownContact.error?.message,
    );

    const provSelect = await provider.from("profiles").select("phone").eq("id", customerId);
    check(
      "provider CANNOT read the customer's phone",
      (provSelect.data?.length ?? 0) === 0,
      provSelect.data,
    );

    // ---- WhatsApp-mediated contact ---------------------------------------
    // Customers and vendors both message NEXA's WhatsApp number, and Nexa relays
    // between them. Neither side ever holds the other's number. The guarantee is
    // not politeness — it is RLS: `whatsapp_contacts` has no policy for a
    // participant at all, so there is no query either of them can write that
    // returns the other's WhatsApp identity.
    const { data: custWa } = await admin
      .from("whatsapp_contacts")
      .insert({ wa_id: `2348031112222-${stamp}`, profile_id: customerId, display_name: "Customer", phone_hint: "2222" })
      .select("id")
      .single();
    const { data: provWa } = await admin
      .from("whatsapp_contacts")
      .insert({ wa_id: `2348039994444-${stamp}`, profile_id: providerUserId, display_name: "Provider", phone_hint: "4444" })
      .select("id")
      .single();

    const { data: thread } = await admin
      .from("whatsapp_threads")
      .insert({
        conversation_id: conversationId,
        whatsapp_contact_id: custWa!.id,
        provider_whatsapp_contact_id: provWa!.id,
      })
      .select("id")
      .single();
    check("a conversation can be bound to a WhatsApp thread", !!thread, thread);

    const provReadsContacts = await provider.from("whatsapp_contacts").select("wa_id");
    check(
      "the VENDOR cannot read any WhatsApp identity — including the customer's",
      (provReadsContacts.data?.length ?? 0) === 0,
      provReadsContacts.data,
    );

    const custReadsContacts = await customer.from("whatsapp_contacts").select("wa_id");
    check(
      "the CUSTOMER cannot read any WhatsApp identity either",
      (custReadsContacts.data?.length ?? 0) === 0,
      custReadsContacts.data,
    );

    const provThread = await provider.from("whatsapp_threads").select("id").eq("id", thread!.id);
    check("...but a participant can see that the thread exists", provThread.data?.length === 1, provThread.data);

    const strangerThread = await stranger.from("whatsapp_threads").select("id");
    check("an unrelated user sees ZERO threads", (strangerThread.data?.length ?? 0) === 0, strangerThread.data);

    // ---- admin confirms the flag ----------------------------------------
    const flagId = flags![0]!.id;
    await admin
      .from("moderation_flags")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", flagId);

    const { data: subject } = await admin
      .from("profiles")
      .select("confirmed_solicitation_count")
      .eq("id", customerId)
      .single();
    check("confirming a flag increments the sender's solicitation count", subject?.confirmed_solicitation_count === 1, subject);

    const { data: provAfter } = await admin
      .from("providers")
      .select("strike_count")
      .eq("id", providerId)
      .single();
    check("confirming a flag does NOT auto-create a strike (Admin judgment, S05)", provAfter?.strike_count === 0, provAfter);
  } finally {
    for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {});
    console.log("\n  (test accounts deleted)");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nE2E ABORTED:", e.message);
  process.exit(1);
});
