import { supabase } from '../lib/supabase';
import type { User, UserUpdate } from '../lib/database.types';

export const authService = {
  async signUp(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getProfile(userId: string): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data as User;
  },

  async updateProfile(userId: string, updates: UserUpdate): Promise<User> {
    console.log('[authService.updateProfile] Starting update for user:', userId, 'updates:', updates);

    // Update the public users table
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      console.log('[authService.updateProfile] Supabase users table error:', error);
      throw error;
    }
    console.log('[authService.updateProfile] Users table updated:', data);

    // Also sync to auth.users metadata so useAuth() reflects changes immediately
    const metadataUpdates: Record<string, unknown> = {};
    if ('name' in updates && updates.name !== undefined) metadataUpdates.name = updates.name;
    if ('city' in updates && updates.city !== undefined) metadataUpdates.city = updates.city;
    if ('state' in updates && updates.state !== undefined) metadataUpdates.state = updates.state;
    if ('handicap_index' in updates && updates.handicap_index !== undefined) metadataUpdates.handicap_index = updates.handicap_index;
    if ('avatar_color' in updates && updates.avatar_color !== undefined) metadataUpdates.avatar_color = updates.avatar_color;

    if (Object.keys(metadataUpdates).length > 0) {
      const { error: authError } = await supabase.auth.updateUser({
        data: metadataUpdates,
      });
      if (authError) {
        console.log('[authService.updateProfile] Auth metadata update error:', authError);
        // Don't throw — the public table was updated successfully
      } else {
        console.log('[authService.updateProfile] Auth metadata synced:', metadataUpdates);
      }
    }

    return data as User;
  },

  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
