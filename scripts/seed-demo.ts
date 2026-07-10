/**
 * Seeds a demo account + sample marketplace content so the app looks alive.
 *
 *   npm run seed:demo
 *
 * Everything it creates is prefixed `demo-` (slugs) or `+demo` (emails) so it is
 * easy to find and remove later. This is demo data living in the real database,
 * on purpose — the founder asked to see the marketplace populated.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const IMG = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const DEMO_CUSTOMER = { email: "chideraumeh25+demo@gmail.com", password: "NexaDemo123!", name: "Demo Customer" };

const CATEGORIES = [
  { slug: "demo-djs", name: "DJs & MCs", ft: "onsite_service", icon: "🎧" },
  { slug: "demo-cakes", name: "Cakes", ft: "delivery", icon: "🎂" },
  { slug: "demo-decor", name: "Decor", ft: "onsite_service", icon: "🎈" },
  { slug: "demo-photo", name: "Photography", ft: "onsite_service", icon: "📸" },
  { slug: "demo-catering", name: "Catering", ft: "onsite_service", icon: "🍲" },
  { slug: "demo-rentals", name: "Chairs & Tables", ft: "delivery_return", icon: "🪑" },
] as const;

const PROVIDERS = [
  { cat: "demo-djs", name: "Naija Sound Crew", desc: "High-energy DJs and MCs for weddings, clubs and corporate nights.", img: "1493225457124-a3eb161ffa5f", featured: true, jobs: 84,
    listing: { title: "Headline DJ — 5 hours", price: 150_000, type: "fixed" } },
  { cat: "demo-cakes", name: "Sweet Layers", desc: "Custom celebration cakes, baked fresh and delivered on the day.", img: "1578985545062-69928b1d9587", featured: true, jobs: 152,
    listing: { title: "3-tier celebration cake", price: 45_000, type: "fixed" } },
  { cat: "demo-decor", name: "Bloom & Balloon", desc: "Full event styling — backdrops, balloons, flowers and lighting.", img: "1519167758481-83f550bb49b3", featured: true, jobs: 61,
    listing: { title: "Full event decoration", price: 250_000, type: "negotiable" } },
  { cat: "demo-photo", name: "Frame Studio", desc: "Photographers and videographers who capture the whole day.", img: "1554080353-a576cf803bda", featured: false, jobs: 97,
    listing: { title: "Full-day event coverage", price: 180_000, type: "fixed" } },
  { cat: "demo-catering", name: "Royal Pot Catering", desc: "Jollof, small chops and continental spreads for any guest count.", img: "1555244162-803834f70033", featured: false, jobs: 128,
    listing: { title: "Small chops & jollof — 100 guests", price: 200_000, type: "fixed" } },
  { cat: "demo-rentals", name: "EventGear Rentals", desc: "Chairs, tables, canopies and sound — delivered and collected.", img: "1519741497674-611481863552", featured: false, jobs: 73,
    listing: { title: "200 chairs + 20 tables", price: 120_000, type: "fixed", caution: 50_000 } },
] as const;

async function main() {
  // City
  const { data: city } = await db.from("cities").upsert({ slug: "demo-abuja", name: "Abuja", state: "FCT" }, { onConflict: "slug" }).select("id").single();
  const cityId = city!.id;

  // Categories
  const catIds: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const { data } = await db.from("categories").upsert(
      { slug: c.slug, name: c.name, fulfillment_type: c.ft, icon: c.icon, delivery_mode: c.ft === "delivery" || c.ft === "delivery_return" ? "rider" : "provider" },
      { onConflict: "slug" },
    ).select("id").single();
    catIds[c.slug] = data!.id;
  }

  // Demo customer
  const existing = (await db.auth.admin.listUsers()).data.users.find((u) => u.email === DEMO_CUSTOMER.email);
  if (existing) await db.auth.admin.deleteUser(existing.id).catch(() => {});
  await db.auth.admin.createUser({ email: DEMO_CUSTOMER.email, password: DEMO_CUSTOMER.password, email_confirm: true, user_metadata: { full_name: DEMO_CUSTOMER.name } });

  // Providers + listings
  for (const p of PROVIDERS) {
    const slug = `demo-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const email = `${slug}@gmail.com`;

    const dup = (await db.auth.admin.listUsers()).data.users.find((u) => u.email === email);
    if (dup) await db.auth.admin.deleteUser(dup.id).catch(() => {});
    const { data: user } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: p.name } });
    const userId = user!.user.id;

    const { data: provider } = await db.from("providers").insert({
      user_id: userId, business_name: p.name, slug, description: p.desc, city_id: cityId,
      logo_url: IMG(p.img, 200), cover_url: IMG(p.img, 1200), status: "pending",
    }).select("id").single();
    const providerId = provider!.id;

    // Approve (promotes role, bootstraps wallet/contact/reliability), set terms, bank, featured, trust count.
    await db.from("providers").update({ status: "approved", is_featured: p.featured, is_on_probation: false }).eq("id", providerId);
    await db.from("provider_agreements").insert({ provider_id: providerId, deposit_percent: 30, signed_at: new Date().toISOString() });
    await db.from("provider_wallets").update({ bank_code: "058", bank_account_number: "0123456789", bank_account_name: p.name }).eq("provider_id", providerId);
    await db.from("provider_reliability").update({ completed_bookings: p.jobs, on_time_rate: 96, is_publicly_visible: true }).eq("provider_id", providerId);

    await db.from("listings").insert({
      provider_id: providerId, category_id: catIds[p.cat], title: p.listing.title,
      slug: `${slug}-listing`,
      price_type: p.listing.type,
      payment_type: "full",
      price_kobo: p.listing.type === "fixed" ? p.listing.price * 100 : null,
      price_min_kobo: p.listing.type === "negotiable" ? p.listing.price * 100 : null,
      price_max_kobo: p.listing.type === "negotiable" ? p.listing.price * 2 * 100 : null,
      caution_fee_kobo: ("caution" in p.listing ? (p.listing.caution as number) : 0) * 100,
      status: "approved",
    });
  }

  const { count: providers } = await db.from("providers").select("*", { count: "exact", head: true }).like("slug", "demo-%");
  const { count: listings } = await db.from("listings").select("*", { count: "exact", head: true }).like("slug", "demo-%");
  console.log(`\nSeeded: ${CATEGORIES.length} categories, ${providers} providers, ${listings} listings, 1 demo customer.`);
  console.log(`Demo login → ${DEMO_CUSTOMER.email} / ${DEMO_CUSTOMER.password}`);
}

main().catch((e) => { console.error("SEED FAILED:", e.message); process.exit(1); });
