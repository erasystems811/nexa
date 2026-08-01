import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireProvider, providerIsVerified } from "@/modules/provider";
import { listCategories } from "@/modules/marketplace";
import { createListingAction } from "@/modules/provider/actions";
import { isEnabled, FLAGS } from "@/modules/settings/flags";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "../listing-form";

export default async function NewListing() {
  const provider = await requireProvider();
  const [categories, negotiableEnabled] = await Promise.all([
    listCategories(),
    isEnabled(FLAGS.negotiablePricing, "provider"),
  ]);

  // No category means no admin has opened one yet. Nothing to list.
  if (categories.length === 0) notFound();

  // The gate is enforced in createListing regardless — a server action is a bare
  // endpoint. This is only so a vendor meets it before they fill in a form,
  // rather than after.
  if (!(await providerIsVerified(provider.id))) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Link href={"/listings" as Route}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to listings
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">New listing</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold">Nexa has to know who you are first</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every vendor on Nexa gives two means of identification, and a person at Nexa looks at
              both. It is what makes a customer trust the booking — and it is why your listing will be
              worth something when it goes up.
            </p>
            <Link href={"/verification" as Route} className="mt-5 block">
              <Button className="w-full">Send your ID</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link href={"/listings" as Route}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to listings
        </Button>
      </Link>
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">New listing</h1>
        <p className="text-muted-foreground">Tell customers what you offer.</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <ListingForm
            categories={categories}
            action={createListingAction}
            submitLabel="Create listing"
            showPhotos
            negotiableEnabled={negotiableEnabled}
          />
        </CardContent>
      </Card>
    </div>
  );
}
