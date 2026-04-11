// Auto-generated types matching the Supabase schema (13 tables)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ── Row types ────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  handicap_index: number;
  low_handicap_index: number | null;
  handicap_last_updated: string | null;
  city: string | null;
  state: string | null;
  avatar_color: string;
  created_at: string;
}

export interface HandicapDifferential {
  id: string;
  user_id: string;
  round_id: string;
  adjusted_gross_score: number;
  course_rating: number;
  slope_rating: number;
  differential: number;
  played_at: string;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}

export interface Course {
  id: string;
  name: string;
  location: string;
  par: number;
  slope: number | null;
  rating: number | null;
  yards: number | null;
  image_gradient: Record<string, unknown> | null;
  hole_data: Record<string, unknown> | null;
  photo_reference: string | null;
  created_at: string;
}

export interface HoleData {
  number: number;
  par: number;
  strokeIndex: number;
  yards: number;
}

export interface Round {
  id: string;
  user_id: string;
  course_id: string;
  gross_score: number;
  net_score: number | null;
  to_par: number;
  hole_scores: HoleScore[] | null;
  source: 'app' | 'manual' | 'ghin';
  trip_id: string | null;
  season_week_id: string | null;
  played_at: string;
  created_at: string;
}

export interface HoleScore {
  hole: number;
  gross: number;
  putts?: number;
  fir?: boolean;
}

export interface Trip {
  id: string;
  name: string;
  location: string;
  city: string | null;
  state: string | null;
  start_date: string;
  end_date: string;
  invite_code: string;
  trip_type: 'quick' | 'planned' | 'ryder';
  format: string | null;
  side_games: Json;
  stakes: string | null;
  status: 'planning' | 'upcoming' | 'active' | 'completed';
  organizer_id: string;
  ryder_cup_config: RyderCupConfig | null;
  gradient: string[];
  created_at: string;
}

export interface RyderCupConfig {
  teamRedName: string;
  teamBlueName: string;
  sessions: Json[];
  formation: string;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  rsvp_status: 'confirmed' | 'pending' | 'declined';
  role: 'organizer' | 'captain' | 'player';
  team: 'red' | 'blue' | null;
  created_at: string;
}

export interface TripCourse {
  id: string;
  trip_id: string;
  course_id: string;
  day_number: number;
  tee_time: string | null;
  confirmed: boolean;
}

export interface TripMessage {
  id: string;
  trip_id: string;
  user_id: string;
  message: string;
  reactions: MessageReaction[];
  created_at: string;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
}

export interface TripMoment {
  id: string;
  trip_id: string;
  user_id: string;
  text: string;
  photo_url: string | null;
  created_at: string;
}

export interface BucketListItem {
  id: string;
  user_id: string;
  course_id: string;
  created_at: string;
  notes: string | null;
}

export type BucketListItemInsert = Pick<BucketListItem, 'user_id' | 'course_id'> &
  Partial<Pick<BucketListItem, 'notes'>>;

export interface Season {
  id: string;
  name: string;
  type: 'fedex' | 'ryder' | 'custom';
  config: Json;
  status: 'draft' | 'active' | 'playoffs' | 'completed';
  creator_id: string;
  created_at: string;
}

export interface SeasonMember {
  id: string;
  season_id: string;
  user_id: string;
  team: string | null;
}

export interface SeasonWeek {
  id: string;
  season_id: string;
  week_number: number;
  format: string;
  multiplier: number;
  is_playoff: boolean;
  is_championship: boolean;
  is_major: boolean;
  major_name: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface SeasonScore {
  id: string;
  season_week_id: string;
  user_id: string;
  round_id: string | null;
  points: number;
  is_counting: boolean;
  participation_bonus: number;
}

// ── Insert types (omit generated fields) ─────────────────────────────

export type UserInsert = Pick<User, 'id' | 'email' | 'name'> &
  Partial<Omit<User, 'id' | 'email' | 'name' | 'created_at'>>;

export type FriendshipInsert = Pick<Friendship, 'user_id' | 'friend_id'> &
  Partial<Pick<Friendship, 'status'>>;

export type CourseInsert = Pick<Course, 'name' | 'location'> &
  Partial<Omit<Course, 'id' | 'name' | 'location' | 'created_at'>>;

export type RoundInsert = Pick<Round, 'user_id' | 'course_id' | 'gross_score'> &
  Partial<Omit<Round, 'id' | 'user_id' | 'course_id' | 'gross_score' | 'to_par' | 'created_at'>>;

export type TripInsert = Pick<Trip, 'name' | 'location' | 'start_date' | 'end_date' | 'organizer_id'> &
  Partial<Omit<Trip, 'id' | 'name' | 'location' | 'start_date' | 'end_date' | 'organizer_id' | 'invite_code' | 'created_at'>>;

export type TripMemberInsert = Pick<TripMember, 'trip_id' | 'user_id'> &
  Partial<Omit<TripMember, 'id' | 'trip_id' | 'user_id' | 'created_at'>>;

export type TripCourseInsert = Pick<TripCourse, 'trip_id' | 'course_id' | 'day_number'> &
  Partial<Omit<TripCourse, 'id' | 'trip_id' | 'course_id' | 'day_number'>>;

export type TripMessageInsert = Pick<TripMessage, 'trip_id' | 'user_id' | 'message'>;

export type TripMomentInsert = Pick<TripMoment, 'trip_id' | 'user_id' | 'text'> &
  Partial<Pick<TripMoment, 'photo_url'>>;

export type SeasonInsert = Pick<Season, 'name' | 'creator_id'> &
  Partial<Omit<Season, 'id' | 'name' | 'creator_id' | 'created_at'>>;

export type SeasonMemberInsert = Pick<SeasonMember, 'season_id' | 'user_id'> &
  Partial<Pick<SeasonMember, 'team'>>;

export type SeasonWeekInsert = Pick<SeasonWeek, 'season_id' | 'week_number'> &
  Partial<Omit<SeasonWeek, 'id' | 'season_id' | 'week_number'>>;

export type SeasonScoreInsert = Pick<SeasonScore, 'season_week_id' | 'user_id' | 'points'> &
  Partial<Pick<SeasonScore, 'round_id' | 'is_counting' | 'participation_bonus'>>;

// ── Update types ─────────────────────────────────────────────────────

export type UserUpdate = Partial<Omit<User, 'id' | 'created_at'>>;
export type RoundUpdate = Partial<Omit<Round, 'id' | 'user_id' | 'to_par' | 'created_at'>>;
export type TripUpdate = Partial<Omit<Trip, 'id' | 'organizer_id' | 'invite_code' | 'created_at'>>;
export type SeasonUpdate = Partial<Omit<Season, 'id' | 'creator_id' | 'created_at'>>;

// ── RPC return types ─────────────────────────────────────────────────

export interface CourseLeaderboardEntry {
  user_id: string;
  user_name: string;
  best_score: number;
  avg_score: number;
  rounds_played: number;
  best_to_par: number;
}

export interface SeasonStandingsEntry {
  user_id: string;
  user_name: string;
  total_points: number;
  weeks_played: number;
  best_finish: number;
}

export interface TripLeaderboardEntry {
  user_id: string;
  user_name: string;
  handicap: number;
  total_gross: number;
  total_net: number;
  rounds_played: number;
  best_round: number;
  scoring_avg: number;
}

export interface UserStats {
  total_rounds: number;
  courses_played: number;
  best_round: number;
  best_round_course: string;
  scoring_avg: number;
  trips_played: number;
}

// ── Joined types (common query shapes) ───────────────────────────────

export interface RoundWithCourse extends Round {
  course: Pick<Course, 'name' | 'city' | 'state' | 'par'>;
}

export interface TripMemberWithUser extends TripMember {
  user: Pick<User, 'id' | 'name' | 'handicap_index' | 'avatar_color'>;
}

export interface TripWithMembers extends Trip {
  trip_members: TripMemberWithUser[];
}

export interface TripMessageWithUser extends TripMessage {
  user: Pick<User, 'id' | 'name' | 'avatar_color'>;
}

export interface FriendshipWithUser extends Friendship {
  friend: Pick<User, 'id' | 'name' | 'handicap_index' | 'avatar_color' | 'city' | 'state'>;
}

export interface SeasonWithMembers extends Season {
  season_members: (SeasonMember & { user: Pick<User, 'id' | 'name' | 'handicap_index' | 'avatar_color'> })[];
}

export interface SeasonWeekWithScores extends SeasonWeek {
  season_scores: (SeasonScore & { user: Pick<User, 'id' | 'name'> })[];
}

export interface TripMomentWithUser extends TripMoment {
  user: Pick<User, 'id' | 'name' | 'avatar_color'>;
}

export interface BucketListItemWithCourse extends BucketListItem {
  course: Pick<Course, 'id' | 'name' | 'location'>;
}
