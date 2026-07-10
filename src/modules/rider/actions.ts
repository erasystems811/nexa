"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/modules/auth";
import {
  RiderError,
  acceptAssignment,
  confirmDelivery,
  confirmReturn,
  currentRider,
  declineAssignment,
  markArrived,
  markEnRoute,
  markPickedUp,
  registerRider,
  requireApprovedRider,
  updateRiderBank,
} from ".";
import type { VehicleType } from "@/lib/db/types";

export interface RiderFormState {
  error?: string;
  ok?: boolean;
}

function fail(e: unknown): RiderFormState {
  return { error: e instanceof RiderError ? e.message : "Something went wrong" };
}

/** Registration is open to any signed-in user — a rider is not a role yet. */
export async function registerRiderAction(
  _prev: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const { userId } = await requireSession();
  try {
    await registerRider({
      userId,
      fullName: String(formData.get("full_name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      vehicleType: String(formData.get("vehicle_type") ?? "bike") as VehicleType,
      vehiclePlate: String(formData.get("vehicle_plate") ?? "") || undefined,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/rider");
  redirect("/rider");
}

async function rider() {
  await requireSession();
  return requireApprovedRider();
}

export async function acceptAction(assignmentId: string): Promise<void> {
  const r = await rider();
  await acceptAssignment(r.id, assignmentId);
  revalidatePath("/rider");
}

export async function declineAction(assignmentId: string): Promise<void> {
  const r = await rider();
  await declineAssignment(r.id, assignmentId);
  revalidatePath("/rider");
}

export async function pickedUpAction(assignmentId: string, conditionNotes?: string): Promise<void> {
  const r = await rider();
  await markPickedUp(r.id, assignmentId, conditionNotes);
  revalidatePath(`/rider/${assignmentId}`);
}

export async function enRouteAction(assignmentId: string): Promise<void> {
  const r = await rider();
  await markEnRoute(r.id, assignmentId);
  revalidatePath(`/rider/${assignmentId}`);
}

export async function arrivedAction(assignmentId: string): Promise<void> {
  const r = await rider();
  await markArrived(r.id, assignmentId);
  revalidatePath(`/rider/${assignmentId}`);
}

export async function confirmDeliveryAction(
  assignmentId: string,
  _prev: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const r = await rider();
  const code = String(formData.get("code") ?? "");
  try {
    await confirmDelivery(r.id, assignmentId, code);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/rider");
  redirect("/rider");
}

export async function confirmReturnAction(
  assignmentId: string,
  _prev: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const r = await rider();
  const code = String(formData.get("code") ?? "");
  const damaged = formData.get("damaged") === "on";
  try {
    await confirmReturn(r.id, assignmentId, code, damaged);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/rider");
  redirect("/rider");
}

export async function saveRiderBankAction(
  _prev: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const r = await rider();
  try {
    await updateRiderBank(r.id, {
      bank_code: String(formData.get("bank_code") ?? ""),
      bank_account_number: String(formData.get("bank_account_number") ?? ""),
      bank_account_name: String(formData.get("bank_account_name") ?? ""),
    });
    revalidatePath("/rider/earnings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** For the entry page to decide what to show. */
export async function riderStatus(): Promise<"none" | "pending" | "approved" | "blocked"> {
  const r = await currentRider();
  if (!r) return "none";
  if (r.status === "approved") return "approved";
  if (r.status === "pending") return "pending";
  return "blocked";
}
