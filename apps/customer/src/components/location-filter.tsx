"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";

/**
 * Location filter on the results page — free text (an area, an estate, a
 * street), not a fixed city picker. Submits on Enter, same as the search
 * field beside it, and keeps every other active filter untouched.
 */
export function LocationFilter({
  cities,
  defaultValue = "",
}: {
  cities: Array<{ slug: string; name: string }>;
  defaultValue?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <form
      action={(formData) => {
        const next = new URLSearchParams(params.toString());
        const location = String(formData.get("location") ?? "").trim();
        if (location) next.set("location", location);
        else next.delete("location");
        router.push(`/search?${next.toString()}`);
      }}
      className="relative shrink-0"
    >
      <MapPin
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        name="location"
        list="nexa-cities-filter"
        defaultValue={defaultValue}
        placeholder="Any location"
        aria-label="Filter by location"
        className="h-10 w-40 rounded-full border border-input bg-muted pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:bg-card sm:w-48"
      />
      <datalist id="nexa-cities-filter">
        {cities.map((c) => (
          <option key={c.slug} value={c.name} />
        ))}
      </datalist>
    </form>
  );
}
