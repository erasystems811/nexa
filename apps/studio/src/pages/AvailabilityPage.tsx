import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { Listing } from "@nexa/db-types/src/types";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { apiGet, ApiError } from "../lib/api";
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
  const [listing, setListing] = useState<Listing | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [booked, setBooked] = useState<Booked[]>([]);
  const [notFound, setNotFound] = useState(false);

  const refetchAvailability = useCallback(() => {
    if (!id) return;
    apiGet<{ blocks: Block[]; booked: Booked[] }>(`/provider/listings/${id}/availability`).then((d) => {
      setBlocks(d.blocks);
      setBooked(d.booked);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    apiGet<Listing>(`/provider/listings/${id}`)
      .then(setListing)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      });
    refetchAvailability();
  }, [id, refetchAvailability]);

  if (notFound) return <p className="text-muted-foreground">Listing not found.</p>;
  if (!id || !listing) return <div className="text-muted-foreground">Loading…</div>;

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
