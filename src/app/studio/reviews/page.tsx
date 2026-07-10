import { requireProvider, listMyReviews } from "@/modules/provider";
import { Card, PageHeader } from "@/components/ui";
import { ReplyForm } from "./reply-form";

/** Reviews. PRD Section 13: read and reply. */
export default async function StudioReviews() {
  const provider = await requireProvider();
  const reviews = await listMyReviews(provider.id);

  return (
    <>
      <PageHeader title="Reviews" subtitle="You can reply, but not change the scores." />

      {reviews.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">No reviews yet.</Card>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id}>
              <Card>
                <p className="text-xs text-[color:var(--color-ink-muted)]">
                  Quality {r.quality} · Punctuality {r.punctuality} · Communication{" "}
                  {r.communication} · Value {r.value}
                </p>
                {r.comment ? <p className="mt-2 text-sm">{r.comment}</p> : null}

                {r.provider_reply ? (
                  <div className="mt-3 rounded-lg bg-[color:var(--color-surface-sunk)] p-3">
                    <p className="text-xs font-medium">Your reply</p>
                    <p className="mt-1 text-sm">{r.provider_reply}</p>
                  </div>
                ) : (
                  <ReplyForm reviewId={r.id} />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
