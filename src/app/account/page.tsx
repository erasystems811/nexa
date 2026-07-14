import { requireSession, signOut } from "@/modules/auth";
import { Button, Card, PageHeader } from "@/components/ui";
import { BackBar } from "@/components/back-bar";

export default async function AccountPage() {
  const { profile, email } = await requireSession();

  return (
    <main className="mx-3 my-3 max-w-2xl overflow-hidden rounded-[1.75rem] border border-[color:var(--color-line)] bg-white shadow-card px-5 py-10 sm:mx-auto sm:my-8">
      <BackBar className="mb-6" />
      <PageHeader title="Account" subtitle={email ?? undefined} />

      <Card>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-[color:var(--color-ink-muted)]">Name</dt>
            <dd className="font-medium">{profile.full_name ?? "-"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[color:var(--color-ink-muted)]">Role</dt>
            <dd className="font-medium capitalize">{profile.role}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[color:var(--color-ink-muted)]">Phone</dt>
            <dd className="font-medium">{profile.phone ?? "-"}</dd>
          </div>
        </dl>
      </Card>

      <form action={signOut} className="mt-6">
        <Button type="submit" variant="ghost" className="w-full">
          Sign out
        </Button>
      </form>
    </main>
  );
}
