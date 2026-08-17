import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock } from "lucide-react";
import type { Category, Listing } from "@nexa/db-types/src/types";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Badge } from "@nexa/design-system/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@nexa/design-system/src/components/ui/card";
import { ApiError } from "../lib/api";
import { useApiQuery } from "../lib/query";
import { isFlagEnabled } from "../lib/flags";
import { ListingForm } from "../components/listing-form";
import { ListingControls } from "../components/listing-controls";
import { MediaManager } from "../components/media-manager";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Live",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  paused: "Paused",
  hidden: "Hidden by Admin",
};

interface Media {
  id: string;
  kind: string;
  status: string;
  url: string | null;
}

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [negotiableEnabled, setNegotiableEnabled] = useState(true);

  const { data: categories } = useApiQuery<Category[]>(["marketplace-categories"], "/marketplace/categories");

  const listingKey = ["provider-listing", id] as const;
  const mediaKey = ["provider-listing-media", id] as const;

  const { data: listing, error: listingError } = useApiQuery<Listing>(
    listingKey,
    `/provider/listings/${id}`,
    undefined,
    { enabled: !!id },
  );
  const { data: media } = useApiQuery<Media[]>(mediaKey, `/provider/listings/${id}/media`, undefined, {
    enabled: !!id,
  });

  useEffect(() => {
    isFlagEnabled("negotiable_pricing", "provider").then(setNegotiableEnabled);
  }, []);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: listingKey });
    queryClient.invalidateQueries({ queryKey: mediaKey });
  };

  const notFound = listingError instanceof ApiError && listingError.status === 404;
  if (notFound) return <p className="text-muted-foreground">Listing not found.</p>;
  if (!id || !listing) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link to="/listings">
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
        <Link to={`/listings/${listing.id}/availability`}>
          <Button variant="outline" size="sm">
            <CalendarClock className="w-4 h-4 mr-2" /> Manage availability
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6">
          <ListingControls listingId={listing.id} status={listing.status} onChanged={refetch} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaManager
            listingId={listing.id}
            media={media ?? []}
            live={listing.status === "approved"}
            onChanged={refetch}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm
            categories={categories ?? []}
            listing={listing}
            submitLabel="Save changes"
            confirmOnSave={
              listing.status === "approved"
                ? "This listing is live. Saving changes sends it back to Nexa for approval, and it stays hidden from customers until Nexa approves it again. Save anyway?"
                : undefined
            }
            negotiableEnabled={negotiableEnabled}
            onSaved={refetch}
          />
        </CardContent>
      </Card>
    </div>
  );
}
