// TODO: Home feed types (35 lines)

export type FeedItem = {
  id: string;
  type: 'round_completed' | 'trip_created' | 'achievement' | 'dormie_moment';
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};
