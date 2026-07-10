# NEXA

### P O W E R E D B Y E R A

*Product Requirements Document*

Version 1.0 · July 2026

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

-   Category --- dynamic, admin-managed, never hardcoded. Every category is tagged as either a physical-goods category (uses the rider network) or a service category (provider attends in person).

-   Provider --- business profile, verification status, documents, reliability score, wallet.

-   Listing --- belongs to a provider and a category; has price, payment type (full or deposit), media, availability, and approval status.

-   Booking --- a single customer-provider transaction with a lifecycle state, a delivery confirmation code, and a payment record.

-   Delivery Confirmation Code --- a unique code generated per booking and given to the customer. Whoever completes the job --- the rider for goods, the provider for services --- enters this code to mark the booking delivered/completed, which is what triggers payment release.

-   Rider --- registered independently of providers, with their own vehicle; assigned to physical-goods bookings only, never to service bookings.

-   Event Project --- groups multiple bookings under one customer event (used by Plan My Event), with a shared checklist and a single status dashboard.

-   Payment record --- tracks the amount held, the single release on confirmed delivery, commission, and any penalty deductions.

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

-   Live verification --- a short video call or selfie-with-ID at onboarding, since submitted documents alone can be forged or borrowed.

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

-   If the booking is a physical-goods category, Nexa assigns a registered rider once the provider marks the item ready --- the provider never has to arrange their own delivery. Service-category bookings skip this step entirely; the provider attends in person.

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

  -------------------------------------------------------------------------------------------------------------------------------------------------
### State**        **Meaning
  ---------------- --------------------------------------------------------------------------------------------------------------------------------
  Pending          Customer has requested; provider has not yet responded

  Accepted         Provider confirmed; customer\'s fast full-refund window closes

  Rejected         Provider declined; customer refunded automatically, no admin needed

  Paid / Held      Full payment confirmed and held by Nexa --- nothing is released yet

  In Progress      Provider has begun the job (goods: rider assigned and en route; services: provider checked in)

  Completed        Customer\'s delivery confirmation code has been entered and verified; full payment releases to the provider in one transaction

  Cancelled        Refund calculated per the cancellation policy stage

  Disputed         Escalated to Admin for manual resolution
  -------------------------------------------------------------------------------------------------------------------------------------------------

### Cancellation Policy

-   Before provider acceptance: customer can always cancel for a full refund. Provider has committed to nothing yet.

-   After acceptance: refund follows the provider\'s own tiered policy, e.g. 100% more than 7 days out, 50% at 3--7 days, 0% inside 3 days. Displayed to the customer before booking, calculated automatically --- never manual.

-   Provider can reject a booking at any point before check-in; this triggers an automatic full refund and customer notification with no admin step required.

## 10 PAYMENT & ESCROW MODEL

> *Customers never pay providers directly. Full payment is held by Nexa and released once delivery is confirmed --- in one payment, not in stages.*

This is the founder\'s explicit decision: there is no partial or milestone-based release. Nexa holds 100% of the payment from the moment the customer pays until the job is verified complete, then releases the full amount (minus commission and any penalty) in a single transaction. Everything else --- deposits, penalties --- sits on top of this simple rule, not instead of it.

### Delivery Confirmation Code

Every booking generates a unique code, shown only to the customer. This is the single trigger for payment release, and it works differently depending on the category:

-   Physical goods --- the assigned rider asks the customer for the code on drop-off and enters it in the Rider App. This is the same pattern that makes delivery platforms like Chowdeck trustworthy: nobody can falsely claim a delivery happened.

-   Services --- the customer gives the provider the code once the service is satisfactorily delivered (e.g. at the end of the DJ set, on handover of the decorated venue).

-   Entering the correct code is what moves the booking to Completed and releases payment --- not a provider or rider simply tapping "done."

### Commission

Platform commission is not hardcoded. It is stored as an Admin Console setting that Admin can update at any time without a code deployment.

### Deposit Percentage

There is no platform-wide deposit default. Each provider\'s deposit percentage is negotiated individually and recorded on their Provider Agreement at onboarding, set by Admin --- not selected by the provider in Business Studio.

### Late & No-Show Penalties

The standard Provider Agreement every provider signs at onboarding sets a default penalty of 1% of the booking value deducted per 30 minutes late. This is the platform default for all providers; Admin can record a negotiated override for an individual provider where one has been agreed. Penalties are deducted from the single payout at release --- they don\'t require a separate transaction.

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

-   For physical-goods bookings: mark the item ready for pickup, which triggers rider assignment --- the provider does not arrange their own delivery. For service bookings: check in on arrival as before.

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

Riders register independently --- with their own bike or car, like a delivery platform rider --- and are only ever assigned to physical-goods bookings. Service categories (DJs, photographers, decorators and similar) never involve a rider; the provider attends in person.

### Rider Onboarding

-   Name, contact, vehicle type and documents, ID verification --- reviewed and approved by Admin before a rider can accept jobs, the same verification discipline as providers

### Delivery Queue

-   Assigned deliveries with pickup location (provider), drop-off location (customer), and item details

-   Accept or decline an assigned delivery

### Delivery Flow

-   Mark picked up from provider → mark en route → arrive at customer → enter the customer\'s delivery confirmation code to mark delivered

-   Entering the correct code is what completes the booking and releases payment (Section 10) --- a rider cannot mark a delivery complete without it

### Rider Reliability

-   On-time delivery rate and completed-delivery count are tracked per rider, the same way reliability is tracked for providers (Section 11)

### Earnings

-   Per-delivery fee, running total, and payout history

## 16 DESIGN PRINCIPLES

-   Modern, premium, minimal, fast --- reference points are Airbnb, Uber, and Chowdeck, not a generic directory app

-   Mobile-first; every screen should feel polished, not like an MVP

-   Trust is a visual language, not just a data point: reliability scores, verified badges, and completed-event counts should be visible wherever a customer is deciding whether to book

-   The provider-facing area is called "Business Studio," never "Vendor Portal"; customer- and provider-facing copy says "Provider," never "Vendor" (the database table can stay named vendors internally)

## 17 SCALABILITY & TECHNICAL REQUIREMENTS

-   No hardcoded categories, providers, or cities --- everything is database-driven from day one

-   Modular architecture with clearly separated domains: Auth, Users, Admin, Provider, Rider, Marketplace, Bookings, Payments, Notifications, Reviews, Search, Settings

-   The Payments module sits behind an internal interface (e.g. holdFunds, releaseFunds, refund) that calls out to the payment provider --- the escrow logic and data model do not assume Flutterwave specifically, so the underlying processor can be swapped without touching booking logic

-   Recommended stack: Next.js, TypeScript, TailwindCSS, Supabase (database, auth, RLS), Railway (hosting), Flutterwave (payments, pending confirmation of their escrow product --- see Section 20)

-   Launch as a single-city platform (Abuja) that is structurally ready for multi-city expansion without a rebuild

## 18 EXPLICITLY OUT OF SCOPE FOR V1

Excluding these from V1 is a deliberate scope decision, not an oversight --- each adds real complexity that is only worth taking on once the core marketplace has real provider and order volume.

-   Event Stand Mode --- vendors selling live, walk-up-and-pay to any guest at an event (Section 08 covers pre-booked in-app chat/negotiation only, which is different and is in V1)

-   AI-generated recommendations

-   Coupons and subscriptions

-   Advanced wallet features beyond basic provider and rider payouts

-   Referral system and loyalty programs

-   Marketing automation

-   Advanced analytics dashboards beyond the core Admin reports

## 19 PHASED ROADMAP

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
### Phase**                                      **Scope
  ---------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Phase 1 --- Foundation                         Auth, Admin Console, Business Studio, Marketplace Search & Book, Rider App, in-app chat and masked calling with contact-info flagging (Section 08). Nexa\'s own registered riders handle physical-goods delivery from day one; service providers attend in person. Abuja only.

  Phase 2 --- Plan My Event & Event Stand Mode   Guided planning flow, bundles/packages, Event Project dashboard, plus live walk-up vendor selling at events (QR-based, Section 08\'s out-of-scope note).

  Phase 3 --- Expansion                          Multi-city rollout, premium white-glove full-service tier, AI-assisted recommendations.
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

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

  Delivery ownership            Nexa registers and operates its own riders for physical-goods categories from V1; services are self-attended by the provider

  Payment provider              Flutterwave, chosen for its native escrow product --- availability and terms to be confirmed directly with Flutterwave before Payments module is finalised

  Vendor-selling-at-events      Prepaid package model only in V1; open walk-up selling (Event Stand Mode) deferred to Phase 2

  Off-platform contact          In-app chat and masked calling are in V1, not deferred; phone/account numbers shared in-app are auto-flagged and treated as a Provider Agreement breach (Section 08)
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### Still Open

Confirming with Flutterwave that their escrow product is approved for Nexa\'s account (not just documented) and what Nigerian regulatory requirements apply to holding customer funds this way. Delegated to staff for fact-finding; final confirmation before the Payments module is finalised remains the founder\'s call.
