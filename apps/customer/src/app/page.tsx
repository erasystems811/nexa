// Ported to api-server (Phase 1 of the monorepo split) — see packages/api-client.
import { searchVendors, listCities } from "@nexa/api-client";
import Link from "next/link";
import type { Route } from "next";
import { HomeSearchBar } from "@/components/home-search-bar";
import { VendorCard } from "@/components/vendor-card";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { ShieldCheck, ArrowRight, Search, MessageCircle, Lock } from "lucide-react";

/**
 * Marketplace home — one page: find a vendor, browse, book. Structurally
 * this mirrors HostelSure's landing page (centered trust badge, centered
 * headline, one two-field search bar, then a left-aligned "browse the
 * newest listings" section below) rather than the reference's app-like
 * hero, since browsing here works with or without a session. Vendors, not
 * items, are the browsing unit — same as HostelSure groups by hostel, not
 * by room: tap a vendor to see everything they sell. A typed search on
 * /search (which this teaser feeds into) switches to items instead.
 */
export default async function HomePage() {
  const [vendors, cities] = await Promise.all([
    searchVendors({ limit: 8 }),
    listCities(),
  ]);

  return (
    <div className="space-y-14 pb-8">
      <section className="mx-auto max-w-3xl pt-4 text-center">
        <Reveal immediate>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            <ShieldCheck className="size-4" /> The secure event marketplace
          </div>
        </Reveal>
        <Reveal immediate delay={100}>
          <h1 className="font-serif text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Find and book
            <br />
            <span className="text-primary underline decoration-accent decoration-[6px] underline-offset-[10px]">
              all you need for your event.
            </span>
          </h1>
        </Reveal>
        <Reveal immediate delay={200}>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Search for verified venues, caterers, rentals, DJs, photographers and more, and book with your payment
            held safe until the job is done.
          </p>
        </Reveal>
        <Reveal immediate delay={300}>
          <div className="mx-auto mt-8 max-w-2xl">
            <HomeSearchBar cities={cities} />
          </div>
        </Reveal>
        <Reveal immediate delay={400}>
          <div className="mt-5">
            <Link href={"/apply" as Route} className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
              List your business on Nexa
            </Link>
          </div>
        </Reveal>
      </section>

      {vendors.length > 0 ? (
        <section>
          <Reveal direction="left">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-semibold">Explore vendors</h2>
                <p className="mt-1 text-sm text-muted-foreground">Browse our newest vendors, verified and reviewed by our team.</p>
              </div>
              <Link href={"/search" as Route} className="shrink-0">
                <Button variant="outline" size="sm">
                  See all vendors <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </Link>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {vendors.map((v, i) => (
              <Reveal key={v.id} delay={i * 60}>
                <VendorCard vendor={v} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <Reveal>
          <div className="text-center">
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">How Nexa works</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              We&rsquo;ve simplified the entire process so you can plan your event from anywhere.
            </p>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: Search,
              title: "1. Browse verified vendors",
              body: "Compare caterers, DJs, decorators and more — each one reviewed by Nexa before they go live.",
            },
            {
              icon: MessageCircle,
              title: "2. Chat with vendors.",
              body: "Message a vendor straight through Nexa, until you're ready to book.",
            },
            {
              icon: Lock,
              title: "3. Book with payment protected",
              body: "Pay through Nexa. The vendor is only paid once the job is done right — never before.",
            },
          ].map((step, i) => (
            <Reveal key={step.title} delay={i * 150}>
              <div className="flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-card text-primary shadow-sm">
                  <step.icon className="size-7" />
                </div>
                <h3 className="mt-4 font-serif text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal direction="right">
        <section className="flex flex-col items-center gap-5 rounded-2xl bg-primary px-6 py-8 text-center text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:text-left">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Are you an event vendor?</h2>
            <p className="mt-1 text-sm text-primary-foreground/80">
              Get in front of customers planning their event, with a verified badge.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
            <Link href={"/apply" as Route}>
              <Button variant="secondary">Apply to list your business</Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                Contact Us
              </Button>
            </Link>
          </div>
        </section>
      </Reveal>

      <footer className="border-t pt-6 text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-serif text-base font-semibold text-foreground">Nexa</p>
            <p className="mt-0.5">Powered by ERA Systems</p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end">
            <Link href={"/search" as Route} className="hover:text-foreground">
              Browse Vendors
            </Link>
            <Link href={"/apply" as Route} className="hover:text-foreground">
              List your business
            </Link>
            <a href="mailto:hello@erasystemsltd.com" className="hover:text-foreground">
              hello@erasystemsltd.com
            </a>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-center sm:text-left">&copy; {new Date().getFullYear()} Nexa</p>
      </footer>
    </div>
  );
}
