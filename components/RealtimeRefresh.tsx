"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({ conversationId }: { conversationId?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(conversationId ? `conversation-${conversationId}` : "conversations");

    if (conversationId) {
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          () => router.refresh()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
          () => router.refresh()
        );
    } else {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => router.refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => router.refresh());
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, router]);

  return null;
}
