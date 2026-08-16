import Link from "next/link";
import { listCategories, listCities } from "@/modules/marketplace";
import { ID_TYPES, ACCEPTED_ID_MIME_TYPES } from "@/modules/provider";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplyForm } from "./apply-form";
import { publicEnv } from "@/lib/env";
import { BackLink } from "@/components/back-link";

export const metadata = {
  title: "Become a Nexa vendor",
  description: "Apply to sell your event service on Nexa.",
};

/**
 * The way in. Public, no sign-in — a business cannot be asked to have an account
 * before it is allowed to ask for one.
 */
export default async function ApplyPage() {
  const [categories, cities] = await Promise.all([listCategories(), listCities()]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <BackLink />
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" aria-label="Nexa home">
          <Logo markClassName="size-10 rounded-2xl" textClassName="text-lg" />
        </Link>
        <a
          href={`${publicEnv.NEXT_PUBLIC_STUDIO_APP_URL}/login`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Already a vendor? Sign in
        </a>
      </header>

      <Card>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="font-serif text-2xl">Become a Nexa vendor</CardTitle>
          <CardDescription>
            Tell us about your business. Nexa reviews it, and once you are approved you get
            Business Studio — your listings, your bookings, and your payouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-md bg-accent/10 p-4 text-sm text-accent">
            Customers pay Nexa, not you. Nexa holds the whole amount and pays you once the job is
            done — so you never chase anybody for money.
          </div>

          <ApplyForm
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            cities={cities.map((c) => ({ id: c.id, name: c.name }))}
            idTypes={ID_TYPES.map((t) => ({ value: t.value, label: t.label, needsNumber: t.needsNumber }))}
            acceptedMimeTypes={[...ACCEPTED_ID_MIME_TYPES]}
            // This page lives on the customer app — it is where a vendor finds
            // Nexa. But Business Studio is its own separate app now (apps/studio),
            // so signing in has to send them there, never back into this app.
            vendorLoginUrl={`${publicEnv.NEXT_PUBLIC_STUDIO_APP_URL}/login`}
          />
        </CardContent>
      </Card>
    </main>
  );
}
