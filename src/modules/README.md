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
| `marketplace` | public read model | empty |
| `bookings` | `bookings`, confirmation codes, `event_projects` | empty |
| `messaging` | `conversations`, `messages`, `moderation_flags` | empty |
| `disputes` | `disputes`, `dispute_evidence` | empty |
| `notifications` | `notifications`, preferences | empty |
| `reviews` | `reviews` | empty |
| `search` | no tables; reads the marketplace model | empty |

## Rules that are enforced, not just written down

**Booking logic never touches a payment processor.** `modules/payments/gateway/`
is private. `eslint.config.mjs` fails the build on any import of it from outside
`modules/payments`. Callers get `holdFunds`, `releaseFunds`, `refund` — the three
functions PRD Section 17 names — and nothing else. Swapping Flutterwave for
another processor means writing one adapter and changing one `switch`.

**Pages never hold the service-role key.** `@/lib/supabase/admin` bypasses RLS.
ESLint blocks importing it from `src/app` and `src/components`; it belongs behind
a module service that has already authorised the caller.

**Permissions live in the database.** `supabase/migrations/0011_rls.sql` is the
permission model from PRD Section 03. `requireRole()` in `modules/auth` decides
which URL a role may open — a UX boundary. RLS decides which rows they may read.
If the two ever disagree, RLS wins, and that is the point.

**Feature flags gate exposure, not architecture.** The schema for Event Project,
Reliability Score, rider assignment, and the caution fee is live from Phase 1.
`feature_flags` rows decide who sees them. Turning a feature on is an `UPDATE`.
