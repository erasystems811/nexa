import "server-only";

import { adminDb } from "./context";

/** Customer management. */

export async function listCustomers() {
  const db = adminDb();
  const { data } = await db
    .from("profiles")
    .select("id, full_name, phone, is_suspended, created_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function getCustomerDetail(customerId: string) {
  const db = adminDb();
  const [profile, bookings, disputes] = await Promise.all([
    db.from("profiles").select("*").eq("id", customerId).maybeSingle(),
    db.from("bookings").select("id, reference, status, scheduled_start, agreed_price_kobo, providers ( business_name )").eq("customer_id", customerId).order("scheduled_start", { ascending: false }).limit(30),
    db.from("disputes").select("id, reason, status, created_at").eq("raised_by", customerId).order("created_at", { ascending: false }),
  ]);
  if (!profile.data) return null;
  return { profile: profile.data, bookings: bookings.data ?? [], disputes: disputes.data ?? [] };
}
