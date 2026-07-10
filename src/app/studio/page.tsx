import { requireRole, signOut } from "@/modules/auth";
import { Button, Card, PageHeader } from "@/components/ui";

/** Nexa Business Studio. PRD Section 13. Never "Vendor Portal" (Section 16). */
export default async function StudioPage() {
  const { profile } = await requireRole("provider");

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <PageHeader
        title="Business Studio"
        subtitle={profile.full_name ? `Signed in as ${profile.full_name}` : undefined}
      />

      <Card>
        <p className="text-sm text-[color:var(--color-ink-muted)]">
          Listings, media, availability, orders, and payouts land here in Phase 1.
          The schema is already in place.
        </p>
      </Card>

      <form action={signOut} className="mt-6">
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </form>
    </main>
  );
}
