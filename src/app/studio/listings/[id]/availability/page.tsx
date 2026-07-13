import { notFound } from "next/navigation";
import { requireProvider, getMyListing, listAvailability } from "@/modules/provider";
import { PageHeader } from "@/components/ui";
import { AvailabilityManager } from "./availability-manager";

/** Availability calendar.: Available / Booked / Unavailable. */
export default async function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await requireProvider();

  const listing = await getMyListing(provider.id, id);
  if (!listing) notFound();

  const { blocks, booked } = await listAvailability(id);

  return (
    <>
      <PageHeader
        title="Availability"
        subtitle={listing.title}
      />
      <AvailabilityManager
        listingId={id}
        blocks={blocks}
        booked={booked.map((b) => ({
          start: b.scheduled_start,
          end: b.scheduled_end,
        }))}
      />
    </>
  );
}
