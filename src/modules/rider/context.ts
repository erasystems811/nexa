import "server-only";

import { createClient } from "@/lib/supabase/server";

export class RiderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiderError";
  }
}

/** The signed-in user's rider row, whatever its status, or null. */
export async function currentRider() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("riders")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}

/** Throws unless the caller is an APPROVED rider — for actions on real jobs. */
export async function requireApprovedRider() {
  const rider = await currentRider();
  if (!rider) throw new RiderError("You do not have a rider account");
  if (rider.status !== "approved") throw new RiderError("Your rider account is not approved yet");
  return rider;
}
