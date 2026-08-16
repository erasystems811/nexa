import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { requireProvider, getMyListing, listAvailability } from "@/modules/provider";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AvailabilityManager } from "./availability-manager";

/** Availability calendar.: Available / Booked / Unavailable. */
export default async function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await requireProvider();

  const listing = await getMyListing(provider.id, id);
  if (!listing) notFound();

  const { blocks, booked } = await listAvailability(id);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link href={`/listings/${id}` as Route}>
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
        booked={booked.map((b) => ({
          start: b.scheduled_start,
          end: b.scheduled_end,
        }))}
      />
    </div>
  );
}
