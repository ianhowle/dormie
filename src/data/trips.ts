// TODO: Trip types, invite codes (208 lines)

export type TripStatus = 'planning' | 'upcoming' | 'active' | 'completed';

export type Trip = {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  inviteCode: string;
  isRyderCup: boolean;
  createdBy: string;
};

export type TripMember = {
  id: string;
  tripId: string;
  userId: string;
  role: 'organizer' | 'captain' | 'player';
  team?: 'usa' | 'europe';
};

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function getDaysUntilTrip(startDate: string): number {
  const diff = new Date(startDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
