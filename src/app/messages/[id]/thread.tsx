"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  sendMessageAction,
  startCallAction,
  type CallState,
  type SendState,
} from "@/modules/messaging/actions";
import type { ChatMessage } from "@/modules/messaging";

const initialSend: SendState = {};
const initialCall: CallState = {};

export function Thread({
  conversationId,
  viewerId,
  counterpartName,
  initialMessages,
}: {
  conversationId: string;
  viewerId: string;
  counterpartName: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [sendState, sendAction, sending] = useActionState(sendMessageAction, initialSend);
  const [callState, callAction, calling] = useActionState(startCallAction, initialCall);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Realtime, so the other side's message appears without a refresh. The
  // subscription is still governed by RLS — Supabase will not deliver a row the
  // subscriber could not have selected.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string;
            is_flagged: boolean;
            flag_reasons: ChatMessage["flagReasons"] | null;
            read_at: string | null;
            created_at: string;
          };
          setMessages((current) =>
            current.some((m) => m.id === row.id)
              ? current
              : [
                  ...current,
                  {
                    id: row.id,
                    conversationId: row.conversation_id,
                    senderId: row.sender_id,
                    body: row.body,
                    isFlagged: row.is_flagged,
                    flagReasons: row.flag_reasons ?? [],
                    readAt: row.read_at,
                    createdAt: row.created_at,
                  },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!sending && !sendState.error) formRef.current?.reset();
  }, [sending, sendState.error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--color-line)] bg-white/90 px-5 py-4 backdrop-blur">
        <h1 className="text-base font-semibold">{counterpartName}</h1>

        <form action={callAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button
            type="submit"
            disabled={calling}
            className="rounded-full border border-[color:var(--color-line)] px-4 py-2 text-xs font-medium disabled:opacity-40"
          >
            {calling ? "Connecting…" : "Call"}
          </button>
        </form>
      </header>

      {callState.ticket ? (
        <div className="border-b border-[color:var(--color-line)] bg-emerald-50 px-5 py-3 text-sm">
          <p className="font-medium text-[color:var(--color-success)]">
            Dial {callState.ticket.dialNumber}
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--color-ink-muted)]">
            This is a Nexa line, not {counterpartName}&rsquo;s number. It stops working{" "}
            {new Date(callState.ticket.expiresAt).toLocaleTimeString("en-NG")}.
          </p>
        </div>
      ) : null}
      {callState.error ? (
        <p className="border-b border-[color:var(--color-line)] bg-red-50 px-5 py-3 text-sm text-[color:var(--color-danger)]">
          {callState.error}
        </p>
      ) : null}

      <ol className="flex-1 space-y-3 px-5 py-6">
        {messages.map((m) => {
          const mine = m.senderId === viewerId;
          return (
            <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[80%]">
                <div
                  className={[
                    "rounded-2xl px-4 py-2.5 text-sm",
                    mine
                      ? "bg-[color:var(--color-ink)] text-white"
                      : "bg-[color:var(--color-surface-sunk)]",
                  ].join(" ")}
                >
                  {m.body}
                </div>
                {m.isFlagged && mine ? (
                  <p className="mt-1 text-right text-[11px] text-[color:var(--color-danger)]">
                    Flagged for review — keep payments on Nexa
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ol>

      {sendState.warning ? (
        <p className="mx-5 mb-2 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {sendState.warning}
        </p>
      ) : null}
      {sendState.error ? (
        <p className="mx-5 mb-2 rounded-xl bg-red-50 px-4 py-3 text-xs text-[color:var(--color-danger)]">
          {sendState.error}
        </p>
      ) : null}

      <form
        ref={formRef}
        action={sendAction}
        className="sticky bottom-0 flex gap-2 border-t border-[color:var(--color-line)] bg-white px-5 py-3"
      >
        <input type="hidden" name="conversationId" value={conversationId} />
        <input
          name="body"
          autoComplete="off"
          placeholder="Message"
          required
          className="h-12 flex-1 rounded-full border border-[color:var(--color-line)] px-4 outline-none focus:border-[color:var(--color-ink)]"
        />
        <button
          type="submit"
          disabled={sending}
          className="h-12 shrink-0 rounded-full bg-[color:var(--color-ink)] px-5 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
