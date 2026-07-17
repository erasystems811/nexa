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
      className="group block overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--color-accent)]/30 hover:shadow-card-hover"
    >
      {vendor.logoUrl ? (
        <Photo
          src={vendor.logoUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 300px"
          className="aspect-[16/10]"
          imageClassName="transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center bg-[color:var(--color-accent-soft)] text-3xl font-semibold text-[color:var(--color-accent)]">
          {vendor.businessName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{vendor.businessName}</p>
          <span
            title="Verified"
            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[9px] text-white"
          >
            ✓
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-[color:var(--color-ink-muted)]">
          {vendor.cityName ? `${vendor.cityName} · ` : ""}
          {vendor.serviceCount} {vendor.serviceCount === 1 ? "service" : "services"}
        </p>

        {vendor.reviewCount > 0 ? (
          <p className="mt-1.5 text-xs font-medium">
            <span className="text-[color:var(--color-star)]">★</span> {vendor.avgRating}
            <span className="font-normal text-[color:var(--color-ink-muted)]">
              {" "}
              · {vendor.reviewCount} {vendor.reviewCount === 1 ? "review" : "reviews"}
            </span>
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-[color:var(--color-ink-muted)]">New on Nexa</p>
        )}
      </div>
    </Link>
  );
}
