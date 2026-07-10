# NEXA — PRD Addendum v1.1

*Powered by ERA*

## How to Use This Document

This is a correction and addition layered on top of `PRD.md` (v1.0). It does not replace it — read both. Where this addendum and PRD.md disagree, **this addendum wins**. Everything in PRD.md not mentioned here is unchanged and still applies exactly as written.

If you (Claude Code) have already built against PRD.md, treat this as a change request against that existing work — not a reason to start over. Most of what's below is additive (new modules, new fields, new roles) rather than a rebuild of anything already working.

---

## 1. Explicitly Confirmed — NOT Changing

Two things in the source material this addendum is based on suggested changes that were **not accepted**. Stated here explicitly so there's no ambiguity:

- **Search & Book remains the V1 default home screen.** Plan My Event ("What are you planning?" event-type-first flow) stays exactly where PRD.md Section 19 already puts it: Phase 2, flagged off in V1, per the Feature Flagging Strategy in Section 17. Do not make it the default home screen in V1.
- Nothing about the booking lifecycle, payment/escrow model, fulfillment types, or founder decisions in PRD.md Sections 09–10 changes here.

---

## 2. Domain Structure (new)

Nexa uses subdomains under ERA's existing domain rather than a fully independent domain:

| App | Domain |
|---|---|
| Customer Marketplace | `nexa.erasystems.com.ng` |
| Business Studio (vendor portal) | `vendor.nexa.erasystems.com.ng` |
| Admin Console | `admin.nexa.erasystems.com.ng` |
| API | `api.nexa.erasystems.com.ng` |
| Documentation (optional) | `docs.nexa.erasystems.com.ng` |

The Rider App was not in the original subdomain list — assign it `rider.nexa.erasystems.com.ng` for consistency unless told otherwise.

---

## 3. Design Language & Brand Personality (new)

This governs the visual design of all four apps. Read this before doing any UI work in the `frontend-design` skill.

**Brand personality** — the product should make users feel safe, premium, reliable, professional, modern, and organized. The target feeling is *"I can trust Nexa with my event,"* not *"this is just another listing website."* Do not design it like a typical Nigerian marketplace app full of banners and clutter — the bar is Airbnb, Uber, and Apple: minimal, elegant, spacious, confidence-inspiring.

**Design language:**
- Minimal UI, white background, black typography
- One premium accent colour — Deep Navy or Emerald Green (pick one and use it consistently; Deep Navy matches the existing PRD document branding, so default to Deep Navy unless directed otherwise)
- Generous white space, no clutter
- Rounded cards, soft shadows
- Large, professional photography — not stock-photo generic
- Smooth animations, consistent spacing
- Premium typography, modern icon set

Every screen should read as clean and unhurried, not dense with information.

---

## 4. Staff Roles & Permission System (new — significant addition to Admin Console)

PRD.md Section 03 defines a single undifferentiated "Admin" role. That's no longer sufficient — Admin Console needs real multi-staff access control before it goes near real operations.

### Core rule
Every staff member gets their own individual login. **Never a shared admin account**, regardless of team size.

### Each staff account stores
Name, email, phone number, role, department, permissions, status, last login, password, and optionally 2FA (recommended for all admin-level accounts).

### Roles (starting set — expand as the team grows)

| Role | Can | Cannot |
|---|---|---|
| **Super Admin** | Everything — every module, create staff, assign permissions, change commission settings, approve payouts, access audit logs | — |
| **Rider Operations** | Verify riders, approve rider documents, suspend riders, manage delivery assignments, view rider performance | View company finances, manage vendors, change platform settings |
| **Service Vendor Manager** | Approve/reject service providers, edit profiles, view bookings, suspend providers | View finance, permanently delete providers, manage staff |
| **Product Vendor Manager** | Approve stores/listings for physical-goods providers, manage listings, suspend stores, view product orders | Access finance, manage riders |
| **Customer Support** | View customer accounts, resolve complaints, manage chats, handle disputes, request refunds | Access revenue figures, approve payouts, change system settings |
| **Finance** | Manage escrow, approve payouts, refund customers, view revenue, export reports | Approve vendors, suspend riders, manage staff |
| **Marketing** | Create promotions, manage banners, manage featured providers, create coupons, push notifications, email campaigns *(these features stay behind the Feature Flagging Strategy in PRD.md Section 17 until Phase 2+ — Marketing role exists and can be assigned now even though the features it controls are flagged off)* | Access finance, approve payouts, manage permissions |

### Permission model
Build **permission-based** access underneath the roles above, not role-only. Each individual permission (View Providers, Approve Providers, Edit Providers, Delete Providers, View Revenue, Export Reports, Approve Refunds, Approve Payouts, Suspend Riders, Manage Staff, etc.) should be independently toggleable per staff account. The roles table above is the sensible default bundle, not a hard ceiling — Super Admin should be able to grant or remove individual permissions from any account.

### Audit logs
Every meaningful action gets logged: who performed it, what the action was, which record it affected, and when. Examples: provider approved, refund issued, payout released, commission changed, provider suspended, customer account deleted. Every action must be traceable back to the specific staff account that performed it.

### Authentication requirements for staff accounts
Password reset, email verification, 2FA (recommended for all Admin Console roles, not just Super Admin), session timeout, remote logout, failed-login protection, and visible login history per account.

---

## 5. Customer Experience Additions

These add detail on top of the existing Search & Book flow (PRD.md Section 07) — they don't change which flow is primary (see Section 1 above).

**Vendor card fields** (search results): cover photo, profile photo, provider name, verified badge, rating, completed jobs count, starting price, response time, Book button, Favourite button.

**Provider profile fields**: large cover image, profile picture, about, gallery, videos, packages, pricing, availability calendar, reviews, completed jobs, languages, years of experience, response time, cancellation policy, Book Now button, Chat button, share profile, report provider. Trust indicators (verified badge, completed jobs, on-time rate) should be visually prominent, not buried.

**Escrow trust notice** — show this exact message before payment on every booking: *"Your payment is securely held by Nexa until your event is successfully completed."*

**"My Events," not "My Orders."** Rename this section. Each booking (or Event Project, once Plan My Event is live in Phase 2) becomes its own workspace containing: date, timeline, booked providers, payments, messages, documents, status, and support — not just a flat order record.

**Event Timeline** — a customer-facing, friendly visual timeline layered on top of the existing booking lifecycle states (PRD.md Section 09): Booked → Provider Confirmed → Preparation → Provider En Route / Rider En Route → Event Started → Completed → Payment Released. This is a UI presentation layer over the existing state machine, not a new backend model — map these labels onto the existing Pending/Accepted/In Progress/Completed states rather than building parallel tracking.

**Chat media support** — extend PRD.md Section 08's in-app chat to support images, videos, files, location sharing, and voice notes, not text only.

**Review question wording** — use these exact prompts instead of a single star rating: *Did they arrive on time? Was communication good? Did quality match expectations? Would you hire them again?* — plus an overall rating, written review, and optional photos/videos. This refines, not replaces, the structured review categories already in PRD.md Section 11.

---

## 6. Admin Console Additions

**Dashboard summary cards** (add to PRD.md Section 12's existing dashboard spec): Today's Bookings, Today's Revenue, Escrow Balance, Pending Payouts, Pending Provider Verifications, Pending Rider Verifications, Open Support Tickets, Disputes, Completed Events, Growth Metrics — plus charts and a recent-activity feed.

**Service Vendors vs Product Vendors** — split Provider Management (PRD.md Section 12) into two views in the Admin UI: Service Vendors and Product Vendors, matching the On-site/Vendor-Location Service vs Delivery/Delivery+Return fulfillment types already defined in PRD.md Section 10. This is an organizational split in the Admin interface, not a schema fork — both are still Provider records underneath, just filtered and presented separately since the two groups need different review criteria (a DJ's video portfolio vs. a cake vendor's product photos, for instance).

**Full Admin module list** (supersedes the shorter list in PRD.md Section 12 — merge, don't replace): Dashboard, Customers, Service Vendors, Product Vendors, Riders, Bookings, Events, Orders, Payments, Escrow, Payouts, Disputes, Customer Support, Reviews, Promotions*, Featured Vendors*, Coupons*, Notifications, Reports, Analytics, Staff, Roles & Permissions, Audit Logs, Settings.

*Promotions, Featured Vendors, and Coupons are still flagged off per PRD.md Section 18 — build the module and schema now under the Feature Flagging Strategy (Section 17), but keep them hidden from non-Super-Admin roles until enabled.
