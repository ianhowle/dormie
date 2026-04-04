import { supabase } from '../lib/supabase';
import type { Friendship, FriendshipWithUser, User } from '../lib/database.types';

export const friendsService = {
  /** Get all accepted friends for the current user (both directions). */
  async getActiveFriends(userId: string): Promise<FriendshipWithUser[]> {
    const { data: sent, error: e1 } = await supabase
      .from('friendships')
      .select('*, friend:users!friendships_friend_id_fkey(id, name, handicap_index, avatar_color, city, state)')
      .eq('user_id', userId)
      .eq('status', 'accepted');
    if (e1) throw e1;

    const { data: received, error: e2 } = await supabase
      .from('friendships')
      .select('*, friend:users!friendships_user_id_fkey(id, name, handicap_index, avatar_color, city, state)')
      .eq('friend_id', userId)
      .eq('status', 'accepted');
    if (e2) throw e2;

    return [...(sent || []), ...(received || [])] as FriendshipWithUser[];
  },

  /** Get pending friend requests received by this user. */
  async getPendingRequests(userId: string): Promise<FriendshipWithUser[]> {
    const { data, error } = await supabase
      .from('friendships')
      .select('*, friend:users!friendships_user_id_fkey(id, name, handicap_index, avatar_color, city, state)')
      .eq('friend_id', userId)
      .eq('status', 'pending');
    if (error) throw error;
    return data as FriendshipWithUser[];
  },

  /** Send a friend request. */
  async sendRequest(userId: string, friendId: string): Promise<Friendship> {
    const { data, error } = await supabase
      .from('friendships')
      .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    return data as Friendship;
  },

  /** Accept a friend request. */
  async acceptRequest(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    if (error) throw error;
  },

  /** Reject (delete) a friend request. */
  async rejectRequest(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) throw error;
  },

  /** Block a user. */
  async block(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked' })
      .eq('id', friendshipId);
    if (error) throw error;
  },

  /** Remove a friend (delete the friendship row). */
  async removeFriend(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    if (error) throw error;
  },

  /** Get pending friend requests sent by this user. */
  async getSentRequests(userId: string): Promise<FriendshipWithUser[]> {
    const { data, error } = await supabase
      .from('friendships')
      .select('*, friend:users!friendships_friend_id_fkey(id, name, handicap_index, avatar_color, city, state)')
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (error) throw error;
    return data as FriendshipWithUser[];
  },

  /** Search users by name for adding friends. */
  async searchUsers(query: string, limit = 20): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, handicap_index, avatar_color, city, state')
      .ilike('name', `%${query}%`)
      .limit(limit);
    if (error) throw error;
    return data as User[];
  },
};
