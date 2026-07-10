import "server-only";

import { createClient } from "@/lib/supabase/server";
import { RiderError } from "./context";
import type { VehicleType } from "@/lib/db/types";

/**
 * Rider registration. PRD Section 15: name, contact, vehicle type, documents;
 * starts Pending Verification, the same discipline as a provider (Section 05).
 *
 * The row is inserted by the applicant's own client, so riders_apply (0011)
 * pins the status to 'pending'. Nobody self-approves; an Admin does that, and
 * only then does sync_rider_role promote the profile to the rider role.
 */
export async function registerRider(input: {
  userId: string;
  fullName: string;
  phone: string;
  vehicleType: VehicleType;
  vehiclePlate?: string;
  cityId?: string | null;
}): Promise<string> {
  if (!input.fullName.trim()) throw new RiderError("Enter your name");
  if (!input.phone.trim()) throw new RiderError("Enter a contact number");

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("riders")
    .insert({
      user_id: input.userId,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      vehicle_type: input.vehicleType,
      vehicle_plate: input.vehiclePlate ?? null,
      city_id: input.cityId ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new RiderError(
      error?.code === "23505"
        ? "You have already registered as a rider"
        : (error?.message ?? "Could not register"),
    );
  }

  return data.id;
}

export async function submitDocument(input: {
  riderId: string;
  kind: string;
  storagePath: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("rider_documents").insert({
    rider_id: input.riderId,
    kind: input.kind,
    storage_path: input.storagePath,
    status: "pending",
  });
  if (error) throw new RiderError(error.message);
}
