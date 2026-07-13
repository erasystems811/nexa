import Link from "next/link";
import { requireSession, signOut } from "@/modules/auth";
import { Button, Card, PageHeader } from "@/components/ui";

export default async function AccountPage() {
  const { profile, email } = await requireSession();

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="mb-6 inline-flex items-center text-sm font-medium text-[color:var(--color-ink)]">
        <span aria-hidden="true" className="mr-2">&larr;</span>
        Home
      </Link>
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
