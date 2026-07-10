"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/modules/auth";
import * as admin from ".";
import type { BookingStatus } from "@/lib/db/types";

export interface AdminActionState {
  error?: string;
  ok?: boolean;
}

/** Every action re-checks the admin role; a Server Action is a bare endpoint. */
async function actor(): Promise<string> {
  const { profile } = await requireRole("admin");
  return profile.id;
}

function fail(e: unknown): AdminActionState {
  return { error: e instanceof admin.AdminError ? e.message : e instanceof Error ? e.message : "Something went wrong" };
}

// ---- providers ------------------------------------------------------------

export async function approveProviderAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const id = await actor();
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
  await admin.rejectProvider(await actor(), providerId, reason);
  revalidatePath("/admin/providers");
}
export async function suspendProviderAction(providerId: string, suspended: boolean): Promise<void> {
  await admin.setProviderSuspended(await actor(), providerId, suspended);
  revalidatePath(`/admin/providers/${providerId}`);
}
export async function featureProviderAction(providerId: string, featured: boolean): Promise<void> {
  await admin.setProviderFeatured(await actor(), providerId, featured);
  revalidatePath(`/admin/providers/${providerId}`);
}
export async function removeProviderAction(providerId: string, reason: string): Promise<void> {
  await admin.removeProvider(await actor(), providerId, reason);
  revalidatePath(`/admin/providers/${providerId}`);
}
export async function addProviderAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    await admin.addProviderManually(await actor(), {
      email: String(formData.get("email")),
      businessName: String(formData.get("business_name")),
      depositPercent: Number(formData.get("deposit_percent") ?? 0),
    });
    revalidatePath("/admin/providers");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---- strikes / appeals ----------------------------------------------------

export async function noShowAction(bookingId: string): Promise<void> {
  await admin.recordNoShow(await actor(), bookingId);
  revalidatePath(`/admin/orders/${bookingId}`);
}
export async function resolveAppealAction(strikeId: string, upheld: boolean, providerId: string): Promise<void> {
  await admin.resolveAppeal(await actor(), strikeId, upheld);
  revalidatePath(`/admin/providers/${providerId}`);
}

// ---- riders ---------------------------------------------------------------

export async function verifyRiderAction(riderId: string, approved: boolean, reason?: string): Promise<void> {
  await admin.verifyRider(await actor(), riderId, approved, reason);
  revalidatePath(`/admin/riders/${riderId}`);
}
export async function suspendRiderAction(riderId: string, suspended: boolean): Promise<void> {
  await admin.setRiderSuspended(await actor(), riderId, suspended);
  revalidatePath(`/admin/riders/${riderId}`);
}
export async function reassignDeliveryAction(assignmentId: string, newRiderId: string, bookingId: string): Promise<void> {
  await admin.reassignDelivery(await actor(), assignmentId, newRiderId);
  revalidatePath(`/admin/orders/${bookingId}`);
}

// ---- listings -------------------------------------------------------------

export async function decideListingAction(listingId: string, decision: "approved" | "rejected" | "changes_requested" | "hidden", reason?: string): Promise<void> {
  await admin.decideListing(await actor(), listingId, decision, reason);
  revalidatePath("/admin/listings");
}
export async function restoreListingAction(listingId: string): Promise<void> {
  await admin.restoreListing(await actor(), listingId);
  revalidatePath("/admin/listings");
}

// ---- orders ---------------------------------------------------------------

export async function overrideStatusAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const bookingId = String(formData.get("booking_id"));
    await admin.overrideStatus(await actor(), bookingId, String(formData.get("status")) as BookingStatus, String(formData.get("reason") ?? ""));
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
    await admin.adminApplyPenalty(await actor(), bookingId, Number(formData.get("late_minutes") ?? 0));
    revalidatePath(`/admin/orders/${bookingId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
export async function refundAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const bookingId = String(formData.get("booking_id"));
    await admin.adminRefund(await actor(), bookingId, Math.round(Number(formData.get("amount") ?? 0) * 100), String(formData.get("reason") ?? ""));
    revalidatePath(`/admin/orders/${bookingId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---- disputes -------------------------------------------------------------

export async function resolveDisputeAction(disputeId: string, outcome: "resolved" | "rejected", note: string): Promise<void> {
  await admin.resolveDispute(await actor(), disputeId, outcome, note);
  revalidatePath("/admin/disputes");
}
export async function resolveCautionClaimAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  try {
    const bookingId = String(formData.get("booking_id"));
    await admin.adminResolveCautionClaim(
      await actor(),
      bookingId,
      Math.round(Number(formData.get("claim") ?? 0) * 100),
      String(formData.get("dispute_id") ?? "") || undefined,
    );
    revalidatePath("/admin/disputes");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---- moderation -----------------------------------------------------------

export async function resolveFlagAction(flagId: string, decision: "confirmed" | "dismissed"): Promise<void> {
  await admin.resolveFlag(await actor(), flagId, decision);
  revalidatePath("/admin/moderation");
}
export async function flagToStrikeAction(flagId: string): Promise<void> {
  await admin.convertFlagToStrike(await actor(), flagId);
  revalidatePath("/admin/moderation");
}
