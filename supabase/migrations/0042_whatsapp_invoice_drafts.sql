-- A vendor's "generate invoice" flow needs somewhere to hold the draft
-- between messages: bot proposes item + price extracted from the chat, the
-- vendor replies 1 (approve) or 0 (edit) before anything is actually sent to
-- the customer. One draft per conversation - a fresh "generate invoice" or an
-- approval/send both replace or clear it, never stack.
create table public.whatsapp_invoice_drafts (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  item text not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  status text not null default 'awaiting_confirmation' check (status in ('awaiting_confirmation', 'awaiting_edit')),
  created_at timestamptz not null default now()
);

-- Admin-client only (the WhatsApp bot server), same as price_offers writes
-- driven from WhatsApp - no browser session exists to satisfy ordinary RLS.
alter table public.whatsapp_invoice_drafts enable row level security;
