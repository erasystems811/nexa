"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <form
      action={(formData) => {
        const next = new URLSearchParams(params.toString());
        const q = String(formData.get("q") ?? "").trim();
        if (q) next.set("q", q);
        else next.delete("q");
        router.push(`/search?${next.toString()}`);
      }}
      className="relative"
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
      />
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="DJ, cake, chairs, decorator…"
        aria-label="Search providers and listings"
        className="h-12 w-full rounded-full border border-[color:var(--color-line)] bg-black/[0.03] pl-12 pr-5 shadow-sm outline-none transition focus:border-[color:var(--color-ink)] focus:bg-white focus:shadow-md"
      />
    </form>
  );
}
