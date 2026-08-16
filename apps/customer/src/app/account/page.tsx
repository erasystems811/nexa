import { requireSession, signOut } from "@/modules/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";

export default async function AccountPage() {
  const { profile, email } = await requireSession();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <BackLink />
      <div>
        <h1 className="mb-2 font-serif text-3xl font-bold text-primary">My Profile</h1>
        <p className="text-muted-foreground">{email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{profile.full_name ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-4">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium capitalize">{profile.role}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="font-medium">{profile.phone ?? "-"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
