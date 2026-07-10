import { requireRole, signOut } from "@/modules/auth";
import { Button, Card, PageHeader } from "@/components/ui";

/** Nexa Rider App. PRD Section 15. Assigned deliveries only. */
export default async function RiderPage() {
  const { profile } = await requireRole("rider");

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <PageHeader
        title="Deliveries"
        subtitle={profile.full_name ? `Signed in as ${profile.full_name}` : undefined}
      />

      <Card>
        <p className="text-sm text-[color:var(--color-ink-muted)]">
          Your delivery queue appears here. A delivery completes when the customer
          reads you their confirmation code — never by marking it done.
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
