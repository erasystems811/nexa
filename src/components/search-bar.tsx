"use client";

import { useRouter, useSearchParams } from "next/navigation";

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
    >
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="DJ, cake, chairs, decorator…"
        aria-label="Search providers and listings"
        className="h-12 w-full rounded-full border border-[color:var(--color-line)] px-5 outline-none focus:border-[color:var(--color-ink)]"
      />
    </form>
  );
}
