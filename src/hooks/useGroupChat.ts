import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { chatService, type ChatMessageWithUser } from '../services/chat.service';

type Options = {
  groupId: string | null;
  userId: string | null;
  pageSize?: number;
};

export function useGroupChat({ groupId, userId, pageSize = 50 }: Options) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestRef = useRef<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const batch = await chatService.getMessages(groupId, { limit: pageSize });
      setMessages(batch);
      oldestRef.current = batch[0]?.created_at ?? null;
      setHasMore(batch.length === pageSize);
    } finally {
      setLoading(false);
    }
  }, [groupId, pageSize]);

  const loadMore = useCallback(async () => {
    if (!groupId || !oldestRef.current || !hasMore) return;
    const more = await chatService.getMessages(groupId, { limit: pageSize, before: oldestRef.current });
    if (more.length === 0) {
      setHasMore(false);
      return;
    }
    setMessages((prev) => [...more, ...prev]);
    oldestRef.current = more[0]?.created_at ?? oldestRef.current;
    if (more.length < pageSize) setHasMore(false);
  }, [groupId, hasMore, pageSize]);

  useEffect(() => {
    setMessages([]);
    oldestRef.current = null;
    setHasMore(true);
    loadInitial();
  }, [groupId, loadInitial]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`chat:${groupId}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` },
        async (payload: any) => {
          const inserted = payload.new;
          if (!inserted) return;
          const { data: withUser } = await supabase
            .from('chat_messages')
            .select('*, user:users(id, name, avatar_color)')
            .eq('id', inserted.id)
            .single();
          if (withUser) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === inserted.id)) return prev;
              return [...prev, withUser as ChatMessageWithUser];
            });
          }
        },
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` },
        (payload: any) => {
          const updated = payload.new;
          if (!updated) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated, user: m.user } : m))
              .filter((m) => !m.deleted_at),
          );
        },
      )
      .subscribe((status: string) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const send = useCallback(
    async (body: string, attachmentUrl?: string, replyToId?: string) => {
      if (!groupId || !userId) return;
      await chatService.sendMessage({ groupId, userId, body, attachmentUrl, replyToId });
    },
    [groupId, userId],
  );

  const markRead = useCallback(async () => {
    if (!groupId || !userId) return;
    const last = messages[messages.length - 1]?.id;
    await chatService.markAsRead(groupId, userId, last);
  }, [groupId, userId, messages]);

  return { messages, loading, isLive, hasMore, loadMore, send, markRead };
}
