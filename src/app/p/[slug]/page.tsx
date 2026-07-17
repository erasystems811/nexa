import Link from "next/link";
import { notFound } from "next/navigation";
import { getProviderBySlug } from "@/modules/marketplace";
import { getSession } from "@/modules/auth";
import { formatKobo } from "@/lib/money";
import { BackBar } from "@/components/back-bar";
import { ChatOnWhatsApp, PrivacyNote } from "@/components/chat-cta";
import { Photo } from "@/components/photo";

/** Provider profile.+/ */
export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getProviderBySlug(slug);
  if (!result) notFound();

  const session = await getSession();
  const { provider, listings, rating, reviews } = result;
  // The vendor's own profile images only — their banner and their logo. Never a
  // listing's photo: that belongs to the service, not the business.
  const cover = (provider as unknown as { cover_url: string | null }).cover_url;
  const logo = (provider as unknown as { logo_url: string | null }).logo_url;
  const cityName = (provider.cities as unknown as { name: string } | null)?.name;
  const providerPath = `/p/${provider.slug}`;

  return (
    <main className="mx-auto max-w-2xl pb-16">
      {/* Cover */}
      <div className="relative">
        <Photo
          src={cover}
          alt={provider.business_name}
          fill
          priority
          sizes="(max-width: 640px) 100vw, 672px"
          className="aspect-[16/9] sm:aspect-[21/9]"
        />
        <BackBar variant="overlay" fallback="/search" />
      </div>

      <div className="px-5 pt-4">
        {/* Identity — a round avatar that sits beside the name, never over it. */}
        <div className="flex items-center gap-3">
          <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-line)] bg-[color:var(--color-accent-soft)] text-lg font-semibold text-[color:var(--color-accent)]">
            {logo ? (
              <Photo src={logo} alt="" fill sizes="56px" className="h-full w-full" />
            ) : (
              provider.business_name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h1 className="truncate text-xl font-semibold tracking-tight">{provider.business_name}</h1>
              <span title="Verified" className="shrink-0 text-[color:var(--color-accent)]">✓</span>
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

        {/* No booking here — a vendor is a business, not a single purchase.
            Talk to them first, or open one of their services below to book it. */}
        <div className="mt-5 space-y-3">
          <ChatOnWhatsApp
            providerId={provider.id}
            signedIn={Boolean(session)}
            next={providerPath}
            variant="primary"
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
                    <div className="size-16 shrink-0">
                      <Photo src={cover} alt="" fill sizes="64px" className="h-full w-full rounded-xl" />
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
