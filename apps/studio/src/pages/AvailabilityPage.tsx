import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { Listing } from "@nexa/db-types/src/types";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { ApiError } from "../lib/api";
import { useApiQuery } from "../lib/query";
import { AvailabilityManager } from "../components/availability-manager";

interface Block {
  id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
}

interface Booked {
  scheduled_start: string;
  scheduled_end: string | null;
  status: string;
}

/** Availability calendar. Available / Booked / Unavailable. */
export function AvailabilityPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const availabilityKey = ["provider-listing-availability", id] as const;

  const { data: listing, error: listingError } = useApiQuery<Listing>(
    ["provider-listing", id],
    `/provider/listings/${id}`,
    undefined,
    { enabled: !!id },
  );
  const { data: availability } = useApiQuery<{ blocks: Block[]; booked: Booked[] }>(
    availabilityKey,
    `/provider/listings/${id}/availability`,
    undefined,
    { enabled: !!id },
  );

  const refetchAvailability = () => queryClient.invalidateQueries({ queryKey: availabilityKey });

  const notFound = listingError instanceof ApiError && listingError.status === 404;
  if (notFound) return <p className="text-muted-foreground">Listing not found.</p>;
  if (!id || !listing) return <div className="text-muted-foreground">Loading…</div>;

  const blocks = availability?.blocks ?? [];
  const booked = availability?.booked ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link to={`/listings/${id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to listing
        </Button>
      </Link>
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">Availability</h1>
        <p className="text-muted-foreground">{listing.title}</p>
      </div>
      <AvailabilityManager
        listingId={id}
        blocks={blocks}
        booked={booked.map((b) => ({ start: b.scheduled_start, end: b.scheduled_end }))}
        onChanged={refetchAvailability}
      />
    </div>
  );
}
