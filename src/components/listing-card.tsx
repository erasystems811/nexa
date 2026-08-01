import Link from "next/link";
import { Photo } from "@/components/photo";
import { formatKobo } from "@/lib/money";
import type { ListingResult } from "@/modules/search";

export function ListingCard({ listing }: { listing: ListingResult }) {
  return (
    <Link
      href={`/l/${listing.slug}`}
      className="group block overflow-hidden rounded-xl border bg-card shadow transition duration-200 hover:-translate-y-0.5 hover:border-primary/30"
    >
      <Photo
        src={listing.coverUrl}
        alt={listing.title}
        fill
        sizes="(max-width: 640px) 50vw, 300px"
        className="aspect-[4/3]"
        imageClassName="transition duration-300 group-hover:scale-[1.03]"
      />
      <div className="p-3">
        <p className="truncate text-sm font-semibold">{listing.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {listing.providerName} · {listing.categoryName}
        </p>
        <p className="mt-2 text-sm font-semibold text-primary">
          {listing.priceType === "fixed" && listing.priceKobo !== null
            ? `from ${formatKobo(listing.priceKobo)}`
            : "Price on request"}
        </p>
      </div>
    </Link>
  );
}
