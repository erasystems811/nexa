# NEXA — PRD Addendum v1.2

*Powered by ERA*

## How to Use This Document

This is a product pivot layered on top of `PRD.md` and `PRD_ADDENDUM_v1.1.md`.
Where this document disagrees with either earlier document, **this document wins**.

The largest change is structural: Nexa is no longer designed around a
Nexa-operated rider network. Nexa is now an event vendor access marketplace.
Customers, event hosts, and vendors use the platform to discover and contact
trusted providers across all event-related categories. Transport providers such
as car, van, truck, and logistics companies are providers on the marketplace,
not Nexa staff and not a separate rider pool.

---

## 1. Updated Product Positioning

Nexa is an access space for event vendors and event services.

The platform helps people find, compare, contact, negotiate with, and book
vendors needed for events. This includes talent, food, decor, rentals,
photography, venues, cleaning, security, transport, logistics, and other
services that make an event happen.

Nexa's core marketplace role is:

- make event vendors discoverable;
- verify and organize vendor profiles;
- give customers a trusted place to contact vendors;
- support bookings, messages, reviews, and vendor reputation;
- let vendors manage their own listings, availability, and customer leads.

Nexa's core marketplace role is **not** to own fulfillment for every booking.
For ordinary marketplace bookings, the vendor is responsible for delivering,
appearing, transporting, or otherwise fulfilling the service they listed.

---

## 2. No Nexa-Registered Rider Network

The Rider App, rider role, rider assignment pool, rider wallet, and
Nexa-operated delivery workflow are no longer part of the target product.

Transport is now a vendor category.

Examples:

- car hire companies;
- van and bus companies;
- truck/logistics companies;
- dispatch and errand services;
- equipment-moving services;
- airport pickup or guest shuttle providers.

These businesses sign up as providers, create listings, receive inquiries or
bookings, and handle their own operations like every other vendor.

If a decorator needs a van to move materials, they can find and contact a van
provider through Nexa. If a customer needs guest transport, they can book a car
or bus provider through Nexa. Nexa is the access layer, not the operator of the
vehicle.

---

## 3. Updated Application Structure

Nexa now has three primary surfaces:

| App | Audience | Purpose |
|---|---|---|
| Nexa Marketplace | Customers, event hosts, and vendors searching for services | Discover vendors, browse categories, chat/call, request pricing, book where enabled |
| Nexa Business Studio | All verified providers | Manage business profile, listings, leads, bookings, media, reviews, and availability |
| Nexa Admin Console | Nexa operations team | Verify providers, approve listings, manage marketplace quality, support, disputes, settings, staff, and Plan Your Event operations |

Remove the Rider App as a standalone surface. Existing rider-oriented routes,
permissions, copy, and data structures should be deprecated or migrated toward
normal provider/vendor functionality.

---

## 4. Provider Categories

The provider model should support broad event supply and service categories.
Categories remain admin-managed and database-driven.

Representative category groups:

- Talent and entertainment: DJs, MCs, hosts, performers, live bands.
- Media: photographers, videographers, livestream teams, editors.
- Food and drinks: caterers, small chops, cakes, bartenders, drinks vendors.
- Decor and production: decorators, florists, lighting, sound, staging.
- Rentals: chairs, tables, canopies, linens, equipment.
- Beauty and styling: makeup, hair, wardrobe, styling.
- Venue and spaces: halls, lounges, outdoor spaces, private venues.
- Operations: cleaning, security, ushers, event staff.
- Transport and logistics: cars, buses, vans, trucks, dispatch, equipment moving.

Transport/logistics categories are provider categories, not rider categories.

---

## 5. Marketplace Booking Model

Search & Book should become lighter and more vendor-led.

For normal marketplace use:

- customers discover vendors;
- customers contact vendors through in-app chat or masked calls;
- fixed-price listings may still support direct booking and payment;
- negotiable or custom services use inquiry, quote, and agreement flows;
- the vendor is responsible for fulfillment;
- delivery, setup, pickup, return, and transport terms are part of the vendor's
  listing or negotiated quote.

Nexa may still support platform payment, receipts, and reviews where appropriate,
but the product should not assume that every booking has a Nexa-controlled rider,
delivery confirmation code, or two-stage logistics checkpoint.

The earlier delivery-specific logic should be narrowed to category/listing terms
owned by the provider, not platform-wide rider operations.

---

## 6. Plan Your Event

Plan Your Event is now the managed-service layer.

This is the part of Nexa where Nexa can take responsibility for planning,
coordination, vendor selection, follow-up, and event execution support.

Plan Your Event should feel different from ordinary marketplace browsing:

- the customer asks Nexa to help plan an event;
- Nexa collects the event type, date, budget, city, guest count, style, and key
  needs;
- Nexa can recommend, shortlist, or manually assemble vendors;
- Nexa may coordinate across multiple vendors;
- Nexa may collect a planning/service fee, commission, or bundled quote;
- Nexa owns the customer relationship more directly for that event project.

In short:

- **Marketplace:** people access vendors.
- **Plan Your Event:** Nexa helps plan and coordinate the event.

---

## 7. Trust and Verification

Verification remains important, but the trust promise should match the new model.

Nexa verifies that a provider is legitimate enough to appear on the platform.
That can include business details, ID, media, references, social proof, location,
and category-specific evidence.

For ordinary marketplace bookings, Nexa should not imply that it personally
controls every vendor's arrival, transport, or delivery unless the booking is
inside a managed Plan Your Event engagement.

Recommended trust copy:

> "Find verified event vendors. Contact them, compare options, and plan with
> confidence."

Avoid copy that suggests Nexa always operates fulfillment, riders, or delivery.

---

## 8. Admin Console Changes

Remove Rider Operations as a standalone operational department for a Nexa rider
fleet.

Replace it with provider/category operations such as:

- Service Vendor Manager;
- Product/Rental Vendor Manager;
- Transport & Logistics Vendor Manager;
- Customer Support;
- Finance;
- Marketing;
- Plan Your Event Coordinator;
- Super Admin.

Admin still verifies providers, approves listings, monitors quality, handles
support, reviews disputes, manages feature flags, and oversees staff permissions.

Transport companies should be managed in Provider Management, filtered by their
category group.

---

## 9. Implementation Notes

The existing codebase contains a completed Rider App and rider-specific schema.
Do not build new features on top of that model. Refactor in stages:

1. Update product copy and navigation so Nexa no longer presents a Rider App.
2. Add transport/logistics as ordinary provider categories.
3. Replace rider staff permissions with transport/logistics vendor management
   permissions.
4. Move delivery/transport language into provider listing terms and quote flows.
5. Deprecate rider-specific tables/routes/modules after marketplace and admin
   flows no longer depend on them.
6. Rework booking/payment logic so ordinary marketplace bookings do not require
   rider assignments or delivery confirmation codes.
7. Build Plan Your Event as the managed coordination layer where Nexa can take
   stronger operational responsibility.

This should be treated as a product pivot, not a surface-level wording change.
