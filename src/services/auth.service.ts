import { supabase } from '../lib/supabase';

export const authService = {
  async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signUp(email: string, password: string, metadata?: Record<string, unknown>) {
    return supabase.auth.signUp({ email, password, options: { data: metadata } });
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async getSession() {
    return supabase.auth.getSession();
  },

  async getUser() {
    return supabase.auth.getUser();
  },

  async updateProfile(userId: string, updates: Record<string, unknown>) {
    return supabase.from('profiles').update(updates).eq('id', userId);
  },

  async getProfile(userId: string) {
    return supabase.from('profiles').select('*').eq('id', userId).single();
  },
};
