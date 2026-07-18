import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireProvider, getMyListing, listMedia } from "@/modules/provider";
import { listCategories } from "@/modules/marketplace";
import { updateListingAction } from "@/modules/provider/actions";
import { isEnabled, FLAGS } from "@/modules/settings/flags";
import { koboToNaira } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { StudioBack } from "@/components/studio-back";
import { ListingForm } from "../listing-form";
import { ListingControls } from "./listing-controls";
import { MediaManager } from "./media-manager";

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await requireProvider();

  const [listing, categories, media, negotiableEnabled] = await Promise.all([
    getMyListing(provider.id, id),
    listCategories(),
    listMedia(provider.id, id),
    isEnabled(FLAGS.negotiablePricing, "provider"),
  ]);

  if (!listing) notFound();

  return (
    <>
      <StudioBack fallback={"/listings" as Route} className="mb-4" />
      <PageHeader
        title={listing.title}
        subtitle={listing.status === "approved" ? "Live" : listing.status.replace(/_/g, " ")}
      />

      <ListingControls listingId={listing.id} status={listing.status} />

      <Card className="mt-4">
        <h2 className="mb-4 text-sm font-semibold">Media</h2>
        <MediaManager listingId={listing.id} media={media} live={listing.status === "approved"} />
      </Card>

      <div className="mt-4 flex justify-end">
        <Link href={`/listings/${listing.id}/availability` as Route}  className="text-sm underline">
          Manage availability →
        </Link>
      </div>

      <Card className="mt-4">
        <h2 className="mb-4 text-sm font-semibold">Details</h2>
        <ListingForm
          categories={categories}
          action={updateListingAction.bind(null, listing.id)}
          submitLabel="Save changes"
          defaults={{
            title: listing.title,
            category_id: listing.category_id,
            description: listing.description ?? undefined,
            price_type: listing.price_type,
            price: listing.price_kobo ? koboToNaira(listing.price_kobo) : undefined,
            price_min: listing.price_min_kobo ? koboToNaira(listing.price_min_kobo) : undefined,
            price_max: listing.price_max_kobo ? koboToNaira(listing.price_max_kobo) : undefined,
          }}
          confirmOnSave={
            listing.status === "approved"
              ? "This listing is live. Saving changes sends it back to Nexa for approval, and it stays hidden from customers until Nexa approves it again. Save anyway?"
              : undefined
          }
          negotiableEnabled={negotiableEnabled}
        />
      </Card>
    </>
  );
}
