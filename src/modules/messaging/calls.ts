import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTelephonyProvider } from "./telephony";
import { MessagingError, type CallTicket } from "./types";

const CALL_TTL_SECONDS = 60 * 15;

/**
 * Masked calling. PRD Section 08.
 *
 * This runs on the service-role client for one reason: placing a masked call
 * requires reading both parties' real phone numbers, and 0013_messaging.sql
 * revoked SELECT on those columns from every end-user role precisely so that no
 * session-scoped query can ever return them.
 *
 * Because the service role bypasses RLS, this function does its own
 * authorisation first. That check is not a formality — without it, any
 * signed-in user could open a call bridge into any conversation on the platform.
 */
export async function startMaskedCall(input: {
  conversationId: string;
  callerId: string;
}): Promise<CallTicket> {
  const db = createAdminClient();

  // The flag is read through the database function rather than the request-
  // scoped settings reader. A call can be placed from a webhook or a background
  // job, where there is no cookie to build a session client from, and the flag
  // must answer the same in both places.
  const { data: callingEnabled } = await db.rpc("is_feature_enabled", {
    flag_key: "in_app_calling",
  });
  if (!callingEnabled) {
    throw new MessagingError("In-app calling is not switched on");
  }

  const { data: conversation, error: convError } = await db
    .from("conversations")
    .select("id, customer_id, provider_id")
    .eq("id", input.conversationId)
    .single();

  if (convError || !conversation) {
    throw new MessagingError("That conversation does not exist");
  }

  const { data: provider, error: providerError } = await db
    .from("providers")
    .select("id, user_id, status")
    .eq("id", conversation.provider_id)
    .single();

  if (providerError || !provider) {
    throw new MessagingError("That provider does not exist");
  }

  // Authorisation, done by hand because RLS is not doing it for us here.
  const callerIsCustomer = conversation.customer_id === input.callerId;
  const callerIsProvider = provider.user_id === input.callerId;
  if (!callerIsCustomer && !callerIsProvider) {
    throw new MessagingError("You are not a participant in that conversation");
  }

  if (provider.status !== "approved") {
    throw new MessagingError("That provider is not active");
  }

  // Both reads are service-role only. `provider_contacts` is owner-or-admin at
  // the row level (0015), and `profiles` is own-row — neither number has any
  // path to a browser.
  const [{ data: customer }, { data: providerContact }] = await Promise.all([
    db.from("profiles").select("phone").eq("id", conversation.customer_id).single(),
    db.from("provider_contacts").select("contact_phone").eq("provider_id", provider.id).single(),
  ]);

  const customerPhone = customer?.phone;
  const providerPhone = providerContact?.contact_phone;

  if (!customerPhone || !providerPhone) {
    throw new MessagingError(
      "Both parties need a verified phone number before a call can be connected",
    );
  }

  const telephony = getTelephonyProvider();
  const session = await telephony.createMaskedSession({
    conversationId: conversation.id,
    customerPhone,
    providerPhone,
    ttlSeconds: CALL_TTL_SECONDS,
  });

  const { data: row, error: insertError } = await db
    .from("call_sessions")
    .insert({
      conversation_id: conversation.id,
      initiator_id: input.callerId,
      status: "requested",
      session_ref: session.sessionRef,
      telephony_provider: session.telephonyProvider,
      customer_proxy_number: session.customerProxyNumber,
      provider_proxy_number: session.providerProxyNumber,
      expires_at: session.expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !row) {
    // The bridge exists at the provider but we cannot track it. Tear it down
    // rather than leave a pair of proxy numbers allocated to nobody.
    await telephony.endSession(session.sessionRef).catch(() => {});
    throw new MessagingError(`Could not start the call: ${insertError?.message}`);
  }

  // The caller is told only the number *they* dial. The counterpart's real
  // number was never in scope, and their proxy number is not the caller's to know.
  return {
    callSessionId: row.id,
    dialNumber: callerIsCustomer ? session.customerProxyNumber : session.providerProxyNumber,
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function endMaskedCall(callSessionId: string, actorId: string): Promise<void> {
  const db = createAdminClient();

  const { data: session } = await db
    .from("call_sessions")
    .select("id, session_ref, conversation_id, conversations(customer_id, provider_id)")
    .eq("id", callSessionId)
    .single();

  if (!session) throw new MessagingError("That call does not exist");

  const conv = (session as unknown as {
    conversations: { customer_id: string; provider_id: string } | null;
  }).conversations;

  const { data: provider } = await db
    .from("providers")
    .select("user_id")
    .eq("id", conv?.provider_id ?? "")
    .maybeSingle();

  if (conv?.customer_id !== actorId && provider?.user_id !== actorId) {
    throw new MessagingError("You are not a participant in that call");
  }

  if (session.session_ref) {
    await getTelephonyProvider().endSession(session.session_ref);
  }

  await db
    .from("call_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", callSessionId);
}
