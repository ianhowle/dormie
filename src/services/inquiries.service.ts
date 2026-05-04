import { supabase } from '../lib/supabase';

export type WhenWindow = 'next_3_months' | 'this_year' | 'next_year' | 'someday' | 'still_determining';
export type GroupSize = 'just_me' | 'me_plus_1' | 'small_group' | 'big_group' | 'still_determining';
export type BudgetTier =
  | 'under_500'
  | '500_to_1500'
  | '1500_to_3000'
  | '3000_to_5000'
  | '5000_plus'
  | 'variable'
  | 'still_determining';
export type DestinationCategory =
  | 'coastal'
  | 'mountain'
  | 'desert'
  | 'links'
  | 'tropical'
  | 'top_100'
  | 'bucket_list';
export type TripKind =
  | 'bachelor_party'
  | 'annual_friends'
  | 'couples_retreat'
  | 'bucket_list'
  | 'business'
  | 'family'
  | 'other';
export type WhatMatters =
  | 'iconic_courses'
  | 'course_variety'
  | 'off_the_beaten_path'
  | 'resort_experience'
  | 'easy_logistics'
  | 'food_nightlife'
  | 'affordability'
  | 'weather_guarantee';

export interface DreamTripInquiryInput {
  destination_categories: DestinationCategory[];
  destination_text: string | null;
  destination_id: string | null;
  when_window: WhenWindow;
  group_size: GroupSize;
  trip_kinds: TripKind[];
  budget_tier: BudgetTier | null;
  what_matters: WhatMatters[];
  unforgettable_text: string | null;
}

export interface DreamTripInquiry extends DreamTripInquiryInput {
  id: string;
  user_id: string;
  created_at: string;
}

export const inquiriesService = {
  async create(userId: string, input: DreamTripInquiryInput): Promise<DreamTripInquiry> {
    const { data, error } = await supabase
      .from('dream_trip_inquiries')
      .insert({ user_id: userId, ...input })
      .select()
      .single();
    if (error) throw error;
    return data as DreamTripInquiry;
  },

  async listForUser(userId: string): Promise<DreamTripInquiry[]> {
    const { data, error } = await supabase
      .from('dream_trip_inquiries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DreamTripInquiry[];
  },
};
