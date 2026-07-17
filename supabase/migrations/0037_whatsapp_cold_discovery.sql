-- 0037_whatsapp_cold_discovery.sql
-- A stranger with no Nexa account can now text the WhatsApp number cold and
-- get matched to listings, instead of only being able to continue a
-- conversation that already started on the web.
--
-- No new tables: whatsapp_contacts.profile_id (0027) already holds the link
-- to a customer once one is made, and whatsapp_threads already supports a
-- direct bind (0027's bindThreadFromReference does this today for the
-- Ref:-deep-link path; cold discovery does the same thing without a Ref).

-- Cold-discovery search is unauthenticated by nature (no account exists yet),
-- so a per-number counter is the only thing standing between it and someone
-- spamming random text at the bot to see what happens. Reset on a rolling
-- window rather than a hard daily cap, so a genuine customer who searches a
-- few times while narrowing down a vendor is never the one who gets throttled.
alter table public.whatsapp_contacts
  add column discovery_message_count integer not null default 0,
  add column discovery_window_started_at timestamptz;

-- Marks whether the WhatsApp "Accept" button has gone out for this offer yet.
-- A vendor's quote is created from the web (Business Studio), where there is
-- no notion of "the customer's WhatsApp window is open right now" - that can
-- only be known at the moment a WhatsApp message actually arrives. So sending
-- the button is attempted once when the offer is created, and retried at most
-- once more, on the customer's next inbound text, using this column to avoid
-- re-sending it on every message after that.
alter table public.price_offers
  add column whatsapp_notified_at timestamptz;
