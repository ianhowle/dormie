import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'dormie_demo_mode';

type DemoModeContextType = {
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
  checkAndDisable: () => Promise<void>;
};

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: true,
  setDemoMode: () => {},
  checkAndDisable: async () => {},
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(true); // default true until loaded
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();

  // Load persisted state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === null) {
        // First launch — default to true
        setIsDemoMode(true);
      } else {
        setIsDemoMode(val === 'true');
      }
      setLoaded(true);
    });
  }, []);

  const setDemoMode = useCallback((value: boolean) => {
    setIsDemoMode(value);
    AsyncStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  const checkAndDisable = useCallback(async () => {
    if (!user) return;

    const [roundsRes, groupsRes, friendsRes, tripsRes] = await Promise.all([
      supabase.from('rounds').select('id').eq('user_id', user.id).limit(1),
      supabase.from('group_members').select('id').eq('user_id', user.id).limit(1),
      supabase
        .from('friendships')
        .select('id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted')
        .limit(1),
      supabase.from('trip_members').select('id').eq('user_id', user.id).limit(1),
    ]);

    const hasRealData =
      (roundsRes.data && roundsRes.data.length > 0) ||
      (groupsRes.data && groupsRes.data.length > 0) ||
      (friendsRes.data && friendsRes.data.length > 0) ||
      (tripsRes.data && tripsRes.data.length > 0);

    if (hasRealData) {
      setIsDemoMode(false);
      AsyncStorage.setItem(STORAGE_KEY, 'false');
    }
  }, [user]);

  return (
    <DemoModeContext.Provider value={{ isDemoMode: loaded ? isDemoMode : true, setDemoMode, checkAndDisable }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
