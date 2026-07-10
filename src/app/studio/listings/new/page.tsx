import { notFound } from "next/navigation";
import { requireProvider } from "@/modules/provider";
import { listCategories } from "@/modules/marketplace";
import { createListingAction } from "@/modules/provider/actions";
import { PageHeader } from "@/components/ui";
import { ListingForm } from "../listing-form";

export default async function NewListing() {
  await requireProvider();
  const categories = await listCategories();

  // No category means no admin has opened one yet (Section 01). Nothing to list.
  if (categories.length === 0) notFound();

  return (
    <>
      <PageHeader title="New listing" />
      <ListingForm categories={categories} action={createListingAction} submitLabel="Create listing" />
    </>
  );
}
