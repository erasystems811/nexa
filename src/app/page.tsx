import { searchVendors } from "@/modules/search";
import Link from "next/link";
import type { Route } from "next";
import { SearchBar } from "@/components/search-bar";
import { VendorCard } from "@/components/vendor-card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

/**
 * Marketplace home — Nexa's brand/nav chrome lives in the sidebar shell now
 * (see src/components/customer-shell.tsx). Structurally this mirrors the
 * reference's landing.tsx hero (trust badge, serif headline, dual CTA)
 * feeding straight into a plain vendor grid, since browsing here works
 * with or without a session — there's no separate pre-auth landing route.
 */
export default async function HomePage() {
  const vendors = await searchVendors({ limit: 24 });

  return (
    <div className="space-y-12 pb-8">
      <section className="max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
          <ShieldCheck className="size-4" /> The secure event marketplace
        </div>
        <h1 className="font-serif text-5xl font-bold leading-[1.08] tracking-tight text-primary md:text-6xl">
          Perfect events,
          <br />
          protected payments.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Book verified vendors for your next celebration. Nexa holds your payment safely in escrow until the job
          is done right.
        </p>
        <div className="mt-8">
          <SearchBar />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href={"/search" as Route}>
            <Button size="lg">Find a vendor</Button>
          </Link>
          <Link href={"/apply" as Route}>
            <Button size="lg" variant="outline">
              List your business
            </Button>
          </Link>
        </div>
      </section>

      {vendors.length > 0 ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-serif text-xl font-semibold">Vendors on Nexa</h2>
            <Link href={"/search" as Route} className="shrink-0 text-sm font-medium text-primary hover:opacity-80">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {vendors.map((v) => (
              <VendorCard key={v.id} vendor={v} />
            ))}
          </div>
        </section>
      ) : null}

      <footer className="border-t pt-6 text-center text-xs text-muted-foreground">
        <p>
          <Link href="/contact" className="underline hover:text-foreground">
            Contact us
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
