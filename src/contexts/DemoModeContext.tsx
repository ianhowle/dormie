import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'dormie_demo_mode';
const AUTO_DISABLED_KEY = 'dormie_demo_auto_disabled';

type DemoModeContextType = {
  isDemoMode: boolean;
  setDemoMode: (value: boolean) => void;
  checkAndDisable: () => Promise<void>;
  hasRealData: boolean;
};

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: true,
  setDemoMode: () => {},
  checkAndDisable: async () => {},
  hasRealData: false,
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(true); // default true until loaded
  const [loaded, setLoaded] = useState(false);
  const [autoDisabledOnce, setAutoDisabledOnce] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);
  const { user } = useAuth();

  // Load persisted state on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(AUTO_DISABLED_KEY),
    ]).then(([demoVal, autoVal]) => {
      setIsDemoMode(demoVal === null ? true : demoVal === 'true');
      setAutoDisabledOnce(autoVal === 'true');
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

    const detected =
      (roundsRes.data && roundsRes.data.length > 0) ||
      (groupsRes.data && groupsRes.data.length > 0) ||
      (friendsRes.data && friendsRes.data.length > 0) ||
      (tripsRes.data && tripsRes.data.length > 0);

    setHasRealData(!!detected);

    // Auto-disable runs once per install, on first detection of real data.
    // After that, the user owns the toggle (re-enabling for demo/testing
    // shouldn't get clobbered by subsequent fetches).
    if (detected && !autoDisabledOnce) {
      setIsDemoMode(false);
      AsyncStorage.setItem(STORAGE_KEY, 'false');
      setAutoDisabledOnce(true);
      AsyncStorage.setItem(AUTO_DISABLED_KEY, 'true');
    }
  }, [user?.id, autoDisabledOnce]);

  return (
    <DemoModeContext.Provider value={{ isDemoMode: loaded ? isDemoMode : true, setDemoMode, checkAndDisable, hasRealData }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
