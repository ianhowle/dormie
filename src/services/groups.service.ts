import { supabase } from '../lib/supabase';
import type { Group, GroupMember } from '../data/groups';

type GroupRow = {
  id: string;
  name: string;
  color: string | null;
  created_by: string;
  active_season_id: string | null;
  created_at: string;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  user?: {
    id: string;
    name: string;
    handicap_index: number | null;
    avatar_color?: string | null;
  } | null;
};

export type Role = 'admin' | 'member';

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toGroupMember(row: GroupMemberRow): GroupMember {
  return {
    id: `${row.group_id}:${row.user_id}`,
    userId: row.user_id,
    name: row.user?.name ?? 'Unknown',
    handicap: Number(row.user?.handicap_index ?? 0),
    role: row.role,
    joinedAt: row.joined_at,
    avatarUrl: null,
  };
}

function toGroup(row: GroupRow, members: GroupMember[]): Group {
  return {
    id: row.id,
    name: row.name,
    initials: computeInitials(row.name),
    color: row.color ?? '#006747',
    memberCount: members.length,
    members,
    createdBy: row.created_by,
    activeSeasonId: row.active_season_id,
    createdAt: row.created_at,
  };
}

export const groupsService = {
  /** All groups the user belongs to (as creator or member), with full member rosters. */
  async getUserGroups(userId: string): Promise<Group[]> {
    const { data: memberships, error: memErr } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);
    if (memErr) throw memErr;
    const ids = (memberships ?? []).map((m: any) => m.group_id as string);
    if (ids.length === 0) return [];

    const { data: groupRows, error: gErr } = await supabase
      .from('groups')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: true });
    if (gErr) throw gErr;

    const { data: memberRows, error: mrErr } = await supabase
      .from('group_members')
      .select('group_id, user_id, role, joined_at, user:users(id, name, handicap_index, avatar_color)')
      .in('group_id', ids);
    if (mrErr) throw mrErr;

    const membersByGroup = new Map<string, GroupMember[]>();
    ((memberRows ?? []) as unknown as GroupMemberRow[]).forEach((r) => {
      const list = membersByGroup.get(r.group_id) ?? [];
      list.push(toGroupMember(r));
      membersByGroup.set(r.group_id, list);
    });

    return ((groupRows ?? []) as GroupRow[]).map((g) => toGroup(g, membersByGroup.get(g.id) ?? []));
  },

  async getGroupById(groupId: string): Promise<Group | null> {
    const { data: groupRow, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();
    if (error) throw error;
    if (!groupRow) return null;

    const members = await this.getGroupMembers(groupId);
    return toGroup(groupRow as GroupRow, members);
  },

  /** Creates a group and seeds the creator as the admin member in one flow. */
  async createGroup(name: string, createdBy: string, opts?: { color?: string }): Promise<Group> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Group name required');

    const { data: inserted, error: insErr } = await supabase
      .from('groups')
      .insert({
        name: trimmed,
        color: opts?.color ?? '#006747',
        created_by: createdBy,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    const row = inserted as GroupRow;
    await this.addGroupMember(row.id, createdBy, 'admin');
    const members = await this.getGroupMembers(row.id);
    return toGroup(row, members);
  },

  async addGroupMember(groupId: string, userId: string, role: Role = 'member'): Promise<void> {
    const { error } = await supabase
      .from('group_members')
      .upsert(
        { group_id: groupId, user_id: userId, role },
        { onConflict: 'group_id,user_id' },
      );
    if (error) throw error;
  },

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await supabase
      .from('group_members')
      .select('group_id, user_id, role, joined_at, user:users(id, name, handicap_index, avatar_color)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as GroupMemberRow[]).map(toGroupMember);
  },
};
