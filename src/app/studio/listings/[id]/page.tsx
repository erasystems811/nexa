import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireProvider, getMyListing, listMedia } from "@/modules/provider";
import { listCategories } from "@/modules/marketplace";
import { updateListingAction } from "@/modules/provider/actions";
import { isEnabled, FLAGS } from "@/modules/settings/flags";
import { koboToNaira } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { ListingForm } from "../listing-form";
import { ListingControls } from "./listing-controls";
import { MediaManager } from "./media-manager";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Live",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  paused: "Paused",
  hidden: "Hidden by Admin",
};

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
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link href={"/listings" as Route}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to listings
        </Button>
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-1">{listing.title}</h1>
          <Badge variant={listing.status === "approved" ? "default" : "secondary"}>
            {STATUS_LABEL[listing.status] ?? listing.status}
          </Badge>
        </div>
        <Link href={`/listings/${listing.id}/availability` as Route}>
          <Button variant="outline" size="sm">
            <CalendarClock className="w-4 h-4 mr-2" /> Manage availability
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6">
          <ListingControls listingId={listing.id} status={listing.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaManager listingId={listing.id} media={media} live={listing.status === "approved"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
