// TODO: Group types (74 lines)

export type Group = {
  id: string;
  name: string;
  memberCount: number;
  createdBy: string;
};

export type GroupMember = {
  id: string;
  groupId: string;
  userId: string;
  role: 'admin' | 'member';
};
