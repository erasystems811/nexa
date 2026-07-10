import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProvider, getMyListing, listMedia } from "@/modules/provider";
import { listCategories } from "@/modules/marketplace";
import { updateListingAction } from "@/modules/provider/actions";
import { koboToNaira } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { ListingForm } from "../listing-form";
import { ListingControls } from "./listing-controls";
import { MediaManager } from "./media-manager";

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await requireProvider();

  const [listing, categories, media] = await Promise.all([
    getMyListing(provider.id, id),
    listCategories(),
    listMedia(provider.id, id),
  ]);

  if (!listing) notFound();

  return (
    <>
      <PageHeader
        title={listing.title}
        subtitle={listing.status === "approved" ? "Live" : listing.status.replace(/_/g, " ")}
      />

      <ListingControls listingId={listing.id} status={listing.status} />

      <Card className="mt-4">
        <h2 className="mb-4 text-sm font-semibold">Media</h2>
        <MediaManager listingId={listing.id} media={media} />
      </Card>

      <div className="mt-4 flex justify-end">
        <Link href={`/studio/listings/${listing.id}/availability`} className="text-sm underline">
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
            payment_type: listing.payment_type,
            price: listing.price_kobo ? koboToNaira(listing.price_kobo) : undefined,
            price_min: listing.price_min_kobo ? koboToNaira(listing.price_min_kobo) : undefined,
            price_max: listing.price_max_kobo ? koboToNaira(listing.price_max_kobo) : undefined,
            caution_fee: listing.caution_fee_kobo ? koboToNaira(listing.caution_fee_kobo) : undefined,
          }}
        />
      </Card>
    </>
  );
}
