# NEXA

### Powered by ERA

*Product Requirements Document*

Version 1.1 · July 2026

Prepared for Chidera Umeh, Founder

## 01 VISION & POSITIONING

### The Problem

Nexa exists because sourcing vendors for an event is currently a manual, unverifiable, high-anxiety process. Someone planning a birthday, a wedding, or a night-life event today scrolls Instagram, DMs strangers, negotiates prices privately, and has no reliable way to confirm the vendor will actually show up, on time, at the promised standard. This is not a hypothetical problem --- it is the exact experience the founder had running night-life events and planning a personal birthday, before any market research was done.

> *"Open one app. Close it knowing your event is under control."*

### What Nexa Is

Nexa is an event supply marketplace --- a commerce platform, not a planning tool. Customers come to buy or book real things (a DJ, a cake, chairs, a decorator) from verified providers, and pay through the platform, which holds funds until the job is done. Nexa\'s job is to remove uncertainty from that transaction.

### What Nexa Is Not

-   Not an event-planning content app or checklist app with no commerce behind it.

-   Not an open directory where anyone can self-list without verification.

-   Not a company that owns inventory, vehicles, or staff for delivery in V1.

### Two Ways Customers Use Nexa

-   Search & Book --- the customer knows what they need ("DJ", "chairs", "drinks"), searches the category, and books directly. Modelled on Chowdeck: fast, transactional, no hand-holding.

-   Plan My Event --- for the customer who is overwhelmed (the founder\'s own original problem). They select an event type, date, budget, and guest count, and Nexa recommends a curated set of verified providers or a bundle. Everything is checked out once and tracked as a single Event Project.

### Category Map

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
### Type**                   **Examples**                                                                          **Fulfillment model
  -------------------------- ------------------------------------------------------------------------------------- -------------------------------------------------------------------------------
  Physical goods / rentals   Cakes, drinks, chairs, tables, decor, balloons, flowers, sound & lighting, canopies   Vendor delivers, or rider network in a later phase

  Services / talent          DJs, MCs, hosts, photographers, videographers, makeup artists, security, cleaners     Provider travels and performs on site; platform tracks arrival and completion
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

There is no fixed launch category list. Categories are fully open and admin-managed from day one --- Admin adds a category the moment the first real, verified provider in that category is onboarded. Whichever category brings the first trustworthy provider becomes the first live category.

### What Building Nexa Actually Means

The platform is the structure, not the supply. Finding real vendors and riders, convincing them to sign up, and building the trust that makes the marketplace work is manual operational work --- done by the founder and team, one onboarding at a time. Nexa\'s job is to be ready to support each one the moment they\'re found: registration, verification, listings, bookings, payments, all already working. The build should stay at this base-platform level; it should not try to automate vendor or rider discovery, sourcing, or recruitment --- that is deliberately a human job, not a feature.

## 02 PRODUCT ARCHITECTURE

Nexa is four applications sharing one backend, one provider database, and one booking/payment engine: one core platform, role-specific surfaces on top.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------
### Application**        **Audience**             **Purpose
  ---------------------- ------------------------ -------------------------------------------------------------------------------------------------------------------
  Nexa Admin Console     Internal ops team only   Controls the entire marketplace --- provider verification, listing approval, order monitoring, payments, disputes

  Nexa Business Studio   Verified providers       Each provider manages only their own business: listings, media, availability, orders, payouts

  Nexa Marketplace       Customers                Search & Book and Plan My Event, booking, payment, and order tracking

  Nexa Rider App         Registered riders        Accept assigned deliveries for physical-goods bookings, update pickup/drop-off status
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 03 USER ROLES & PERMISSIONS

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
### Role**           **Sees**                                                                  **Can do
  ------------------ ------------------------------------------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Admin (Nexa ops)   Everything: all providers, riders, listings, orders, payments, disputes   Approve/reject providers, verify/suspend riders, approve/reject listings, monitor every order, intervene on payments, resolve disputes, manually create bookings, manually reassign a delivery

  Provider           Only their own business                                                   Create/edit/pause listings, upload media (pending approval), set availability, accept/reject orders, view payouts, reply to reviews

  Customer           Public marketplace + their own bookings                                   Search, book, pay, track orders, cancel per policy, leave reviews, save favourites

  Rider              Assigned deliveries only                                                  Register with own bike/car, accept a delivery job, update pickup/drop-off status, confirm delivery via the customer\'s code
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 04 CORE DATA OBJECTS

-   Category --- dynamic, admin-managed, never hardcoded. Every category is tagged with one of four fulfillment types: Delivery, Delivery + Return, On-site Service, or Vendor-Location Service (Section 10).

-   Provider --- business profile, verification status, documents, reliability score, wallet.

-   Listing --- belongs to a provider and a category; has price, payment type (full or deposit), media, availability, and approval status.

-   Booking --- a single customer-provider transaction with a lifecycle state, one or two delivery confirmation codes depending on fulfillment type, and a payment record with a stage-1 and stage-2 release.

-   Delivery Confirmation Code --- a unique code per stage, shown only to the customer. Delivery and service bookings generate one code; Delivery + Return bookings generate two (drop-off and return). Whoever completes that stage --- rider or provider --- enters the code to trigger that stage\'s payment release.

-   Rider --- registered independently of providers, with a declared vehicle type (bike, car, or van/bus); assigned to Delivery and Delivery + Return bookings only, never to service bookings.

-   Caution Fee --- a separate held deposit on Delivery + Return bookings, refunded to the customer at return or partially claimed by Admin decision if the item is damaged (Section 10).

-   Event Project --- groups multiple bookings under one customer event (used by Plan My Event), with a shared checklist and a single status dashboard.

-   Payment record --- tracks the amount held, stage-1 and stage-2 releases, commission, and any penalty deductions.

-   Review --- structured ratings (quality, punctuality, communication, value) tied to a completed booking only.

-   Reliability Score --- computed per provider from on-time rate, cancellation rate, completed verified events, and repeat-client rate.

## 05 PROVIDER ONBOARDING & VERIFICATION

No provider appears publicly without manual review. This is non-negotiable in the model the founder specified: reliability is the product, and it starts at intake.

### Flow

-   Provider submits business profile: name, category, location, contact, ID/business documents.

-   Provider submits sample media (photos, and for talent categories, video is required, not optional).

-   Admin reviews the application against the verification checklist below.

-   Admin approves, rejects, or requests changes. Approved providers get a live Business Studio account, but their listings still start in Pending state.

-   As part of approval, the provider signs the Provider Agreement, which sets their deposit percentage (negotiated per provider --- there is no platform-wide default) and confirms the standard late-arrival penalty terms (see Section 10), which apply unless Admin has recorded an override for that specific provider.

### Verification Checklist

-   NIN (National Identification Number) --- required.

-   CAC registration --- optional, but improves credibility and can be highlighted on the provider\'s public profile.

-   Phone number and email address --- required, verified with an OTP/confirmation link, not just collected.

-   Bank account number and BVN, cross-checked against each other --- confirms the account genuinely belongs to the person or business claiming it, not a mismatched or borrowed account.

-   Live verification --- a selfie-with-ID at onboarding, since a submitted document alone can be forged or borrowed.

-   Physical address or business location --- a GPS-tagged photo at minimum; a one-time physical visit for higher-value categories.

-   Past-client references --- one or two phone numbers of previous clients, contacted directly by Admin before approval.

-   Existing social media presence --- checked for activity and consistency with what was submitted; a provider with no online footprint at all is a higher-risk signal.

-   Once real provider volume exists, BVN/NIN/CAC checks should move from manual review to an automated Nigerian KYC API (e.g. Dojah, Youverify, Smile ID, or Mono\'s Lookup API) that verifies against government databases directly, including the account-name match --- manual checking will not scale past a handful of providers a week.

### Probation Period

-   Even after approval, a provider\'s first two to three bookings receive closer Admin attention --- faster response to any complaint, manual check-in on completion --- before they\'re treated as a fully established provider.

### Ongoing Compliance

-   Reliability score is monitored continuously, not just at onboarding.

-   A no-show automatically suspends the provider pending appeal; a successful appeal lifts the suspension, a failed one records a strike.

-   Strikes accumulate on the provider\'s record, but there is no fixed strike count that triggers automatic removal --- permanent removal is an Admin judgment call made with the full history in view, not an automated rule.

-   Admin can suspend or remove a provider at any time; suspension immediately hides all of that provider\'s listings.

## 06 LISTING CREATION & APPROVAL

Every listing, and every edit to an existing listing\'s media or core details, re-enters the approval queue before it becomes publicly visible. This applies to photos, videos, and profile changes, not only the first submission.

  ---------------------------------------------------------------------------------------------------
### Step**                  **Who**         **Result
  ------------------------- --------------- ---------------------------------------------------------
  1\. Create listing        Provider        Status: Pending Approval

  2\. Review                Admin           Approve, reject, or request changes

  3\. Publish               System          Listing becomes visible in the Marketplace

  4\. Edit media or price   Provider        Returns to Pending Approval before the change goes live
  ---------------------------------------------------------------------------------------------------

Each listing also declares its payment type at creation: full payment (best for straightforward physical goods like cakes, drinks, chairs) or a deposit percentage within a platform-defined range (best for advance-booked services like DJs, photographers, decor). It separately declares its price type: Fixed or Negotiable (Section 08).

## 07 DISCOVERY & BOOKING FLOWS

### Search & Book

-   Customer searches by provider, category, listing, location, price, rating, or availability.

-   Only available listings are shown --- no messaging ten providers to find one who is free.

-   Customer views the listing, checks availability, books a date and time, and pays.

-   If the listing is Negotiable rather than Fixed, the customer opens in-app chat or calls the provider first (Section 08); the booking is created only once a final price is agreed, and payment follows from that agreed amount.

-   If the booking is a physical-goods category, the provider calls a rider once the item is ready --- pressing "Call a bike", "Call a car", or "Call a van" books a registered, Nexa-verified rider of that vehicle class from the platform's own pool. The provider chooses the vehicle class, never a specific individual and never a rider outside the verified pool. Service-category bookings skip this step entirely; the provider attends in person.

### Plan My Event

-   Customer selects an event type (birthday, wedding, club night, corporate, baby shower, graduation, house party).

-   Customer provides date, budget, city, and guest count.

-   Nexa recommends a curated set of verified, available providers, or a pre-built package (e.g. a Basic Birthday Package: DJ + Cake + Decor + Photographer at one bundled price).

-   Customer checks out once. This creates a single Event Project containing every booking, with one shared checklist and one status dashboard, instead of five separate orders the customer has to track individually.

Both flows use the same underlying booking and payment engine --- Plan My Event is a curation and bundling layer on top of Search & Book, not a separate system.

## 08 IN-APP COMMUNICATION & NEGOTIATION

Not every category has a fixed price. Decor, catering, and bespoke packages often need back-and-forth before a number is agreed. Rather than pushing that negotiation onto WhatsApp or Instagram --- which is exactly the uncertainty Nexa exists to remove --- negotiation happens inside the app, through in-app chat and in-app calling.

### Listing Price Type

-   Fixed --- the price shown on the listing is the price; customer books and pays directly (Section 06, Section 07).

-   Negotiable --- the listing shows a starting range or "Price on request"; customer and provider discuss in-app chat or in-app call before a final price is agreed and a booking is created at that agreed amount.

### In-App Chat & Calling

-   All pre-booking conversation happens through in-app chat and in-app voice calling --- never by exchanging personal numbers.

-   Calls are connected through the platform (a proxy/masked connection, the same pattern ride-hailing apps use) so neither side sees the other\'s real phone number.

### Contact-Info Flagging

-   Messages are automatically scanned for phone numbers and bank account numbers. A detected attempt to share either is flagged for Admin review --- not silently blocked, since false positives happen, but surfaced so Admin can act.

-   A confirmed attempt to move a customer off-platform is treated as a breach of the Provider Agreement\'s anti-poaching clause: it is logged as a strike, the same consequence structure as a no-show (Section 05, Section 20).

-   This applies in both directions --- a provider soliciting off-platform contact is flagged the same way as a customer trying to arrange a private deal.

The deeper defence isn\'t the flag itself --- it\'s making the protections Nexa provides (held payment, dispute resolution, review history) something both sides don\'t want to risk losing. The flagging system exists to catch and discourage the obvious attempts, not to pretend it stops every handshake.

  ---------------------------------------------------------------------------------------------------------------------------------
### State**        **Meaning
  ---------------- ----------------------------------------------------------------------------------------------------------------
  Pending          Customer has requested; provider has not yet responded

  Accepted         Provider confirmed; customer\'s fast full-refund window closes

  Rejected         Provider declined; customer refunded automatically, no admin needed

  Paid / Held      Full payment confirmed and held by Nexa --- nothing is released yet

  In Progress      Stage 1 checkpoint passed (rider picked up / dropped off, or provider checked in) --- stage 1 payment released

  Completed        Final delivery/return/service code entered and verified; stage 2 payment releases

  Cancelled        Refund calculated per the cancellation policy stage

  Disputed         Escalated to Admin for manual resolution
  ---------------------------------------------------------------------------------------------------------------------------------

### Cancellation Policy

-   Before provider acceptance: customer can always cancel for a full refund. Provider has committed to nothing yet.

-   After acceptance: refund follows the provider\'s own tiered policy, e.g. 100% more than 7 days out, 50% at 3--7 days, 0% inside 3 days. Displayed to the customer before booking, calculated automatically --- never manual.

-   Provider can reject a booking at any point before check-in; this triggers an automatic full refund and customer notification with no admin step required.

## 10 PAYMENT & ESCROW MODEL

> *Customers never pay providers directly. Nexa holds the money and releases it in stages, tied to real checkpoints --- never on a provider or rider simply tapping "done."*

Not every category fulfils the same way, so payment can\'t release on one fixed trigger. Nexa recognises four fulfillment types, set at the Category level, each with its own version of the same underlying rule: money moves only when a real, verifiable checkpoint has passed.

### Fulfillment Types & Payment Stages

  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
### Type**                  **Examples**                                    **Stage 1 (partial release)**             **Stage 2 (remainder)
  ------------------------- ----------------------------------------------- ----------------------------------------- ------------------------------------------------------------------
  Delivery                  Cake, small drinks order, small decor           Rider picks up from provider              Customer\'s delivery code, entered on drop-off

  Delivery + Return         Chairs, tables, canopies, sound equipment       Rider drops off --- customer\'s code #1   Rider picks item back up after the event --- customer\'s code #2

  On-site service           DJ, MC, photographer, decorator                 Provider checks in at the venue           Customer\'s code, given at end of service

  Vendor-location service   Studio makeup trial, self-drive rental pickup   Provider accepts the booking              Customer\'s code, given on arrival and service
  --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

The stage-1 release percentage is an Admin Console setting, not hardcoded --- it applies as a platform default across all fulfillment types unless a provider has a recorded override.

### Caution Fee (Delivery + Return only)

Rented items carry damage risk the moment they leave the provider\'s hands. For Delivery + Return bookings, a separate Caution Fee is collected from the customer at checkout, alongside the normal payment, and held apart from the regular escrow flow --- it is not part of the provider\'s payout calculation.

-   If the item is returned in good condition, the full Caution Fee is refunded to the customer once the return code is confirmed.

-   If damage is reported at return, Admin reviews the case and can deduct from the Caution Fee to compensate the provider, refunding any remainder to the customer. This is a manual Admin decision, not an automatic deduction --- damage claims need a human look, not a rule.

### Delivery Fee

Delivery fee is set by Nexa, not the provider --- this keeps it consistent and prevents providers from quietly pricing out riders. V1 uses a flat delivery fee stored as an Admin Console setting. Distance-based calculation is a real improvement worth making, but it needs a distance/mapping mechanism and is a Phase 2+ upgrade, not a V1 blocker --- launch with a flat default and revisit once volume justifies the added complexity.

### Delivery Confirmation Code

Every booking generates a unique code, shown only to the customer (Delivery + Return bookings generate two: one for drop-off, one for return). This is what actually moves a stage forward --- never a rider or provider simply marking something done.

### Commission

Platform commission is not hardcoded. It is stored as an Admin Console setting that Admin can update at any time without a code deployment.

### Deposit Percentage

There is no platform-wide deposit default. Each provider\'s deposit percentage is negotiated individually and recorded on their Provider Agreement at onboarding, set by Admin --- not selected by the provider in Business Studio.

### Late & No-Show Penalties

The standard Provider Agreement every provider signs at onboarding sets a default penalty of 1% of the booking value deducted per 30 minutes late. This is the platform default for all providers; Admin can record a negotiated override for an individual provider where one has been agreed.

  -------------------------------------------------------------------------------------------------------------------------------------------
### Trigger**                          **Consequence
  ------------------------------------ ------------------------------------------------------------------------------------------------------
  Late arrival (default term)          1% of booking value deducted from provider payout per 30 minutes late, unless an override is on file

  No-show                              Provider is automatically suspended pending appeal; booking is cancelled and refunded per policy

  Repeated no-shows / failed appeals   Recorded as a strike; permanent removal is a case-by-case Admin decision, not an automatic threshold
  -------------------------------------------------------------------------------------------------------------------------------------------

### Where Penalty Money Goes

Penalty amounts are retained by Nexa, not the provider. Of the penalty collected, 30% is passed to the affected customer as compensation and 70% is retained by Nexa.

### Provider Wallet

-   Tracks wallet balance, pending earnings, completed earnings, and withdrawal history.

-   Payouts settle on a schedule (e.g. weekly) rather than instantly after every event, giving Admin a window to catch disputes before money leaves the platform.

### Rider Earnings

-   Delivery-only jobs: the rider\'s full delivery fee pays out on the single delivery code.

-   Delivery + Return jobs: the rider\'s delivery fee also splits in two --- half on the drop-off code, half on the return code. A rider who only does the drop-off leg is paid only the drop-off half.

### Compliance Note

*Holding customer funds and releasing them in stages is a standard escrow-style marketplace pattern, but it carries legal, regulatory, and payment-provider obligations that vary by jurisdiction and structure. This should be reviewed with a payment provider (e.g. Flutterwave) and legal counsel before launch --- it does not block building the product, but it must be resolved before real money moves through the platform.*

## 11 TRUST & RELIABILITY SYSTEM

The core competitive advantage is not the booking flow --- it is that Nexa knows, with evidence, who is actually reliable, in a market where Instagram reviews and photos can be faked and vendors can simply disappear.

### Reliability Score Inputs

-   On-time arrival rate

-   Cancellation rate

-   Number of verified completed events (only bookings made through Nexa count)

-   Repeat-client percentage

-   Structured review scores: quality, punctuality, communication, value --- not a single star rating

### Proof Requirements by Category

-   Talent (DJs, MCs, performers): video is required, not optional --- energy and crowd reaction cannot be shown in a photo.

-   Photographers / videographers: portfolio gallery.

-   Decorators: before/after documentation.

Every provider profile should visibly surface this evidence --- completed event count, on-time percentage, repeat-client rate --- so a customer\'s decision feels as confident as booking a highly-rated Airbnb, before they pay anything.

## 12 ADMIN CONSOLE --- FEATURE SPECIFICATION

### Dashboard

-   Total providers, pending provider applications, pending listing approvals

-   Today\'s orders, ongoing orders, cancelled orders

-   Revenue, platform commission, provider performance overview

### Provider Management

-   View all providers; add a provider manually; verify; suspend; view a provider\'s profile, listings, bookings, reviews, and payout history

### Rider Management

-   View all registered riders; verify rider documents and vehicle details; suspend a rider; view a rider\'s delivery history and on-time rate; assign or reassign a rider to a booking manually if needed

### Listing Approval Queue

-   Approve, reject, request changes, hide, or restore any listing, photo, or video before it is public

### Order Monitoring

-   View every booking across the platform in real time; manually update a booking\'s status when necessary

### Customer Management

-   All customers, booking history, complaints, refunds, support

### Payment Management

-   Escrow balances, commission tracking, provider payouts, penalty deductions, refunds

### Disputes

-   A dedicated queue for any booking flagged Disputed, with the full booking, payment, and messaging history attached

### Reports

-   Top providers, most-booked categories, revenue trends, booking growth

## 13 BUSINESS STUDIO --- FEATURE SPECIFICATION

### Dashboard

-   Today\'s and upcoming bookings, revenue, rating, reviews

### Business Profile

-   Name, logo, cover photo, description, location, contact, social links, business hours

### Listings

-   Create, edit, delete, pause, duplicate; every listing includes title, category, description, price, payment type, gallery, video, and availability

### Media

-   Every upload enters Pending Approval before it appears publicly

### Availability Calendar

-   Provider marks Available / Booked / Unavailable; customers only ever see available listings

### Orders

-   Pending, accepted, completed, cancelled; accept or reject with one tap

-   For physical-goods bookings: call a rider by vehicle class --- "Call a bike / car / van" --- which both marks the item ready and books a registered, Nexa-verified rider of that class. The provider picks the vehicle class from Nexa's own rider pool, not a specific person and not an outside rider. For service bookings: check in on arrival as before.

### Wallet & Payouts

-   Balance, pending earnings, completed earnings, withdrawal history and schedule

### Reviews & Settings

-   Read and reply to reviews; manage notifications, password, bank details, and business preferences

## 14 CUSTOMER MARKETPLACE --- FEATURE SPECIFICATION

### Home

-   Search bar, popular categories, featured and top-rated providers, entry point into Plan My Event

### Search & Category Browse

-   Filter by provider, category, listing, location, price, rating, availability

### Provider & Listing Pages

-   Gallery, video, reviews, reliability indicators, availability, price, book button

### Plan My Event

-   Event type, date, budget, guest count → curated recommendations or package → single checkout

### Booking & Payment

-   Choose date and time, confirm, pay; booking created and tracked immediately

### Event Project Dashboard

-   For Plan My Event customers: one shared checklist and one status view across every provider tied to that event

### My Orders / My Events

-   Upcoming, completed, cancelled; live status tracking; receipts

-   Each booking displays the customer\'s delivery confirmation code --- the customer never has to search for it; it\'s front and centre on the order once payment is made

### Saved, Reviews, Profile

-   Favourite providers and listings; leave structured reviews after completion only; manage personal info and notifications

## 15 RIDER APP --- FEATURE SPECIFICATION

Riders register independently, like a delivery platform rider, and are only ever assigned to physical-goods bookings (Delivery and Delivery + Return fulfillment types). Service categories never involve a rider; the provider or customer travels instead (Section 10).

### Rider Onboarding

-   Name, contact, vehicle type (bike, car, or van/bus) and documents, ID verification --- reviewed and approved by Admin before a rider can accept jobs, the same verification discipline as providers (Section 05).

-   Vehicle type matters for dispatch: the provider calls the vehicle class the load needs --- bulk or large orders (large drinks orders, big rental loads) get a car or van, not a bike. Nexa matches the call to an available registered rider of that class.

### Delivery Queue

-   Called deliveries with pickup location (provider), drop-off location (customer), and item details --- a rider is called by a provider (outbound) or scheduled by Nexa (returns), and lands in the rider's queue

-   Accept or decline a called delivery; a decline frees the job for the provider to call another rider, or for Admin to reassign

-   Large orders can be assigned to more than one rider as a team on the same booking --- the booking doesn\'t split, the assignment does. Whichever rider handles the final drop-off collects the customer\'s code.

### Delivery Flow

-   Mark picked up from provider → mark en route → arrive at customer → enter the customer\'s delivery confirmation code to mark delivered

-   Entering the correct code is what completes the Delivery stage and releases the associated payment (Section 10) --- a rider cannot mark a delivery complete without it.

### Return Flow (Delivery + Return bookings only)

-   After the event, Nexa schedules a return pickup automatically --- unlike the outbound leg, the provider does not call this one, because the provider is not present when the event ends. Nexa assigns it to a registered rider of the same vehicle class the outbound used. If none is free, Admin assigns it manually.

-   Rider marks item picked up from the customer, notes visible condition, and enters the customer\'s return code to confirm the return.

-   This triggers the stage-2 payout to the provider and the rider, and starts the Caution Fee refund/claim process (Section 10).

### Rider Reliability

-   On-time delivery rate and completed-delivery count are tracked per rider, the same way reliability is tracked for providers (Section 11)

### Earnings

-   Delivery-only jobs pay out in full on the delivery code; Delivery + Return jobs pay out half on drop-off and half on return (Section 10).

-   Running total and payout history

## 16 DESIGN PRINCIPLES

-   Modern, premium, minimal, fast --- reference points are Airbnb, Uber, and Chowdeck, not a generic directory app

-   Mobile-first; every screen should feel polished, not like an MVP

-   Trust is a visual language, not just a data point: reliability scores, verified badges, and completed-event counts should be visible wherever a customer is deciding whether to book

-   The provider-facing area is called "Business Studio," never "Vendor Portal"; customer- and provider-facing copy says "Provider," never "Vendor" (the database table can stay named vendors internally)

## 17 SCALABILITY & TECHNICAL REQUIREMENTS

-   No hardcoded categories, providers, or cities --- everything is database-driven from day one

-   Modular architecture with clearly separated domains: Auth, Users, Admin, Provider, Rider, Marketplace, Bookings, Payments, Messaging, Disputes, Notifications, Reviews, Search, Settings

-   The Payments module sits behind an internal interface (e.g. holdFunds, releaseFunds, refund) that calls out to the payment provider --- the escrow logic and data model do not assume Flutterwave specifically, so the underlying processor can be swapped without touching booking logic

-   Recommended stack: Next.js, TypeScript, TailwindCSS, Supabase (database, auth, RLS), Railway (hosting), Flutterwave (payments, pending confirmation of their escrow product --- see Section 20)

-   Launch as a single-city platform (Abuja) that is structurally ready for multi-city expansion without a rebuild

### Feature Flagging Strategy

Architecture and exposure are different decisions, and should be made separately. The database, backend, and permission model should be built for the full product --- including everything in Section 18 --- from the start. What\'s controlled per phase is only what\'s visible to users, through Admin Console feature flags, not what exists in the schema. This is how Uber Eats shipped on Uber\'s existing maps, drivers, payments, and ratings infrastructure instead of being rebuilt from zero.

-   Example: the Rider App and rider assignment logic exist in the schema from Phase 1. If a category has no registered riders yet, Admin assigns "Provider Delivery" as a manual fallback; Rider Delivery switches on for that category without any rebuild.

-   Example: the Event Project table and the logic linking multiple bookings to one event exist from Phase 1. The Plan My Event entry point on the Marketplace home screen stays behind a "Coming Soon" flag until Section 19\'s Phase 2, then switches on.

-   Example: Reliability Score fields (on-time rate, cancellation rate, completed jobs) are tracked from a provider\'s first booking. The score itself only displays publicly once Admin enables it --- either platform-wide once there\'s enough data, or per-provider once that provider has enough completed jobs to make the number meaningful.

-   What should genuinely wait, even at the architecture level: AI recommendations, marketing automation, and advanced analytics (Section 18). These aren\'t foundational the way payments, permissions, or the booking data model are --- they\'re additive layers with no structural cost to building later.

## 18 EXPLICITLY OUT OF SCOPE FOR V1 EXPOSURE

These are excluded from what customers, providers, or riders can see and use in V1 --- not from the architecture. Per Section 17, the schema and backend logic for most of these should exist from Phase 1, gated behind a feature flag, so turning them on later is a config change, not a rebuild.

-   Plan My Event and Event Stand Mode --- vendors selling live, walk-up-and-pay to any guest at an event (Section 08 covers pre-booked in-app chat/negotiation only, which is different and is in V1)

-   Public Reliability Score display (data collection starts immediately; the number itself stays hidden until Admin enables it)

-   AI-generated recommendations --- genuinely deferred, including at the architecture level (Section 17)

-   Coupons and subscriptions

-   Advanced wallet features beyond basic provider and rider payouts

-   Referral system and loyalty programs

-   Marketing automation --- genuinely deferred, including at the architecture level (Section 17)

-   Advanced analytics dashboards beyond the core Admin reports --- genuinely deferred, including at the architecture level (Section 17)

## 19 PHASED ROADMAP

Per Section 17, Phase 1\'s schema and backend cover the full product, not just what\'s visible at launch. What each later phase actually adds is UI exposure and any genuinely new logic (like Event Stand Mode\'s live QR checkout) --- not a rebuild of what came before.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
### Phase**                                      **Scope
  ---------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Phase 1 --- Foundation                         Auth, Admin Console, Business Studio, Marketplace Search & Book, Rider App, in-app chat and masked calling with contact-info flagging (Section 08). Schema for Event Project, Reliability Score, and feature flags built now even though their UI stays gated (Section 17). Nexa\'s own registered riders handle physical-goods delivery from day one; service providers attend in person. Abuja only.

  Phase 2 --- Plan My Event & Event Stand Mode   Flip the Plan My Event flag on (schema already exists from Phase 1) and build its UI: guided flow, bundles/packages, Event Project dashboard. Event Stand Mode is genuinely new work --- live walk-up vendor selling at events, QR-based checkout (Section 08\'s out-of-scope note).

  Phase 3 --- Expansion                          Multi-city rollout, premium white-glove full-service tier. AI-assisted recommendations, marketing automation, and advanced analytics are new architecture, not flagged features --- built here, not before (Section 17, Section 18).
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 20 FOUNDER DECISIONS

### Resolved

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
### Decision**                  **Resolution
  ----------------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Platform commission           Admin Console setting, not hardcoded --- editable anytime

  Deposit percentage            Negotiated per provider at onboarding, recorded on the Provider Agreement; no platform-wide default

  Late-arrival penalty          Standard Provider Agreement default: 1% of booking value per 30 minutes late; Admin can record a per-provider override

  No-show consequence           Automatic suspension pending appeal; failed appeal records a strike

  Permanent removal threshold   No fixed strike count --- Admin judgment call per case

  Penalty money                 Retained by Nexa; 30% passed to the affected customer as compensation, 70% retained

  Launch categories             None fixed --- fully open, category list grows as providers onboard

  Payment release model         Single full release on delivery confirmation code, not staged milestones

  Delivery ownership            Nexa registers, verifies, and operates its own rider pool for physical-goods categories from V1; services are self-attended by the provider

  Rider dispatch                Provider-called by vehicle class ("Call a bike / car / van") from Nexa's verified rider pool for outbound legs; Nexa auto-schedules the return leg. Supersedes the earlier "Nexa auto-assigns; the provider never arranges delivery" model --- the provider now chooses the vehicle class, but still never a specific individual or an outside rider

  Payment provider              Flutterwave, chosen for its native escrow product --- availability and terms to be confirmed directly with Flutterwave before Payments module is finalised

  Vendor-selling-at-events      Prepaid package model only in V1; open walk-up selling (Event Stand Mode) deferred to Phase 2

  Off-platform contact          In-app chat and masked calling are in V1, not deferred; phone/account numbers shared in-app are auto-flagged and treated as a Provider Agreement breach (Section 08)
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### Still Open

Confirming with Flutterwave that their escrow product is approved for Nexa\'s account (not just documented) and what Nigerian regulatory requirements apply to holding customer funds this way. Delegated to staff for fact-finding; final confirmation before the Payments module is finalised remains the founder\'s call.
