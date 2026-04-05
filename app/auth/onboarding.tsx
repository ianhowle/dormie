import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
  Share,
  Alert,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/lib/auth';
import { haptics } from '../../src/lib/haptics';
import { GEO } from '../../src/theme/fonts';
import { supabase } from '../../src/lib/supabase';
import { coursesService, type SearchResult } from '../../src/services/courses.service';
import { friendsService } from '../../src/services/friends.service';
import type { User } from '../../src/lib/database.types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Colors (hardcoded dark mode) ──────────────────────────────────
const C = {
  bg: '#0D0A06',
  card: '#1A1816',
  elevated: '#262320',
  text: '#E8E4DE',
  textMuted: '#8A857F',
  gold: '#C9A227',
  augusta: '#006747',
  masters: '#1E4D2B',
  parchment: '#FFFDF5',
  urgent: '#C41E3A',
  border: '#2A2724',
};

// ─── Avatar color options ──────────────────────────────────────────
const INITIALS_COLORS = [
  { key: 'Augusta Green', color: '#046A38' },
  { key: 'Navy', color: '#002366' },
  { key: 'Burgundy', color: '#6B1C2A' },
  { key: 'Forest', color: '#2D6A3F' },
  { key: 'Charcoal', color: '#3C3C3C' },
  { key: 'Royal Blue', color: '#2A5CAD' },
  { key: 'Deep Purple', color: '#4A2D73' },
  { key: 'Copper', color: '#A0522D' },
];

const COURSE_THEMES = [
  { key: 'Augusta', label: 'Augusta', colors: ['#034D28', '#034D28'], textColor: '#C9A227', pattern: 'pinstripes' },
  { key: 'Pebble Beach', label: 'Pebble Beach', colors: ['#1E6494', '#0D3B5C'], textColor: '#FFF', pattern: 'gradient' },
  { key: 'St Andrews', label: 'St Andrews', colors: ['#8B6F47', '#6B5335'], textColor: '#F5F0E8', pattern: 'solid' },
  { key: 'Sawgrass', label: 'Sawgrass', colors: ['#1A7A6A', '#0D5C4F'], textColor: '#FFF', pattern: 'waves' },
  { key: 'Pinehurst', label: 'Pinehurst', colors: ['#C9A227', '#A0820F'], textColor: '#1E4D2B', pattern: 'solid' },
  { key: 'Bandon', label: 'Bandon', colors: ['#6B7B8D', '#4A5A6B'], textColor: '#FFF', pattern: 'solid' },
];

type GolferType = 'competitive' | 'social' | 'improving';

// ─── Pulsing Ghost Row ──────────────────────────────────────────────
function PulsingGhostRow({ children }: { children: React.ReactNode }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.5, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ opacity: pulse }}>{children}</Animated.View>;
}

// ─── Styled TextInput with focus glow ────────────────────────────────
function StyledInput(props: React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={[
        props.style,
        {
          backgroundColor: '#1A1816',
          borderWidth: 1,
          borderColor: focused ? '#C9A227' : '#333',
          borderRadius: 12,
        },
      ]}
    />
  );
}

// ─── Gradient Background with Pinstripe ──────────────────────────────
function GradientBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#0D2818', '#0D0A06']} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
      {/* Subtle pinstripe overlay */}
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: Math.ceil(SCREEN_H / 4) }).map((_, i) => (
          <View
            key={i}
            style={{
              height: 1,
              backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              marginTop: 3,
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Gold Corner Brackets ────────────────────────────────────────────
function GoldCorners({ size = 20, inset = 16 }: { size?: number; inset?: number }) {
  const s = { position: 'absolute' as const, width: size, height: size, borderColor: C.gold };
  return (
    <>
      <View style={[s, { top: inset, left: inset, borderTopWidth: 1, borderLeftWidth: 1 }]} />
      <View style={[s, { top: inset, right: inset, borderTopWidth: 1, borderRightWidth: 1 }]} />
      <View style={[s, { bottom: inset, left: inset, borderBottomWidth: 1, borderLeftWidth: 1 }]} />
      <View style={[s, { bottom: inset, right: inset, borderBottomWidth: 1, borderRightWidth: 1 }]} />
    </>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current
              ? { backgroundColor: C.gold }
              : { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.gold },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Gold Confetti ────────────────────────────────────────────────────
function GoldConfetti({ count = 50 }: { count?: number }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      left: Math.random() * SCREEN_W,
      delay: Math.random() * 2000,
      duration: 2000 + Math.random() * 2000,
      size: 3 + Math.random() * 5,
      isCircle: Math.random() > 0.5,
      rotation: Math.random() * 360,
    }));
  }, [count]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <ConfettiPiece key={i} {...p} />
      ))}
    </View>
  );
}

function ConfettiPiece({ left, delay, duration, size, isCircle, rotation }: {
  left: number; delay: number; duration: number; size: number; isCircle: boolean; rotation: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = () => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }).start(() => loop());
    };
    loop();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-20, SCREEN_H + 20] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: [`${rotation}deg`, `${rotation + 360}deg`] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top: 0,
        width: size,
        height: isCircle ? size : size * 2,
        backgroundColor: Math.random() > 0.3 ? C.gold : '#FFFFFF',
        borderRadius: isCircle ? size / 2 : 1,
        opacity,
        transform: [{ translateY }, { rotate }],
      }}
    />
  );
}

// ─── Mini Avatar (inline, no auth context) ────────────────────────────
function MiniAvatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#E8E4DE', fontFamily: GEO, fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SCREEN 1: THE HOOK
// ═══════════════════════════════════════════════════════════════════════
function Screen1Hook({ userName, onNext, reducedMotion }: { userName: string; onNext: () => void; reducedMotion: boolean }) {
  const [phase, setPhase] = useState<'cinematic' | 'welcome'>(reducedMotion ? 'welcome' : 'cinematic');

  // Cinematic animation values
  const lineWidth = useRef(new Animated.Value(0)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const dormieScale = useRef(new Animated.Value(0.3)).current;
  const dormieOpacity = useRef(new Animated.Value(0)).current;
  const subTextOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Welcome fade values
  const welcomeOpacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const cinematicOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) return;

    // Start the pulse loop for DORMIE text
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    };

    // Cinematic sequence
    const t1 = setTimeout(() => {
      // 500ms: gold line draws
      Animated.timing(lineWidth, { toValue: 200, duration: 800, useNativeDriver: false }).start();
    }, 500);

    const t2 = setTimeout(() => {
      // 1.5s: name fades in
      Animated.timing(nameOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 1500);

    const t3 = setTimeout(() => {
      // 2.5s: DORMIE scales in
      Animated.parallel([
        Animated.timing(dormieOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(dormieScale, { toValue: 1, damping: 12, stiffness: 100, useNativeDriver: true }),
      ]).start();
      startPulse();
    }, 2500);

    const t4 = setTimeout(() => {
      // 3.5s: subtext fades in
      Animated.timing(subTextOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 3500);

    const t5 = setTimeout(() => {
      // 4.5s: gold flash
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.15, duration: 300, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 4500);

    const t6 = setTimeout(() => {
      // 5.5s: crossfade to welcome
      Animated.parallel([
        Animated.timing(cinematicOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(welcomeOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start(() => setPhase('welcome'));
    }, 5500);

    return () => { [t1, t2, t3, t4, t5, t6].forEach(clearTimeout); };
  }, [reducedMotion]);

  const lineWidthInterp = lineWidth.interpolate({ inputRange: [0, 200], outputRange: [0, 200] });

  return (
    <View style={[styles.screenFull, { backgroundColor: C.bg }]}>
      <GradientBg />
      <ExpoStatusBar style="light" />

      {/* Cinematic moment */}
      {phase === 'cinematic' && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: cinematicOpacity, justifyContent: 'center', alignItems: 'center' }]}>
          {/* Gold line */}
          <Animated.View style={{ width: lineWidthInterp, height: 1, backgroundColor: C.gold }} />

          {/* Name text above line */}
          <Animated.Text style={[styles.hookNameText, { opacity: nameOpacity, position: 'absolute', top: SCREEN_H / 2 - 40 }]}>
            {userName} just went
          </Animated.Text>

          {/* DORMIE below line */}
          <Animated.Text style={[styles.hookDormieText, { opacity: dormieOpacity, transform: [{ scale: Animated.multiply(dormieScale, pulseAnim) }], position: 'absolute', top: SCREEN_H / 2 + 10 }]}>
            DORMIE
          </Animated.Text>

          {/* Subtext */}
          <Animated.Text style={[styles.hookSubText, { opacity: subTextOpacity, position: 'absolute', top: SCREEN_H / 2 + 70 }]}>
            3 UP through 15
          </Animated.Text>

          {/* Gold flash overlay */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.gold, opacity: flashOpacity }]} pointerEvents="none" />
        </Animated.View>
      )}

      {/* Welcome content */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: welcomeOpacity, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }]}>
        <GoldCorners size={24} inset={20} />

        <Text style={styles.welcomeLogo}>DORMIE</Text>
        <View style={styles.goldDivider} />
        <Text style={styles.welcomeTagline}>Your crew, always in play.</Text>
        <Text style={styles.welcomeSubTagline}>Score it. Track it. Compete for it.</Text>

        <Pressable onPress={() => { haptics.medium(); onNext(); }} style={({ pressed }) => [styles.greenButton, styles.getStartedBtn, pressed && { opacity: 0.8 }]}>
          <Text style={styles.greenButtonText}>Get Started →</Text>
        </Pressable>
      </Animated.View>

      <ProgressDots current={0} total={4} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SCREEN 2: BUILD YOUR IDENTITY
// ═══════════════════════════════════════════════════════════════════════
function Screen2Identity({
  userName,
  onNext,
  onBack,
  avatarColor,
  setAvatarColor,
  golferType,
  setGolferType,
  handicap,
  setHandicap,
  ghinNumber,
  setGhinNumber,
  ghinVerified,
  setGhinVerified,
  homeCourse,
  setHomeCourse,
  homeCourseName,
  setHomeCourseName,
}: {
  userName: string;
  onNext: () => void;
  onBack: () => void;
  avatarColor: string;
  setAvatarColor: (c: string) => void;
  golferType: GolferType | null;
  setGolferType: (t: GolferType) => void;
  handicap: string;
  setHandicap: (h: string) => void;
  ghinNumber: string;
  setGhinNumber: (g: string) => void;
  ghinVerified: boolean;
  setGhinVerified: (v: boolean) => void;
  homeCourse: SearchResult | null;
  setHomeCourse: (c: SearchResult | null) => void;
  homeCourseName: string;
  setHomeCourseName: (n: string) => void;
}) {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarTab, setAvatarTab] = useState<'initials' | 'themes' | 'photo'>('initials');
  const [showHandicapHelp, setShowHandicapHelp] = useState(false);
  const [courseQuery, setCourseQuery] = useState('');
  const [courseResults, setCourseResults] = useState<SearchResult[]>([]);
  const [courseSearching, setCourseSearching] = useState(false);
  const handicapAnim = useRef(new Animated.Value(handicap ? 1 : 0)).current;
  const courseGlowAnim = useRef(new Animated.Value(0)).current;

  // Debounced course search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (courseQuery.length < 2) { setCourseResults([]); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setCourseSearching(true);
      try {
        const results = await coursesService.searchAll(courseQuery);
        setCourseResults(results);
      } catch { setCourseResults([]); }
      setCourseSearching(false);
    }, 400);
  }, [courseQuery]);

  const handleHandicapChange = (val: string) => {
    setHandicap(val);
    if (val && !handicap) {
      Animated.spring(handicapAnim, { toValue: 1, damping: 15, stiffness: 120, useNativeDriver: true }).start();
    } else if (!val) {
      handicapAnim.setValue(0);
    }
  };

  const handleSelectCourse = (course: SearchResult) => {
    setHomeCourse(course);
    setHomeCourseName(course.name);
    setCourseQuery('');
    setCourseResults([]);
    haptics.success();
    // Gold glow celebration
    Animated.sequence([
      Animated.timing(courseGlowAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(courseGlowAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarColor(`photo:${result.assets[0].uri}`);
    }
  };

  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={[styles.screenFull, { backgroundColor: C.bg }]} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <GradientBg />
        <ExpoStatusBar style="light" />

        {/* Back button */}
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>

        {/* ── Live Profile Preview Card ── */}
        <Animated.View style={[styles.profileCard, { opacity: courseGlowAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1, 1] }) }]}>
          {homeCourse && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.masters, opacity: 0.3 }]} />
          )}
          <LinearGradient colors={['transparent', C.bg]} style={[StyleSheet.absoluteFill, { top: '50%' }]} />

          <View style={styles.profileCardContent}>
            {/* Avatar */}
            {avatarColor.startsWith('photo:') ? (
              <Image source={{ uri: avatarColor.slice(6) }} style={styles.profileAvatar} />
            ) : avatarColor.startsWith('theme:') ? (
              <View style={[styles.profileAvatar, { backgroundColor: COURSE_THEMES.find(t => t.key === avatarColor.slice(6))?.colors[0] ?? C.augusta }]}>
                <Text style={{ color: COURSE_THEMES.find(t => t.key === avatarColor.slice(6))?.textColor ?? '#FFF', fontFamily: GEO, fontWeight: '700', fontSize: 20 }}>{initials}</Text>
              </View>
            ) : (
              <View style={[styles.profileAvatar, { backgroundColor: INITIALS_COLORS.find(c => c.key === avatarColor)?.color ?? C.augusta }]}>
                <Text style={{ color: '#E8E4DE', fontFamily: GEO, fontWeight: '700', fontSize: 20 }}>{initials}</Text>
              </View>
            )}

            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={styles.profileName}>{userName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <Animated.Text style={[styles.profileHandicap, { opacity: handicapAnim, transform: [{ translateY: handicapAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
                  {handicap ? `${handicap} HCP` : '—'}
                </Animated.Text>
                {homeCourseName ? (
                  <Text style={styles.profileCourse} numberOfLines={1}>{homeCourseName}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Gold glow overlay */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.gold, opacity: courseGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }) }]} pointerEvents="none" />
        </Animated.View>

        <View style={{ paddingHorizontal: 20 }}>

          {/* ── Avatar Section ── */}
          <Text style={styles.sectionLabel}>YOUR LOOK</Text>
          <Pressable onPress={() => setShowAvatarPicker(!showAvatarPicker)} style={styles.avatarPickerToggle}>
            {avatarColor.startsWith('photo:') ? (
              <Image source={{ uri: avatarColor.slice(6) }} style={{ width: 56, height: 56, borderRadius: 28 }} />
            ) : (
              <MiniAvatar name={userName} color={INITIALS_COLORS.find(c => c.key === avatarColor)?.color ?? C.augusta} size={56} />
            )}
            <Text style={styles.avatarPickerLabel}>Tap to change</Text>
            <Ionicons name={showAvatarPicker ? 'chevron-up' : 'chevron-down'} size={16} color={C.textMuted} />
          </Pressable>

          {showAvatarPicker && (
            <View style={styles.avatarPickerContent}>
              {/* Tabs */}
              <View style={styles.avatarTabs}>
                {(['initials', 'themes', 'photo'] as const).map(tab => (
                  <Pressable
                    key={tab}
                    onPress={() => setAvatarTab(tab)}
                    style={[styles.avatarTab, avatarTab === tab && { borderBottomColor: C.gold, borderBottomWidth: 2 }]}
                  >
                    <Text style={[styles.avatarTabText, avatarTab === tab && { color: C.gold }]}>
                      {tab === 'initials' ? 'Colors' : tab === 'themes' ? 'Themes' : 'Photo'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {avatarTab === 'initials' && (
                <View style={styles.colorGrid}>
                  {INITIALS_COLORS.map(c => (
                    <Pressable
                      key={c.key}
                      onPress={() => { setAvatarColor(c.key); haptics.light(); }}
                      style={[styles.colorSwatch, { backgroundColor: c.color }, avatarColor === c.key && { borderWidth: 2, borderColor: C.gold }]}
                    >
                      <Text style={{ color: '#E8E4DE', fontFamily: GEO, fontWeight: '700', fontSize: 12 }}>{initials}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {avatarTab === 'themes' && (
                <View style={styles.themeGrid}>
                  {COURSE_THEMES.map(t => (
                    <Pressable
                      key={t.key}
                      onPress={() => { setAvatarColor(`theme:${t.key}`); haptics.light(); }}
                      style={[styles.themeSwatch, avatarColor === `theme:${t.key}` && { borderWidth: 2, borderColor: C.gold }]}
                    >
                      <LinearGradient colors={t.colors as [string, string]} style={styles.themeSwatchInner}>
                        <Text style={{ color: t.textColor, fontFamily: GEO, fontWeight: '700', fontSize: 11 }}>{initials}</Text>
                        <Text style={{ color: t.textColor, fontSize: 8, marginTop: 2, opacity: 0.7 }}>{t.label}</Text>
                      </LinearGradient>
                    </Pressable>
                  ))}
                </View>
              )}

              {avatarTab === 'photo' && (
                <Pressable onPress={pickPhoto} style={styles.photoPickBtn}>
                  <Ionicons name="camera" size={24} color={C.gold} />
                  <Text style={{ color: C.text, marginTop: 8, fontSize: 13 }}>Upload Photo</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ── Golfer Type ── */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>WHAT KIND OF GOLFER ARE YOU?</Text>
          <View style={styles.golferTypeRow}>
            {([
              { key: 'competitive' as GolferType, icon: 'trophy', label: 'Competitive', desc: 'I keep score every round and want to beat my friends' },
              { key: 'social' as GolferType, icon: 'beer', label: 'Social', desc: 'I play for fun but love a good side bet' },
              { key: 'improving' as GolferType, icon: 'trending-up', label: 'Improving', desc: "I'm working on my game and tracking progress" },
            ]).map(g => (
              <Pressable
                key={g.key}
                onPress={() => { setGolferType(g.key); haptics.light(); }}
                style={[styles.golferCard, golferType === g.key && { borderColor: C.gold, borderWidth: 1 }]}
              >
                <Ionicons name={g.icon as any} size={22} color={golferType === g.key ? C.gold : C.textMuted} />
                <Text style={[styles.golferCardTitle, golferType === g.key && { color: C.gold }]}>{g.label}</Text>
                <Text style={styles.golferCardDesc}>{g.desc}</Text>
                {golferType === g.key && (
                  <Ionicons name="checkmark-circle" size={16} color={C.gold} style={{ position: 'absolute', top: 8, right: 8 }} />
                )}
              </Pressable>
            ))}
          </View>

          {/* ── Handicap ── */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>HANDICAP INDEX</Text>
          <StyledInput
            value={handicap}
            onChangeText={handleHandicapChange}
            placeholder="e.g. 8.2"
            placeholderTextColor={C.textMuted}
            keyboardType="decimal-pad"
            style={styles.textInput}
          />
          <Pressable onPress={() => setShowHandicapHelp(!showHandicapHelp)}>
            <Text style={styles.helpLink}>I don't know my handicap →</Text>
          </Pressable>
          {showHandicapHelp && (
            <Text style={styles.helpText}>
              No worries — Dormie will calculate your exact index after your first 3 rounds. If you typically shoot around 90 on a par 72, your handicap is roughly 18.
            </Text>
          )}

          {/* ── GHIN ── */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>GHIN NUMBER (optional)</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StyledInput
              value={ghinNumber}
              onChangeText={setGhinNumber}
              placeholder="1234567"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
              style={[styles.textInput, { flex: 1 }]}
            />
            <Pressable
              onPress={() => { if (ghinNumber.length >= 7) { setGhinVerified(true); haptics.success(); } }}
              style={[styles.verifyBtn, ghinNumber.length < 7 && { opacity: 0.5 }]}
            >
              <Text style={styles.verifyBtnText}>Verify</Text>
            </Pressable>
          </View>
          {ghinVerified && (
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={16} color={C.augusta} />
              <Text style={styles.verifiedText}>GHIN Verified{handicap ? ` — Handicap Index: ${handicap}` : ''}</Text>
            </View>
          )}

          {/* ── Home Course ── */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>HOME COURSE</Text>
          {homeCourse ? (
            <View style={styles.selectedCourse}>
              <Ionicons name="golf" size={18} color={C.augusta} />
              <Text style={styles.selectedCourseName} numberOfLines={1}>{homeCourse.name}</Text>
              <Pressable onPress={() => { setHomeCourse(null); setHomeCourseName(''); }}>
                <Ionicons name="close-circle" size={18} color={C.textMuted} />
              </Pressable>
            </View>
          ) : (
            <>
              <StyledInput
                value={courseQuery}
                onChangeText={setCourseQuery}
                placeholder="Search courses..."
                placeholderTextColor={C.textMuted}
                style={styles.textInput}
              />
              {courseSearching && <ActivityIndicator size="small" color={C.gold} style={{ marginTop: 8 }} />}
              {courseResults.map(course => (
                <Pressable key={course.id} onPress={() => handleSelectCourse(course)} style={styles.courseResultRow}>
                  <Ionicons name="golf" size={16} color={C.augusta} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.courseResultName}>{course.name}</Text>
                    <Text style={styles.courseResultLoc}>{course.city}{course.state ? `, ${course.state}` : ''}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {/* ── Mini Leaderboard Preview ── */}
          <View style={[styles.miniLeaderboard, { marginTop: 28 }]}>
            <View style={styles.miniLbHeaderBar}>
              <Text style={styles.miniLbHeader}>YOUR LEADERBOARD</Text>
            </View>
            <View style={styles.miniLbRow}>
              <Text style={[styles.miniLbPos, { color: C.gold }]}>1</Text>
              <MiniAvatar name={userName} color={INITIALS_COLORS.find(c => c.key === avatarColor)?.color ?? C.augusta} size={28} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.miniLbName}>{userName}</Text>
                <Text style={styles.miniLbDetail}>{handicap ? `${handicap} HCP` : '—'}{homeCourseName ? ` • ${homeCourseName}` : ''}</Text>
              </View>
            </View>
            {[1, 2, 3, 4].map(i => (
              <PulsingGhostRow key={i}>
                <View style={styles.miniLbRow}>
                  <Text style={styles.miniLbPos}>{i + 1}</Text>
                  <View style={[styles.ghostAvatar, { width: 28, height: 28, borderRadius: 14 }]} />
                  <Text style={[styles.miniLbName, { marginLeft: 8, color: C.textMuted }]}>Waiting for your crew...</Text>
                </View>
              </PulsingGhostRow>
            ))}
          </View>
        </View>

        {/* Next button */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Pressable onPress={() => { haptics.medium(); onNext(); }} style={({ pressed }) => [styles.greenButton, pressed && { opacity: 0.8 }]}>
            <Text style={styles.greenButtonText}>Next — Find Your Crew →</Text>
          </Pressable>
        </View>
      </ScrollView>
      <ProgressDots current={1} total={4} />
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SCREEN 3: FIND YOUR CREW
// ═══════════════════════════════════════════════════════════════════════
function Screen3Crew({
  userName,
  avatarColor,
  handicap,
  homeCourseName,
  onNext,
  onBack,
  addedFriends,
  setAddedFriends,
  invitedNames,
  setInvitedNames,
}: {
  userName: string;
  avatarColor: string;
  handicap: string;
  homeCourseName: string;
  onNext: () => void;
  onBack: () => void;
  addedFriends: User[];
  setAddedFriends: (f: User[]) => void;
  invitedNames: string[];
  setInvitedNames: (n: string[]) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const { user } = useAuth();

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await friendsService.searchUsers(searchQuery);
        setSearchResults(results.filter(r => r.id !== user?.id && !addedFriends.some(f => f.id === r.id)));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  }, [searchQuery]);

  const handleShareInvite = async () => {
    haptics.light();
    try {
      await Share.share({
        message: 'Dormie — golf competition app for our crew. Tracks rounds, runs seasons, settles bets. Join up: https://expo.dev (Download Expo Go first)',
      });
    } catch {}
  };

  const handleAddFriend = async (friend: User) => {
    haptics.success();
    setAddedFriends([...addedFriends, friend]);
    setSearchResults(searchResults.filter(r => r.id !== friend.id));
    // Send friend request
    if (user?.id) {
      try { await friendsService.sendRequest(user.id, friend.id); } catch {}
    }
  };

  const allLeaderboardEntries = [
    { name: userName, color: INITIALS_COLORS.find(c => c.key === avatarColor)?.color ?? C.augusta, handicap, isUser: true },
    ...addedFriends.map(f => ({
      name: f.name,
      color: f.avatar_color || C.augusta,
      handicap: f.handicap_index?.toString() ?? '',
      isUser: false,
    })),
    ...invitedNames.map(n => ({ name: n, color: C.elevated, handicap: '', isUser: false, invited: true })),
  ];

  return (
    <View style={[styles.screenFull, { backgroundColor: C.bg }]}>
      <GradientBg />
      <ExpoStatusBar style="light" />

      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={C.text} />
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {/* ── Live Leaderboard ── */}
        <View style={[styles.liveLeaderboard, { marginTop: STATUS_BAR_H + 50 }]}>
          <Text style={styles.lbHeader}>LEADERBOARD</Text>
          {allLeaderboardEntries.map((entry, i) => (
            <Animated.View key={entry.name + i} style={styles.lbRow}>
              <Text style={styles.lbPos}>{i + 1}</Text>
              <MiniAvatar name={entry.name} color={entry.color} size={32} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.lbName, entry.isUser && { color: C.gold }]}>{entry.name}</Text>
                {(entry as any).invited ? (
                  <Text style={styles.lbInvited}>Invited — pending</Text>
                ) : entry.handicap ? (
                  <Text style={styles.lbHcp}>{entry.handicap} HCP</Text>
                ) : null}
              </View>
            </Animated.View>
          ))}
          {allLeaderboardEntries.length < 5 && Array.from({ length: 5 - allLeaderboardEntries.length }).map((_, i) => (
            <View key={`ghost-${i}`} style={[styles.lbRow, { opacity: 0.2 }]}>
              <Text style={styles.lbPos}>{allLeaderboardEntries.length + i + 1}</Text>
              <View style={[styles.ghostAvatar, { width: 32, height: 32, borderRadius: 16 }]} />
              <Text style={[styles.lbName, { marginLeft: 10, color: C.textMuted }]}>—</Text>
            </View>
          ))}
        </View>

        <Text style={styles.crewHeaderText}>Dormie is built for your golf crew, anywhere.</Text>

        {/* ── Add Crew Methods ── */}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {/* Share invite */}
          <Pressable onPress={handleShareInvite} style={styles.crewCard}>
            <Ionicons name="share-outline" size={22} color={C.gold} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.crewCardTitle}>Share Invite Link</Text>
              <Text style={styles.crewCardDesc}>Send a link to your golf crew</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </Pressable>

          {/* Search by name */}
          <View style={styles.crewCard}>
            <Ionicons name="search" size={22} color={C.gold} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.crewCardTitle}>Search by Name</Text>
              <StyledInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Find friends on Dormie..."
                placeholderTextColor={C.textMuted}
                style={styles.inlineSearchInput}
              />
            </View>
          </View>

          {searching && <ActivityIndicator size="small" color={C.gold} />}

          {searchResults.map(result => (
            <View key={result.id} style={styles.searchResultRow}>
              <MiniAvatar name={result.name} color={result.avatar_color || C.augusta} size={36} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: C.text, fontFamily: GEO, fontSize: 14 }}>{result.name}</Text>
                {result.handicap_index > 0 && <Text style={{ color: C.textMuted, fontSize: 12 }}>{result.handicap_index} HCP</Text>}
              </View>
              <Pressable onPress={() => handleAddFriend(result)} style={styles.addFriendBtn}>
                <Ionicons name="person-add" size={14} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>Add</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* Reassurance */}
        <Text style={styles.reassuranceText}>
          Your crew can join anytime. Dormie works solo too — when your crew joins, the competition comes alive.
        </Text>

        {/* Skip link */}
        <Pressable onPress={() => { haptics.light(); onNext(); }}>
          <Text style={styles.skipLink}>Skip — add friends later</Text>
        </Pressable>

        {/* Next button */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Pressable onPress={() => { haptics.medium(); onNext(); }} style={({ pressed }) => [styles.greenButton, pressed && { opacity: 0.8 }]}>
            <Text style={styles.greenButtonText}>Next — See What Awaits →</Text>
          </Pressable>
        </View>
      </ScrollView>
      <ProgressDots current={2} total={4} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SCREEN 4: THE MONTAGE
// ═══════════════════════════════════════════════════════════════════════
function Screen4Montage({ userName, onComplete, onBack, reducedMotion }: { userName: string; onComplete: () => void; onBack: () => void; reducedMotion: boolean }) {
  const [currentMoment, setCurrentMoment] = useState(0);
  const [showEnterButton, setShowEnterButton] = useState(false);
  const fadeAnims = useRef(Array.from({ length: 7 }, () => new Animated.Value(0))).current;
  const enterBtnAnim = useRef(new Animated.Value(0)).current;
  const enterPulse = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MOMENT_DURATION = 2500;
  const CROSSFADE = 300;

  const advanceToMoment = useCallback((idx: number) => {
    if (idx >= 7) {
      // Show enter button on the last moment
      setShowEnterButton(true);
      Animated.timing(enterBtnAnim, { toValue: 1, duration: 500, delay: 2000, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(enterPulse, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
          Animated.timing(enterPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
      return;
    }
    setCurrentMoment(idx);

    // Fade in current
    Animated.timing(fadeAnims[idx], { toValue: 1, duration: CROSSFADE, useNativeDriver: true }).start();

    // Schedule fade out and advance
    timerRef.current = setTimeout(() => {
      Animated.timing(fadeAnims[idx], { toValue: 0, duration: CROSSFADE, useNativeDriver: true }).start();
      setTimeout(() => advanceToMoment(idx + 1), CROSSFADE);
    }, MOMENT_DURATION);
  }, [fadeAnims]);

  useEffect(() => {
    if (reducedMotion) {
      // Skip to the last moment immediately
      setCurrentMoment(6);
      fadeAnims[6].setValue(1);
      setShowEnterButton(true);
      enterBtnAnim.setValue(1);
      return;
    }
    advanceToMoment(0);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleTap = () => {
    if (showEnterButton) return;
    // Advance to next moment on tap
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(fadeAnims[currentMoment], { toValue: 0, duration: 150, useNativeDriver: true }).start();
    setTimeout(() => advanceToMoment(currentMoment + 1), 150);
  };

  return (
    <Pressable style={[styles.screenFull, { backgroundColor: C.bg }]} onPress={handleTap}>
      <GradientBg />
      <ExpoStatusBar style="light" />

      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={C.text} />
      </Pressable>

      {/* Skip button */}
      <Pressable onPress={onComplete} style={styles.skipBtn} hitSlop={12}>
        <Text style={styles.skipBtnText}>Skip</Text>
      </Pressable>

      {/* MOMENT 1: Leaderboard Drop */}
      <Animated.View style={[styles.momentFull, { opacity: fadeAnims[0] }]} pointerEvents="none">
        <View style={styles.momentLeaderboard}>
          {['Jack N.', 'Tiger W.', 'Ben H.', 'Arnold P.', 'Bobby J.'].map((name, i) => (
            <View key={name} style={styles.momentLbRow}>
              <Text style={[styles.momentLbPos, i === 0 && { color: C.gold }]}>{i + 1}</Text>
              <MiniAvatar name={name} color={i === 0 ? C.gold : C.masters} size={28} />
              <Text style={[styles.momentLbName, i === 0 && { color: C.gold }]}>{name}</Text>
              <Text style={[styles.momentLbScore, i === 0 && { color: C.gold }]}>{[-4, -3, -2, -1, 'E'][i]}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* MOMENT 2: The Dormie Moment */}
      <Animated.View style={[styles.momentFull, { opacity: fadeAnims[1] }]} pointerEvents="none">
        <GoldCorners size={30} inset={30} />
        <Text style={styles.momentDormieText}>DORMIE</Text>
        <Text style={styles.momentDormieSub}>3 UP • 3 TO PLAY</Text>
      </Animated.View>

      {/* MOMENT 3: Skins Jackpot */}
      <Animated.View style={[styles.momentFull, { opacity: fadeAnims[2] }]} pointerEvents="none">
        <Ionicons name="cash" size={48} color={C.gold} />
        <Text style={styles.momentBigText}>SKINS JACKPOT</Text>
        <Text style={styles.momentSubText}>4 SKINS ON HOLE 14</Text>
      </Animated.View>

      {/* MOMENT 4: Head to Head */}
      <Animated.View style={[styles.momentFull, { opacity: fadeAnims[3] }]} pointerEvents="none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <MiniAvatar name="You" color={C.augusta} size={56} />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.momentH2HRecord}>5 — 3</Text>
            <Text style={styles.momentH2HLabel}>ALL-TIME RECORD</Text>
          </View>
          <MiniAvatar name="Rival" color={C.urgent} size={56} />
        </View>
      </Animated.View>

      {/* MOMENT 5: Ryder Cup */}
      <Animated.View style={[styles.momentFull, { opacity: fadeAnims[4] }]} pointerEvents="none">
        <View style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
          <View style={[styles.ryderHalf, { backgroundColor: '#C41E3A22' }]}>
            <Text style={[styles.ryderTeam, { color: C.urgent }]}>TEAM RED</Text>
          </View>
          <View style={[styles.ryderHalf, { backgroundColor: '#00674722' }]}>
            <Text style={[styles.ryderTeam, { color: C.augusta }]}>TEAM BLUE</Text>
          </View>
        </View>
        <View style={styles.ryderScoreOverlay}>
          <Text style={styles.ryderScore}>14 — 10</Text>
        </View>
      </Animated.View>

      {/* MOMENT 6: Season Champion */}
      <Animated.View style={[styles.momentFull, { opacity: fadeAnims[5] }]} pointerEvents="none">
        <GoldConfetti count={40} />
        <Ionicons name="trophy" size={64} color={C.gold} />
        <Text style={styles.momentBigText}>FEDEX CUP CHAMPION</Text>
        <Text style={styles.momentSubText}>SEASON 1 COMPLETE</Text>
      </Animated.View>

      {/* MOMENT 7: The Welcome */}
      <Animated.View style={[styles.momentFull, { opacity: fadeAnims[6] }]} pointerEvents="none">
        <GoldConfetti count={60} />
        <Text style={styles.welcomeUserText}>Welcome, {userName}.</Text>
        <Text style={styles.welcomeUserSub}>Your crew, always in play.</Text>
      </Animated.View>

      {/* Enter Dormie Button */}
      {showEnterButton && (
        <Animated.View style={[styles.enterBtnWrap, { opacity: enterBtnAnim, transform: [{ scale: enterPulse }] }]}>
          <Pressable onPress={() => { haptics.heavy(); onComplete(); }} style={({ pressed }) => [styles.enterBtn, pressed && { opacity: 0.8 }]}>
            <Text style={styles.enterBtnText}>Enter Dormie →</Text>
          </Pressable>
        </Animated.View>
      )}

      <ProgressDots current={3} total={4} />
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN ONBOARDING COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function OnboardingScreen() {
  const [screen, setScreen] = useState(0);
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  // State persisted across screens
  const [avatarColor, setAvatarColor] = useState('Augusta Green');
  const [golferType, setGolferType] = useState<GolferType | null>(null);
  const [handicap, setHandicap] = useState('');
  const [ghinNumber, setGhinNumber] = useState('');
  const [ghinVerified, setGhinVerified] = useState(false);
  const [homeCourse, setHomeCourse] = useState<SearchResult | null>(null);
  const [homeCourseName, setHomeCourseName] = useState('');
  const [addedFriends, setAddedFriends] = useState<User[]>([]);
  const [invitedNames, setInvitedNames] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Screen transition animation
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Golfer';

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
  }, []);

  const transitionTo = useCallback((nextScreen: number) => {
    if (reducedMotion) {
      setScreen(nextScreen);
      return;
    }
    Animated.timing(screenOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setScreen(nextScreen);
      Animated.timing(screenOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  }, [reducedMotion, screenOpacity]);

  const handleComplete = async () => {
    try {
      // Save all onboarding data to user metadata
      const metadata: Record<string, unknown> = {
        onboarding_complete: true,
        avatar_color: avatarColor,
      };
      if (golferType) metadata.golfer_type = golferType;
      if (handicap) metadata.handicap_index = parseFloat(handicap);
      if (homeCourse) {
        metadata.home_course_id = homeCourse.id;
        metadata.home_course_name = homeCourse.name;
      }

      await supabase.auth.updateUser({ data: metadata });

      // Also update the users table if we have a user id
      if (user?.id) {
        const updates: Record<string, unknown> = {};
        if (handicap) updates.handicap_index = parseFloat(handicap);
        if (avatarColor) updates.avatar_color = avatarColor;
        if (Object.keys(updates).length > 0) {
          await supabase.from('users').update(updates).eq('id', user.id);
        }
      }

      await refreshUser();
    } catch (err) {
      console.log('[Onboarding] Failed to save metadata:', err);
    }

    router.replace('/(tabs)');
  };

  return (
    <Animated.View style={[{ flex: 1 }, { opacity: screenOpacity }]}>
      {screen === 0 && (
        <Screen1Hook
          userName={userName}
          onNext={() => transitionTo(1)}
          reducedMotion={reducedMotion}
        />
      )}
      {screen === 1 && (
        <Screen2Identity
          userName={userName}
          onNext={() => transitionTo(2)}
          onBack={() => transitionTo(0)}
          avatarColor={avatarColor}
          setAvatarColor={setAvatarColor}
          golferType={golferType}
          setGolferType={setGolferType}
          handicap={handicap}
          setHandicap={setHandicap}
          ghinNumber={ghinNumber}
          setGhinNumber={setGhinNumber}
          ghinVerified={ghinVerified}
          setGhinVerified={setGhinVerified}
          homeCourse={homeCourse}
          setHomeCourse={setHomeCourse}
          homeCourseName={homeCourseName}
          setHomeCourseName={setHomeCourseName}
        />
      )}
      {screen === 2 && (
        <Screen3Crew
          userName={userName}
          avatarColor={avatarColor}
          handicap={handicap}
          homeCourseName={homeCourseName}
          onNext={() => transitionTo(3)}
          onBack={() => transitionTo(1)}
          addedFriends={addedFriends}
          setAddedFriends={setAddedFriends}
          invitedNames={invitedNames}
          setInvitedNames={setInvitedNames}
        />
      )}
      {screen === 3 && (
        <Screen4Montage
          userName={userName}
          onComplete={handleComplete}
          onBack={() => transitionTo(2)}
          reducedMotion={reducedMotion}
        />
      )}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  screenFull: {
    flex: 1,
    backgroundColor: C.bg,
  },
  backBtn: {
    position: 'absolute',
    top: STATUS_BAR_H + 6,
    left: 16,
    zIndex: 10,
  },
  skipBtn: {
    position: 'absolute',
    top: STATUS_BAR_H + 10,
    right: 16,
    zIndex: 10,
  },
  skipBtnText: {
    color: C.textMuted,
    fontSize: 14,
  },

  // Progress dots
  dotsRow: {
    position: 'absolute',
    bottom: 34,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Screen 1 ──
  hookNameText: {
    fontFamily: GEO,
    fontStyle: 'italic',
    color: C.gold,
    fontSize: 16,
  },
  hookDormieText: {
    fontFamily: GEO,
    color: C.gold,
    fontSize: 48,
    letterSpacing: 8,
    fontWeight: '700',
  },
  hookSubText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  welcomeLogo: {
    fontFamily: GEO,
    fontStyle: 'italic',
    color: C.gold,
    fontSize: 20,
    letterSpacing: 4,
    fontWeight: '700',
  },
  goldDivider: {
    width: 80,
    height: 1,
    backgroundColor: C.gold,
    marginVertical: 16,
  },
  welcomeTagline: {
    fontFamily: GEO,
    fontStyle: 'italic',
    color: '#FFFFFF',
    fontSize: 17,
    textAlign: 'center',
  },
  welcomeSubTagline: {
    color: C.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  greenButton: {
    backgroundColor: C.augusta,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  getStartedBtn: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    borderTopWidth: 2,
    borderTopColor: C.gold,
  },
  greenButtonText: {
    color: '#FFFFFF',
    fontFamily: GEO,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Screen 2 ──
  profileCard: {
    marginHorizontal: 20,
    marginTop: STATUS_BAR_H + 50,
    padding: 16,
    backgroundColor: C.card,
    overflow: 'hidden',
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileName: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 18,
    fontWeight: '700',
  },
  profileHandicap: {
    color: C.gold,
    fontFamily: GEO,
    fontSize: 14,
    fontWeight: '700',
  },
  profileCourse: {
    color: C.textMuted,
    fontSize: 12,
    flex: 1,
  },

  sectionLabel: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  // Avatar picker
  avatarPickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: C.card,
  },
  avatarPickerLabel: {
    color: C.textMuted,
    fontSize: 13,
    flex: 1,
  },
  avatarPickerContent: {
    backgroundColor: C.card,
    padding: 16,
    marginTop: 1,
  },
  avatarTabs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatarTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  avatarTabText: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: (SCREEN_W - 40 - 32 - 30) / 4,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeSwatch: {
    width: (SCREEN_W - 40 - 32 - 20) / 3,
    height: 60,
    overflow: 'hidden',
  },
  themeSwatchInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPickBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: 'dashed',
  },

  // Golfer type
  golferTypeRow: {
    gap: 10,
  },
  golferCard: {
    backgroundColor: C.card,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  golferCardTitle: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  golferCardDesc: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 4,
  },

  // Text input
  textInput: {
    color: C.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  helpLink: {
    color: C.gold,
    fontSize: 12,
    marginTop: 8,
  },
  helpText: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  verifyBtn: {
    backgroundColor: C.masters,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  verifiedText: {
    color: C.augusta,
    fontSize: 12,
    fontWeight: '600',
  },

  // Course search
  selectedCourse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    padding: 14,
    borderWidth: 1,
    borderColor: C.augusta,
  },
  selectedCourseName: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  courseResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: C.card,
    marginTop: 1,
  },
  courseResultName: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  courseResultLoc: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  // Mini leaderboard
  miniLeaderboard: {
    backgroundColor: C.card,
    overflow: 'hidden',
  },
  miniLbHeaderBar: {
    backgroundColor: C.masters,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  miniLbHeader: {
    color: '#FFFFFF',
    fontFamily: GEO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  miniLbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  miniLbPos: {
    color: C.gold,
    fontFamily: GEO,
    fontSize: 16,
    fontWeight: '700',
    width: 24,
  },
  miniLbName: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 13,
    fontWeight: '600',
  },
  miniLbDetail: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  ghostAvatar: {
    backgroundColor: C.elevated,
  },

  // ── Screen 3 ──
  liveLeaderboard: {
    marginHorizontal: 20,
    backgroundColor: C.card,
    padding: 16,
  },
  lbHeader: {
    color: C.masters,
    fontFamily: GEO,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lbPos: {
    color: C.gold,
    fontFamily: GEO,
    fontSize: 18,
    fontWeight: '700',
    width: 28,
  },
  lbName: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 14,
    fontWeight: '600',
  },
  lbHcp: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  lbInvited: {
    color: C.gold,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 1,
  },
  crewHeaderText: {
    color: C.gold,
    fontFamily: GEO,
    fontStyle: 'italic',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 24,
    paddingHorizontal: 30,
  },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  crewCardTitle: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 14,
    fontWeight: '700',
  },
  crewCardDesc: {
    color: C.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  inlineSearchInput: {
    color: C.text,
    fontSize: 14,
    marginTop: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    padding: 12,
  },
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.augusta,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reassuranceText: {
    color: C.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 30,
    marginTop: 24,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  skipLink: {
    color: C.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    textDecorationLine: 'underline',
  },

  // ── Screen 4 ──
  momentFull: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  momentLeaderboard: {
    width: SCREEN_W * 0.75,
    backgroundColor: C.card,
    padding: 16,
  },
  momentLbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  momentLbPos: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 16,
    fontWeight: '700',
    width: 20,
  },
  momentLbName: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 13,
    flex: 1,
  },
  momentLbScore: {
    color: C.text,
    fontFamily: GEO,
    fontSize: 14,
    fontWeight: '700',
  },
  momentDormieText: {
    fontFamily: GEO,
    color: C.gold,
    fontSize: 44,
    letterSpacing: 8,
    fontWeight: '700',
  },
  momentDormieSub: {
    color: '#FFFFFF',
    fontFamily: GEO,
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 12,
  },
  momentBigText: {
    fontFamily: GEO,
    color: C.gold,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 16,
  },
  momentSubText: {
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 1,
    marginTop: 8,
    textAlign: 'center',
  },
  momentH2HRecord: {
    fontFamily: GEO,
    color: C.gold,
    fontSize: 36,
    fontWeight: '700',
  },
  momentH2HLabel: {
    color: C.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 4,
  },
  ryderHalf: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ryderTeam: {
    fontFamily: GEO,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  ryderScoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ryderScore: {
    fontFamily: GEO,
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '700',
  },

  // Welcome moment
  welcomeUserText: {
    fontFamily: GEO,
    color: '#FFFFFF',
    fontSize: 24,
  },
  welcomeUserSub: {
    color: C.textMuted,
    fontStyle: 'italic',
    fontSize: 14,
    marginTop: 8,
  },

  // Enter button
  enterBtnWrap: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
  },
  enterBtn: {
    backgroundColor: C.augusta,
    paddingVertical: 18,
    alignItems: 'center',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderTopColor: C.gold,
    borderBottomColor: C.gold,
  },
  enterBtnText: {
    color: C.gold,
    fontFamily: GEO,
    fontSize: 18,
    fontWeight: '700',
  },
});
