import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireProvider, providerIsVerified } from "@/modules/provider";
import { listCategories } from "@/modules/marketplace";
import { createListingAction } from "@/modules/provider/actions";
import { Button, Card, PageHeader } from "@/components/ui";
import { StudioBack } from "@/components/studio-back";
import { ListingForm } from "../listing-form";

export default async function NewListing() {
  const provider = await requireProvider();
  const categories = await listCategories();

  // No category means no admin has opened one yet. Nothing to list.
  if (categories.length === 0) notFound();

  // The gate is enforced in createListing regardless — a server action is a bare
  // endpoint. This is only so a vendor meets it before they fill in a form,
  // rather than after.
  if (!(await providerIsVerified(provider.id))) {
    return (
      <>
        <StudioBack fallback={"/listings" as Route} className="mb-4" />
        <PageHeader title="New listing" />
        <Card>
          <h2 className="text-sm font-semibold">Nexa has to know who you are first</h2>
          <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
            Every vendor on Nexa gives two means of identification, and a person at Nexa looks at
            both. It is what makes a customer trust the booking — and it is why your listing will be
            worth something when it goes up.
          </p>
          <Link href={"/verification" as Route} className="mt-5 block">
            <Button className="w-full">Send your ID</Button>
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <StudioBack fallback={"/listings" as Route} className="mb-4" />
      <PageHeader title="New listing" />
      <ListingForm categories={categories} action={createListingAction} submitLabel="Create listing" showPhotos />
    </>
  );
}
