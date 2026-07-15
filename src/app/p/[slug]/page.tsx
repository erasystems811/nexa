import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getProviderBySlug } from "@/modules/marketplace";
import { getSession } from "@/modules/auth";
import { formatKobo } from "@/lib/money";
import { Button } from "@/components/ui";
import { BackBar } from "@/components/back-bar";
import { ChatOnWhatsApp, PrivacyNote } from "@/components/chat-cta";

/** Provider profile.+/ */
export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getProviderBySlug(slug);
  if (!result) notFound();

  const session = await getSession();
  const { provider, listings, rating, reviews } = result;
  const cover = (provider as unknown as { cover_url: string | null }).cover_url;
  const logo = (provider as unknown as { logo_url: string | null }).logo_url;
  const cityName = (provider.cities as unknown as { name: string } | null)?.name;
  const providerPath = `/p/${provider.slug}`;

  // "Book this" on a vendor page means their first bookable listing; a vendor
  // with nothing listed yet can still be chatted to.
  const bookable = listings.find((l) => l.price_type === "fixed") ?? listings[0] ?? null;

  return (
    <main className="mx-3 my-3 max-w-2xl overflow-hidden rounded-[1.75rem] border border-[color:var(--color-line)] bg-white shadow-card pb-16 sm:mx-auto sm:my-8">
      {/* Cover */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[color:var(--color-surface-sunk)] sm:aspect-[21/9]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- external provider imagery
          <img src={cover} alt={provider.business_name} className="h-full w-full object-cover" />
        ) : null}
        <BackBar variant="overlay" fallback="/search" />
      </div>

      <div className="px-5">
        {/* Identity */}
        <div className="-mt-8 flex items-end gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-card">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- external provider imagery
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="pb-1">
            <div className="flex items-center gap-1">
              <h1 className="text-xl font-semibold tracking-tight">{provider.business_name}</h1>
              <span title="Verified" className="text-[color:var(--color-accent)]">✓</span>
            </div>
            {cityName ? <p className="text-xs text-[color:var(--color-ink-muted)]">{cityName}</p> : null}
          </div>
        </div>

        {/* Trust row */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Verified provider</Badge>
          {rating?.review_count ? <Badge>{rating.avg_rating} ★ · {rating.review_count} reviews</Badge> : null}
          {provider.is_featured ? <Badge>Featured</Badge> : null}
        </div>

        {provider.description ? (
          <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-ink-muted)]">{provider.description}</p>
        ) : null}

        {/* Something to actually do. The vendor page used to offer nothing at all. */}
        <div className="mt-5 space-y-3">
          {bookable ? (
            <Link href={`/l/${bookable.slug}` as Route} className="block">
              <Button className="w-full">Book this vendor</Button>
            </Link>
          ) : null}
          <ChatOnWhatsApp
            providerId={provider.id}
            signedIn={Boolean(session)}
            next={providerPath}
            variant={bookable ? "ghost" : "primary"}
          />
          <PrivacyNote />
        </div>

        {/* Listings */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">What they offer</h2>
          <ul className="space-y-3">
            {listings.map((l) => {
              const cover = (l as unknown as { coverUrl: string | null }).coverUrl;
              return (
                <li key={l.id}>
                  <Link href={`/l/${l.slug}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white p-3 shadow-card transition hover:shadow-card-hover">
                    <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-surface-sunk)]">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- private storage, signed URL
                        <img src={cover} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[color:var(--color-accent)]">
                      {l.price_type === "fixed" && l.price_kobo !== null ? formatKobo(l.price_kobo) : "On request"}
                    </p>
                  </Link>
                </li>
              );
            })}
            {listings.length === 0 ? (
              <li className="rounded-[var(--radius-card)] border border-dashed border-[color:var(--color-line)] p-6 text-center text-sm text-[color:var(--color-ink-muted)]">No listings yet.</li>
            ) : null}
          </ul>
        </section>

        {reviews.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold">Reviews</h2>
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white p-4">
                  <p className="text-xs text-[color:var(--color-ink-muted)]">
                    Quality {r.quality} · Punctuality {r.punctuality} · Communication {r.communication} · Value {r.value}
                  </p>
                  {r.comment ? <p className="mt-2 text-sm">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[color:var(--color-accent-soft)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-accent)]">
      {children}
    </span>
  );
}
