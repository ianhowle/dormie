import { supabase } from '../lib/supabase';

export type ChatMessage = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  attachment_url: string | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type ChatMessageWithUser = ChatMessage & {
  user: { id: string; name: string; avatar_color?: string } | null;
};

export const chatService = {
  async sendMessage(args: {
    groupId: string;
    userId: string;
    body: string;
    attachmentUrl?: string;
    replyToId?: string;
  }): Promise<ChatMessage> {
    const trimmed = args.body.trim();
    if (!trimmed && !args.attachmentUrl) throw new Error('Message body required');
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        group_id: args.groupId,
        user_id: args.userId,
        body: trimmed,
        attachment_url: args.attachmentUrl ?? null,
        reply_to_id: args.replyToId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as ChatMessage;
  },

  async getMessages(groupId: string, opts?: { limit?: number; before?: string }): Promise<ChatMessageWithUser[]> {
    let query = supabase
      .from('chat_messages')
      .select('*, user:users(id, name, avatar_color)')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 50);
    if (opts?.before) query = query.lt('created_at', opts.before);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as ChatMessageWithUser[]).reverse();
  },

  async markAsRead(groupId: string, userId: string, lastMessageId?: string | null): Promise<void> {
    await supabase.from('chat_read_receipts').upsert(
      {
        group_id: groupId,
        user_id: userId,
        last_read_message_id: lastMessageId ?? null,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'group_id,user_id' },
    );
  },

  async getUnreadCount(groupId: string, userId: string): Promise<number> {
    const { data: receipt } = await supabase
      .from('chat_read_receipts')
      .select('last_read_at')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();
    const lastReadAt = (receipt as any)?.last_read_at ?? '1970-01-01T00:00:00Z';

    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .gt('created_at', lastReadAt)
      .neq('user_id', userId);

    return count ?? 0;
  },

  async getUnreadCountsByGroup(userId: string, groupIds: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    await Promise.all(
      groupIds.map(async (gid) => {
        result[gid] = await this.getUnreadCount(gid, userId);
      }),
    );
    return result;
  },

  async softDeleteMessage(messageId: string): Promise<void> {
    await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);
  },

  async editMessage(messageId: string, body: string): Promise<void> {
    await supabase
      .from('chat_messages')
      .update({ body, edited_at: new Date().toISOString() })
      .eq('id', messageId);
  },
};
