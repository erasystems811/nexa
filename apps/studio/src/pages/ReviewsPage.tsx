import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@nexa/design-system/src/components/ui/card";
import { Button } from "@nexa/design-system/src/components/ui/button";
import { Input } from "@nexa/design-system/src/components/ui/input";
import { apiSend, ApiError } from "../lib/api";
import { useApiQuery } from "../lib/query";

interface Review {
  id: string;
  quality: number;
  punctuality: number;
  communication: number;
  value: number;
  comment: string | null;
  provider_reply: string | null;
  provider_replied_at: string | null;
  created_at: string;
}

/** Reviews. Read and reply. */
export function ReviewsPage() {
  const queryClient = useQueryClient();
  const reviewsKey = ["provider-reviews"] as const;
  const { data: reviews } = useApiQuery<Review[]>(reviewsKey, "/provider/reviews");

  if (!reviews) return <div className="text-muted-foreground">Loading…</div>;

  function handleReplied(id: string, reply: string) {
    queryClient.setQueryData<Review[]>(reviewsKey, (prev) =>
      prev
        ? prev.map((r) => (r.id === id ? { ...r, provider_reply: reply, provider_replied_at: new Date().toISOString() } : r))
        : prev,
    );
  }

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
                    <ReplyForm reviewId={r.id} onReplied={(reply) => handleReplied(r.id, reply)} />
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

function ReplyForm({ reviewId, onReplied }: { reviewId: string; onReplied: (reply: string) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const reply = String(form.get("reply") ?? "");

    setPending(true);
    setError(null);
    try {
      await apiSend("PATCH", `/provider/reviews/${reviewId}/reply`, { reply });
      onReplied(reply);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap gap-2">
      <Input name="reply" placeholder="Reply…" required className="h-10 flex-1" />
      <Button type="submit" disabled={pending}>
        Reply
      </Button>
      {error ? <p className="w-full text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
