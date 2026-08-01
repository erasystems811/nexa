import { requireProvider, listMyReviews } from "@/modules/provider";
import { Card, CardContent } from "@/components/ui/card";
import { ReplyForm } from "./reply-form";

/** Reviews. Read and reply. */
export default async function StudioReviews() {
  const provider = await requireProvider();
  const reviews = await listMyReviews(provider.id);

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">Reviews</h1>
      <p className="mt-1 text-sm text-muted-foreground">You can reply, but not change the scores.</p>

      {reviews.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="pt-6 text-sm text-muted-foreground">No reviews yet.</CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {reviews.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">
                    Quality {r.quality} · Punctuality {r.punctuality} · Communication {r.communication} · Value{" "}
                    {r.value}
                  </p>
                  {r.comment ? <p className="mt-2 text-sm">{r.comment}</p> : null}

                  {r.provider_reply ? (
                    <div className="mt-3 rounded-lg bg-muted p-3">
                      <p className="text-xs font-medium">Your reply</p>
                      <p className="mt-1 text-sm">{r.provider_reply}</p>
                    </div>
                  ) : (
                    <ReplyForm reviewId={r.id} />
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
