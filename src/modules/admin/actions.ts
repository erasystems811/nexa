"use server";

import { revalidatePath } from "next/cache";
import * as admin from ".";
import { PERMISSIONS as P } from "./permissions";
import type { BookingStatus } from "@/lib/db/types";
import type { Permission, StaffRole } from "./permissions";
import type { SubscriptionStatus } from "./subscriptions";

export interface AdminActionState {
  error?: string;
  ok?: boolean;
  /** The action succeeded, but something the person needs to know did not. */
  warning?: string;
}

/**
 * Every action names the permission it requires and enforces it here — a Server
 * Action is a bare endpoint, so this IS the authorisation boundary, not the
 * hidden button. Returns the acting staff's user id, which every downstream
 * call threads into the audit log: every action tied to an account).
 */
async function actor(permission: Permission): Promise<string> {
  return admin.requirePermission(permission);
}

function fail(e: unknown): AdminActionState {
  return { error: e instanceof admin.AdminError ? e.message : e instanceof Error ? e.message : "Something went wrong" };
}

// ---- providers ------------------------------------------------------------

export async function approveProviderAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const id = await actor(P.providersApprove);
    await admin.approveProvider(id, String(formData.get("provider_id")), {
      depositPercent: Number(formData.get("deposit_percent") ?? 0),
      commissionOverride: formData.get("commission_override") ? Number(formData.get("commission_override")) : null,
      stage1Override: formData.get("stage1_override") ? Number(formData.get("stage1_override")) : null,
      latePenaltyOverride: formData.get("late_penalty_override") ? Number(formData.get("late_penalty_override")) : null,
    });
    revalidatePath("/admin/providers");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function rejectProviderAction(providerId: string, reason: string): Promise<void> {
  await admin.rejectProvider(await actor(P.providersApprove), providerId, reason);
  revalidatePath("/admin/providers");
}
export async function suspendProviderAction(providerId: string, suspended: boolean): Promise<void> {
  await admin.setProviderSuspended(await actor(P.providersSuspend), providerId, suspended);
  revalidatePath(`/admin/providers/${providerId}`);
}
export async function featureProviderAction(providerId: string, featured: boolean): Promise<void> {
  await admin.setProviderFeatured(await actor(P.providersEdit), providerId, featured);
  revalidatePath(`/admin/providers/${providerId}`);
}
export async function removeProviderAction(providerId: string, reason?: string): Promise<void> {
  await admin.removeProvider(await actor(P.providersRemove), providerId, reason ?? "");
  revalidatePath(`/admin/providers/${providerId}`);
}
export async function addProviderAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const result = await admin.addProviderManually(await actor(P.providersApprove), {
      email: String(formData.get("email")),
      businessName: String(formData.get("business_name")),
      depositPercent: Number(formData.get("deposit_percent") ?? 0),
    });
    revalidatePath("/admin/providers");
    return { ok: true, warning: result.warning };
  } catch (e) {
    return fail(e);
  }
}

// ---- strikes / appeals ----------------------------------------------------

export async function noShowAction(bookingId: string): Promise<void> {
  await admin.recordNoShow(await actor(P.providersSuspend), bookingId);
  revalidatePath(`/admin/orders/${bookingId}`);
}
export async function resolveAppealAction(strikeId: string, upheld: boolean, providerId: string): Promise<void> {
  await admin.resolveAppeal(await actor(P.providersSuspend), strikeId, upheld);
  revalidatePath(`/admin/providers/${providerId}`);
}

// ---- listings -------------------------------------------------------------

export async function decideListingAction(listingId: string, decision: "approved" | "rejected" | "changes_requested" | "hidden", reason?: string): Promise<void> {
  await admin.decideListing(await actor(P.listingsApprove), listingId, decision, reason);
  revalidatePath("/admin/listings");
}
export async function restoreListingAction(listingId: string): Promise<void> {
  await admin.restoreListing(await actor(P.listingsApprove), listingId);
  revalidatePath("/admin/listings");
}

// ---- orders ---------------------------------------------------------------

export async function overrideStatusAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const bookingId = String(formData.get("booking_id"));
    await admin.overrideStatus(await actor(P.ordersOverride), bookingId, String(formData.get("status")) as BookingStatus, String(formData.get("reason") ?? ""));
    revalidatePath(`/admin/orders/${bookingId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---- payments -------------------------------------------------------------

export async function applyPenaltyAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const bookingId = String(formData.get("booking_id"));
    await admin.adminApplyPenalty(await actor(P.paymentsPenalty), bookingId, Number(formData.get("late_minutes") ?? 0));
    revalidatePath(`/admin/orders/${bookingId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function refundAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const bookingId = String(formData.get("booking_id"));
    await admin.adminRefund(await actor(P.paymentsRefund), bookingId, Math.round(Number(formData.get("amount") ?? 0) * 100), String(formData.get("reason") ?? ""));
    revalidatePath(`/admin/orders/${bookingId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---- subscriptions (the monthly platform fee) ------------------------------

/**
 * Records a payment Admin has confirmed by hand — a transfer or cash, since
 * Flutterwave cannot auto-bill yet. `amountNaira` comes from the ActionButton
 * prompt; blank means "the amount this vendor is billed", the usual case.
 */
export async function markSubscriptionPaidAction(providerId: string, amountNaira?: string): Promise<void> {
  const id = await actor(P.subscriptionsManage);
  const naira = amountNaira?.trim() ? Number(amountNaira) : undefined;
  if (naira !== undefined && !Number.isFinite(naira)) throw new Error(`"${amountNaira}" is not an amount`);
  await admin.markSubscriptionPaid(id, providerId, naira === undefined ? undefined : Math.round(naira * 100));
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/providers/${providerId}`);
}

export async function setSubscriptionStatusAction(providerId: string, status: SubscriptionStatus): Promise<void> {
  await admin.setSubscriptionStatus(await actor(P.subscriptionsManage), providerId, status);
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/providers/${providerId}`);
}

// ---- disputes -------------------------------------------------------------

export async function resolveDisputeAction(disputeId: string, outcome: "resolved" | "rejected", note: string): Promise<void> {
  await admin.resolveDispute(await actor(P.disputesResolve), disputeId, outcome, note);
  revalidatePath("/admin/disputes");
}

// ---- moderation -----------------------------------------------------------

export async function resolveFlagAction(flagId: string, decision: "confirmed" | "dismissed"): Promise<void> {
  await admin.resolveFlag(await actor(P.moderationResolve), flagId, decision);
  revalidatePath("/admin/moderation");
}
export async function flagToStrikeAction(flagId: string): Promise<void> {
  await admin.convertFlagToStrike(await actor(P.moderationStrike), flagId);
  revalidatePath("/admin/moderation");
}

// ---- staff (needs staff.manage) -------------------------------------------

export async function inviteStaffAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const result = await admin.inviteStaff(await actor(P.staffManage), {
      email: String(formData.get("email")),
      fullName: String(formData.get("full_name")),
      role: String(formData.get("role")) as StaffRole,
      department: String(formData.get("department") ?? "") || undefined,
    });
    revalidatePath("/admin/staff");
    return { ok: true, warning: result.warning };
  } catch (e) {
    return fail(e);
  }
}
export async function setStaffRoleAction(staffId: string, role: StaffRole): Promise<void> {
  await admin.setStaffRole(await actor(P.staffManage), staffId, role);
  revalidatePath(`/admin/staff/${staffId}`);
}
export async function togglePermissionAction(staffId: string, permission: Permission, grant: boolean): Promise<void> {
  await admin.toggleStaffPermission(await actor(P.staffManage), staffId, permission, grant);
  revalidatePath(`/admin/staff/${staffId}`);
}
export async function setStaffStatusAction(staffId: string, status: "active" | "suspended"): Promise<void> {
  await admin.setStaffStatus(await actor(P.staffManage), staffId, status);
  revalidatePath(`/admin/staff/${staffId}`);
}
