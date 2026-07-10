# Modules

One directory per domain, per PRD Section 17. Each owns its tables and exposes a
barrel (`index.ts`). Nothing imports another module's internals — only its barrel.

| Module | Owns | Phase 1 |
| --- | --- | --- |
| `auth` | sessions, sign-in/out, role resolution | built |
| `settings` | `platform_settings`, `feature_flags` | built |
| `payments` | `payments`, `payment_ledger_entries`, `payouts`, `penalty_applications` | interface + escrow math built; gateway stubbed |
| `users` | `profiles` | empty |
| `admin` | verification queues, approvals, audit log | empty |
| `provider` | `providers`, agreements, reliability, wallets | empty |
| `rider` | `riders`, `rider_assignments`, wallets | empty |
| `marketplace` | public read model | built |
| `bookings` | `bookings`, confirmation codes, `price_offers`, `event_projects` | built (Search & Book) |
| `messaging` | `conversations`, `messages`, `call_sessions`, `moderation_flags` | built |
| `disputes` | `disputes`, `dispute_evidence` | empty |
| `notifications` | `notifications`, preferences | empty |
| `reviews` | `reviews` | empty |
| `search` | no tables; reads the marketplace model | built |

## Rules that are enforced, not just written down

**Booking logic never touches a payment processor.** `modules/payments/gateway/`
is private. `eslint.config.mjs` fails the build on any import of it from outside
`modules/payments`. Callers get `holdFunds`, `releaseFunds`, `refund` — the three
functions PRD Section 17 names — and nothing else. Swapping Flutterwave for
another processor means writing one adapter and changing one `switch`.

**Nothing outside `messaging` can hold a telephony provider.** `modules/messaging/telephony/`
takes real phone numbers as arguments. ESLint blocks importing it anywhere else,
so a future feature cannot place a call that leaks a subscriber number. Callers
get `startMaskedCall`, which returns a proxy number and nothing more.

**Pages never hold the service-role key.** `@/lib/supabase/admin` bypasses RLS.
ESLint blocks importing it from `src/app` and `src/components`; it belongs behind
a module service that has already authorised the caller.

**The message scanner is a database trigger, not a function in this module.**
A client that skips `sendMessage` and POSTs straight to PostgREST is scanned
identically, and cannot post `is_flagged: false` to talk its way out of it. The
same reasoning applies everywhere: if a rule can be bypassed by not calling the
code that enforces it, it belongs in the database.

**Permissions live in the database.** `supabase/migrations/0011_rls.sql` is the
permission model from PRD Section 03. `requireRole()` in `modules/auth` decides
which URL a role may open — a UX boundary. RLS decides which rows they may read.
If the two ever disagree, RLS wins, and that is the point.

**Feature flags gate exposure, not architecture.** The schema for Event Project,
Reliability Score, rider assignment, and the caution fee is live from Phase 1.
`feature_flags` rows decide who sees them. Turning a feature on is an `UPDATE`.
