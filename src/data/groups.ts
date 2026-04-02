// Group types and mock data
// Future: integrate with Supabase `groups` and `group_members` tables

export type GroupMember = {
  id: string;
  userId: string;
  name: string;
  handicap: number;
  role: 'admin' | 'member';
  joinedAt: string;
  avatarUrl: string | null;
};

export type Group = {
  id: string;
  name: string;
  initials: string;
  color: string;
  memberCount: number;
  members: GroupMember[];
  createdBy: string;
  activeSeasonId: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const SATURDAY_CREW_MEMBERS: GroupMember[] = [
  {
    id: 'gm-sc-1',
    userId: 'user-001',
    name: 'Mike Harrington',
    handicap: 8,
    role: 'admin',
    joinedAt: '2023-03-01T10:00:00Z',
    avatarUrl: null,
  },
  {
    id: 'gm-sc-2',
    userId: 'user-002',
    name: 'Dave Kowalski',
    handicap: 14,
    role: 'member',
    joinedAt: '2023-03-05T09:30:00Z',
    avatarUrl: null,
  },
  {
    id: 'gm-sc-3',
    userId: 'user-003',
    name: 'Tom Ellison',
    handicap: 22,
    role: 'member',
    joinedAt: '2023-04-12T11:00:00Z',
    avatarUrl: null,
  },
  {
    id: 'gm-sc-4',
    userId: 'user-004',
    name: 'Carlos Rivera',
    handicap: 5,
    role: 'member',
    joinedAt: '2023-04-20T08:00:00Z',
    avatarUrl: null,
  },
];

const WORK_LEAGUE_MEMBERS: GroupMember[] = [
  {
    id: 'gm-wl-1',
    userId: 'user-005',
    name: 'Sandra Chen',
    handicap: 18,
    role: 'admin',
    joinedAt: '2022-09-01T07:00:00Z',
    avatarUrl: null,
  },
  {
    id: 'gm-wl-2',
    userId: 'user-006',
    name: 'James Thornton',
    handicap: 11,
    role: 'member',
    joinedAt: '2022-09-03T07:00:00Z',
    avatarUrl: null,
  },
  {
    id: 'gm-wl-3',
    userId: 'user-007',
    name: 'Priya Nair',
    handicap: 26,
    role: 'member',
    joinedAt: '2022-10-15T12:00:00Z',
    avatarUrl: null,
  },
  {
    id: 'gm-wl-4',
    userId: 'user-008',
    name: 'Brett Wallace',
    handicap: 7,
    role: 'member',
    joinedAt: '2023-01-10T09:00:00Z',
    avatarUrl: null,
  },
];

const COLLEGE_BUDDIES_MEMBERS: GroupMember[] = [
  {
    id: 'gm-cb-1',
    userId: 'user-009',
    name: 'Ryan O\'Brien',
    handicap: 3,
    role: 'admin',
    joinedAt: '2021-06-15T14:00:00Z',
    avatarUrl: null,
  },
  {
    id: 'gm-cb-2',
    userId: 'user-010',
    name: 'Nate Kimura',
    handicap: 16,
    role: 'member',
    joinedAt: '2021-06-15T14:05:00Z',
    avatarUrl: null,
  },
  {
    id: 'gm-cb-3',
    userId: 'user-011',
    name: 'Will Fitzgerald',
    handicap: 20,
    role: 'member',
    joinedAt: '2021-07-01T10:00:00Z',
    avatarUrl: null,
  },
];

export const MOCK_GROUPS: Group[] = [
  {
    id: 'group-saturday-crew',
    name: 'Saturday Crew',
    initials: 'SC',
    color: '#006747',
    memberCount: 8,
    members: SATURDAY_CREW_MEMBERS,
    createdBy: 'user-001',
    activeSeasonId: 'season-2026-sc',
    createdAt: '2023-03-01T10:00:00Z',
  },
  {
    id: 'group-work-league',
    name: 'Work League',
    initials: 'WL',
    color: '#C9A227',
    memberCount: 12,
    members: WORK_LEAGUE_MEMBERS,
    createdBy: 'user-005',
    activeSeasonId: 'season-2026-wl',
    createdAt: '2022-09-01T07:00:00Z',
  },
  {
    id: 'group-college-buddies',
    name: 'College Buddies',
    initials: 'CB',
    color: '#C41E3A',
    memberCount: 6,
    members: COLLEGE_BUDDIES_MEMBERS,
    createdBy: 'user-009',
    activeSeasonId: null,
    createdAt: '2021-06-15T14:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getGroupById(id: string): Group | undefined {
  return MOCK_GROUPS.find((g) => g.id === id);
}

export function getGroupMembers(groupId: string): GroupMember[] {
  const group = getGroupById(groupId);
  return group ? group.members : [];
}
