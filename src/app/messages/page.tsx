import Link from "next/link";
import { requireSession } from "@/modules/auth";
import { listConversations } from "@/modules/messaging";
import { Card, PageHeader } from "@/components/ui";

/**
 * Shared between the Marketplace and Business Studio. A customer sees their
 * providers here; a provider sees their customers. Same route, same module —
 * RLS decides the rows, not the URL.
 */
export default async function MessagesPage() {
  const { userId } = await requireSession();
  const conversations = await listConversations(userId);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <PageHeader
        title="Messages"
        subtitle="Keep the conversation here. Nexa can only protect a deal it can see."
      />

      {conversations.length === 0 ? (
        <Card className="text-sm text-[color:var(--color-ink-muted)]">
          No conversations yet.
        </Card>
      ) : (
        <ul className="space-y-3">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`}>
                <Card className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.counterpartName}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
                      {c.lastMessageAt
                        ? new Date(c.lastMessageAt).toLocaleString("en-NG")
                        : "No messages yet"}
                    </p>
                  </div>
                  {c.unreadCount > 0 ? (
                    <span className="ml-3 shrink-0 rounded-full bg-[color:var(--color-ink)] px-2.5 py-1 text-xs font-medium text-white">
                      {c.unreadCount}
                    </span>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
