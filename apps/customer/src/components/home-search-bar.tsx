"use client";

import { useRouter } from "next/navigation";
import { Search, MapPin } from "lucide-react";

/**
 * The homepage's two-field search — what the customer wants, where they want
 * it — matching HostelSure's landing search exactly: one pill-shaped bar,
 * two fields, a primary button attached at the end.
 */
export function HomeSearchBar({ cities }: { cities: Array<{ slug: string; name: string }> }) {
  const router = useRouter();

  return (
    <form
      action={(formData) => {
        const params = new URLSearchParams();
        const q = String(formData.get("q") ?? "").trim();
        const location = String(formData.get("location") ?? "").trim();
        if (q) params.set("q", q);
        if (location) params.set("location", location);
        router.push(`/search?${params.toString()}`);
      }}
      className="flex flex-col gap-2 rounded-2xl border border-input bg-card p-2 shadow-sm sm:flex-row sm:items-center sm:gap-0 sm:rounded-full"
    >
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          name="q"
          placeholder="DJ, cake, chairs, decorator…"
          aria-label="What do you need?"
          className="h-11 w-full rounded-full bg-transparent pl-11 pr-3 text-sm outline-none placeholder:text-muted-foreground sm:h-12"
        />
      </div>

      <div className="hidden h-8 w-px shrink-0 bg-border sm:block" />

      <div className="relative flex-1 sm:max-w-[240px]">
        <MapPin
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          name="location"
          list="nexa-cities"
          placeholder="E.g. Wuse 2, Maitama…"
          aria-label="Where's your event?"
          className="h-11 w-full rounded-full bg-transparent pl-11 pr-3 text-sm outline-none placeholder:text-muted-foreground sm:h-12"
        />
        {/* Suggestions only — any free text (an estate, a street, an area) still submits as typed. */}
        <datalist id="nexa-cities">
          {cities.map((c) => (
            <option key={c.slug} value={c.name} />
          ))}
        </datalist>
      </div>

      <button
        type="submit"
        className="h-11 shrink-0 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90 sm:h-12"
      >
        Search
      </button>
    </form>
  );
}
