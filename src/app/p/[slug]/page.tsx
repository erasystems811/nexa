import Link from "next/link";
import { notFound } from "next/navigation";
import { getProviderBySlug } from "@/modules/marketplace";
import { getSession } from "@/modules/auth";
import { formatKobo } from "@/lib/money";
import { ChatOnWhatsApp, PrivacyNote } from "@/components/chat-cta";
import { Photo } from "@/components/photo";
import { Badge } from "@/components/ui/badge";

/** Provider profile. */
export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getProviderBySlug(slug);
  if (!result) notFound();

  const session = await getSession();
  const { provider, listings, rating, reviews } = result;
  // The vendor's own profile images only — their banner and their logo. Never a
  // listing's photo: that belongs to the service, not the business.
  const logo = (provider as unknown as { logo_url: string | null }).logo_url;
  // The big hero image. Vendors upload a profile photo (logo_url), not a separate
  // banner, so fall back to it — otherwise the hero is blank for every vendor.
  const cover = (provider as unknown as { cover_url: string | null }).cover_url ?? logo;
  const cityName = (provider.cities as unknown as { name: string } | null)?.name;
  const providerPath = `/p/${provider.slug}`;

  return (
    <div className="max-w-3xl pb-8">
      {/* Cover */}
      <Photo
        src={cover}
        alt={provider.business_name}
        fill
        priority
        sizes="(max-width: 640px) 100vw, 768px"
        className="aspect-[16/9] rounded-2xl sm:aspect-[21/9]"
      />

      <div className="pt-5">
        {/* Identity — a round avatar that sits beside the name, never over it. */}
        <div className="flex items-center gap-3">
          <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-primary text-lg font-semibold text-primary-foreground">
            {logo ? (
              <Photo src={logo} alt="" fill sizes="64px" className="h-full w-full" />
            ) : (
              provider.business_name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate font-serif text-3xl font-bold text-primary">{provider.business_name}</h1>
              <span title="Verified" className="shrink-0 text-primary">
                ✓
              </span>
            </div>
            {cityName ? <p className="text-sm text-muted-foreground">{cityName}</p> : null}
          </div>
        </div>

        {/* Trust row */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Verified provider</Badge>
          {rating?.review_count ? (
            <Badge>
              {rating.avg_rating} ★ · {rating.review_count} reviews
            </Badge>
          ) : null}
          {provider.is_featured ? <Badge className="bg-accent text-accent-foreground">Featured</Badge> : null}
        </div>

        {provider.description ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">{provider.description}</p>
        ) : null}

        {/* No booking here — a vendor is a business, not a single purchase.
            Talk to them first, or open one of their services below to book it. */}
        <div className="mt-5 max-w-xs space-y-3">
          <ChatOnWhatsApp providerId={provider.id} signedIn={Boolean(session)} next={providerPath} variant="default" />
          <PrivacyNote />
        </div>

        {/* Listings */}
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-xl font-semibold">What they offer</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => {
              const cover = (l as unknown as { coverUrl: string | null }).coverUrl;
              return (
                <li key={l.id}>
                  <Link
                    href={`/l/${l.slug}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow transition hover:border-primary/50"
                  >
                    <div className="size-16 shrink-0">
                      <Photo src={cover} alt="" fill sizes="64px" className="h-full w-full rounded-xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-primary">
                      {l.price_type === "fixed" && l.price_kobo !== null ? formatKobo(l.price_kobo) : "On request"}
                    </p>
                  </Link>
                </li>
              );
            })}
            {listings.length === 0 ? (
              <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2">
                No listings yet.
              </li>
            ) : null}
          </ul>
        </section>

        {reviews.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 font-serif text-xl font-semibold">Reviews</h2>
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">
                    Quality {r.quality} · Punctuality {r.punctuality} · Communication {r.communication} · Value{" "}
                    {r.value}
                  </p>
                  {r.comment ? <p className="mt-2 text-sm">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
