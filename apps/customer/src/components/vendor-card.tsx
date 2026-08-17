import Link from "next/link";
import type { Route } from "next";
import type { VendorResult } from "@/modules/search";
import { Photo } from "@/components/photo";

/**
 * A vendor, as a customer sees it while browsing: one card for the whole
 * business. Tapping it opens their menu of services at /p/slug. This is the unit
 * of the marketplace — not the individual service — the way a food app shows
 * restaurants, not dishes.
 */
export function VendorCard({ vendor }: { vendor: VendorResult }) {
  return (
    <Link
      href={`/p/${vendor.slug}` as Route}
      className="group block overflow-hidden rounded-2xl border bg-card transition duration-200 hover:-translate-y-0.5 hover:border-primary/30"
    >
      {vendor.logoUrl ? (
        <Photo
          src={vendor.logoUrl}
          alt=""
          fill
          fit="contain"
          sizes="(max-width: 640px) 50vw, 300px"
          className="aspect-square"
          imageClassName="transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex aspect-square items-center justify-center bg-primary/10 text-3xl font-semibold text-primary">
          {vendor.businessName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{vendor.businessName}</p>
          <span
            title="Verified"
            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground"
          >
            ✓
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {vendor.cityName ? `${vendor.cityName} · ` : ""}
          {vendor.serviceCount} {vendor.serviceCount === 1 ? "service" : "services"}
        </p>

        {vendor.reviewCount > 0 ? (
          <p className="mt-1.5 text-xs font-medium">
            <span className="fill-primary text-primary">★</span> {vendor.avgRating}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {vendor.reviewCount} {vendor.reviewCount === 1 ? "review" : "reviews"}
            </span>
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">New on Nexa</p>
        )}
      </div>
    </Link>
  );
}
