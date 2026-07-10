import Link from "next/link";
import { notFound } from "next/navigation";
import { getProviderBySlug } from "@/modules/marketplace";
import { formatKobo } from "@/lib/money";

/** Provider profile. PRD Section 14 + Addendum §3/§5. */
export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getProviderBySlug(slug);
  if (!result) notFound();

  const { provider, listings, rating, reviews } = result;
  const cover = (provider as unknown as { cover_url: string | null }).cover_url;
  const logo = (provider as unknown as { logo_url: string | null }).logo_url;
  const cityName = (provider.cities as unknown as { name: string } | null)?.name;

  return (
    <main className="mx-auto max-w-2xl pb-16">
      {/* Cover */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[color:var(--color-surface-sunk)] sm:aspect-[21/9]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- external provider imagery
          <img src={cover} alt={provider.business_name} className="h-full w-full object-cover" />
        ) : null}
        <Link href="/search" className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium shadow-sm">← Back</Link>
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

        {/* Listings */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">What they offer</h2>
          <ul className="space-y-3">
            {listings.map((l) => (
              <li key={l.id}>
                <Link href={`/l/${l.slug}`} className="flex items-center justify-between rounded-[var(--radius-card)] border border-[color:var(--color-line)] bg-white p-4 shadow-card transition hover:shadow-card-hover">
                  <p className="text-sm font-medium">{l.title}</p>
                  <p className="text-sm font-semibold text-[color:var(--color-accent)]">
                    {l.price_type === "fixed" && l.price_kobo !== null ? formatKobo(l.price_kobo) : "On request"}
                  </p>
                </Link>
              </li>
            ))}
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
