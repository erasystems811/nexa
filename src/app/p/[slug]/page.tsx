import Link from "next/link";
import { notFound } from "next/navigation";
import { getProviderBySlug } from "@/modules/marketplace";
import { formatKobo } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";

/** Provider profile. PRD Section 14. */
export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getProviderBySlug(slug);
  if (!result) notFound();

  const { provider, listings, rating, reviews } = result;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <PageHeader
        title={provider.business_name}
        subtitle={provider.description ?? undefined}
      />

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[color:var(--color-surface-sunk)] px-3 py-1.5 text-xs font-medium">
          Verified provider
        </span>
        {rating?.review_count ? (
          <span className="rounded-full bg-[color:var(--color-surface-sunk)] px-3 py-1.5 text-xs font-medium">
            {rating.avg_rating} ★ · {rating.review_count} reviews
          </span>
        ) : null}
        {provider.is_featured ? (
          <span className="rounded-full bg-[color:var(--color-surface-sunk)] px-3 py-1.5 text-xs font-medium">
            Featured
          </span>
        ) : null}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Listings</h2>
        <ul className="mt-3 space-y-3">
          {listings.map((l) => (
            <li key={l.id}>
              <Link href={`/l/${l.slug}`}>
                <Card className="flex items-center justify-between">
                  <p className="text-sm font-medium">{l.title}</p>
                  <p className="text-sm tabular-nums">
                    {l.price_type === "fixed" && l.price_kobo !== null
                      ? formatKobo(l.price_kobo)
                      : "On request"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
          {listings.length === 0 ? (
            <Card className="text-sm text-[color:var(--color-ink-muted)]">
              No approved listings yet.
            </Card>
          ) : null}
        </ul>
      </section>

      {reviews.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">Reviews</h2>
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id}>
                <Card>
                  <p className="text-xs text-[color:var(--color-ink-muted)]">
                    Quality {r.quality} · Punctuality {r.punctuality} · Communication{" "}
                    {r.communication} · Value {r.value}
                  </p>
                  {r.comment ? <p className="mt-2 text-sm">{r.comment}</p> : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
