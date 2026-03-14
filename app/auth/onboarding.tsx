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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO } from '../../src/theme/fonts';
import { Avatar } from '../../src/components/Avatar';
import { authService } from '../../src/services/auth.service';
import { coursesService } from '../../src/services/courses.service';
import { supabase } from '../../src/lib/supabase';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Types ────────────────────────────────────────────────────────────
type AvatarMode = 'initials' | 'theme' | 'photo';
type AvatarTheme = 'green' | 'ocean' | 'gold' | 'navy' | 'brown';
type GolferType = 'competitive' | 'social' | 'improving';
type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const AVATAR_THEMES: { key: AvatarTheme; label: string; color: string }[] = [
  { key: 'green', label: 'Classic Green', color: '#1E4D2B' },
  { key: 'ocean', label: 'Ocean Blue', color: '#2A6F97' },
  { key: 'gold', label: 'Championship Gold', color: '#D4AF37' },
  { key: 'navy', label: 'Midnight Navy', color: '#1B2A4A' },
  { key: 'brown', label: 'Links Brown', color: '#6B4E3D' },
];

const GOLFER_TYPES: { key: GolferType; icon: string; label: string; desc: string }[] = [
  { key: 'competitive', icon: '🏆', label: 'Competitive', desc: 'I play to win' },
  { key: 'social', icon: '🍻', label: 'Social', desc: 'I play for the crew' },
  { key: 'improving', icon: '📈', label: 'Improving', desc: 'I play to get better' },
];

// ─── Pinstripes ───────────────────────────────────────────────────────
function Pinstripes({ count = 40, opacity = 0.03 }: { count?: number; opacity?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute', top: -200, left: i * 18 - 100,
            width: 1, height: 1000,
            backgroundColor: '#fff', opacity,
            transform: [{ rotate: '35deg' }],
          }}
        />
      ))}
    </View>
  );
}

// ─── SCREEN 0: WELCOME ───────────────────────────────────────────────
function WelcomeScreen({ onNext, onToggleTheme }: { onNext: () => void; onToggleTheme: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.screenFull, { backgroundColor: c.bg }]}>
      <LinearGradient colors={['#1E4D2B', '#2D6A3F']} style={styles.welcomeTop}>
        <Pinstripes />

        {/* Dark/light toggle */}
        <Pressable onPress={onToggleTheme} style={styles.themeToggle} hitSlop={12}>
          <Ionicons name={theme.isDark ? 'sunny' : 'moon'} size={20} color="#FFFFFFAA" />
        </Pressable>

        {/* Gold corner brackets */}
        <View style={[styles.cornerTL, { borderColor: '#D4AF37' }]} />
        <View style={[styles.cornerTR, { borderColor: '#D4AF37' }]} />
        <View style={[styles.cornerBL, { borderColor: '#D4AF37' }]} />
        <View style={[styles.cornerBR, { borderColor: '#D4AF37' }]} />

        <View style={styles.welcomeCenter}>
          <Text style={styles.welcomeLogo}>DORMIE</Text>
          <View style={styles.welcomeDivider} />
          <Text style={styles.welcomeTagline}>Your crew, always in play.</Text>
          <Text style={styles.welcomeSub}>Score it. Track it. Compete for it.</Text>
        </View>
      </LinearGradient>

      <View style={[styles.welcomeBottom, { backgroundColor: c.bg }]}>
        <Pressable onPress={onNext} style={styles.getStartedBtn}>
          <Text style={styles.getStartedText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color="#000000" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Avatar initials helper (shared with Avatar component logic) ─────
function getAvatarInitials(name: string): string {
  if (!name || name === 'Golfer') return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── SCREEN 1: YOUR GAME ─────────────────────────────────────────────
function YourGameScreen({
  avatarMode, setAvatarMode,
  avatarTheme, setAvatarTheme,
  golferType, setGolferType,
  handicap, setHandicap,
  ghinNumber, setGhinNumber,
  homeCourse, setHomeCourse,
  homeCourseId, setHomeCourseId,
  userName,
  userId,
  photoUri, setPhotoUri,
}: {
  avatarMode: AvatarMode; setAvatarMode: (v: AvatarMode) => void;
  avatarTheme: AvatarTheme; setAvatarTheme: (v: AvatarTheme) => void;
  golferType: GolferType | null; setGolferType: (v: GolferType) => void;
  handicap: string; setHandicap: (v: string) => void;
  ghinNumber: string; setGhinNumber: (v: string) => void;
  homeCourse: string; setHomeCourse: (v: string) => void;
  homeCourseId: string; setHomeCourseId: (v: string) => void;
  userName: string;
  userId: string;
  photoUri: string | null; setPhotoUri: (v: string | null) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const themeColor = AVATAR_THEMES.find((t) => t.key === avatarTheme)?.color ?? '#1E4D2B';

  // Course search state
  const [courseResults, setCourseResults] = useState<any[]>([]);
  const [courseSearching, setCourseSearching] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCourseSearch = useCallback((text: string) => {
    setHomeCourse(text);
    setHomeCourseId(''); // Clear ID when user edits text (manual entry)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.trim().length < 2) {
      setCourseResults([]);
      setShowCourseDropdown(false);
      return;
    }
    setCourseSearching(true);
    setShowCourseDropdown(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        // Try GolfCourseAPI first, then Supabase fallback
        const apiResponse = await coursesService.searchAPI(text.trim());
        // API may return { courses: [...] } or [...] directly
        let list: any[] = [];
        if (apiResponse && typeof apiResponse === 'object') {
          if (Array.isArray(apiResponse)) {
            list = apiResponse;
          } else if (Array.isArray(apiResponse.courses)) {
            list = apiResponse.courses;
          }
        }
        // Supabase fallback if API returned nothing
        if (list.length === 0) {
          const dbResults = await coursesService.search(text.trim(), 5);
          list = Array.isArray(dbResults) ? dbResults : [];
        }
        setCourseResults(list.slice(0, 5));
      } catch {
        setCourseResults([]);
      } finally {
        setCourseSearching(false);
      }
    }, 300);
  }, [setHomeCourse, setHomeCourseId]);

  const selectCourse = useCallback((courseId: string, name: string) => {
    setHomeCourse(name);
    setHomeCourseId(courseId);
    setShowCourseDropdown(false);
    setCourseResults([]);
  }, [setHomeCourse, setHomeCourseId]);

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const initials = getAvatarInitials(userName);

  // Render avatar preview based on mode
  const renderAvatarPreview = () => {
    if (avatarMode === 'photo' && photoUri) {
      return <Image source={{ uri: photoUri }} style={{ width: 64, height: 64 }} />;
    }
    if (avatarMode === 'theme') {
      return (
        <View style={{ width: 64, height: 64, backgroundColor: themeColor, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, fontFamily: GEO, fontWeight: '700', color: '#E8E4DE' }}>
            {initials}
          </Text>
        </View>
      );
    }
    // 'initials' mode — use gradient Avatar
    return <Avatar id={userId || 'user'} name={userName} size={64} />;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={[styles.screenScroll, { backgroundColor: c.bg }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.stepTitle, { color: c.text }]}>Your Game</Text>
        <Text style={[styles.stepSubtitle, { color: c.textMuted }]}>Step 1 of 3</Text>

        {/* Avatar picker */}
        <Text style={[styles.fieldLabel, { color: c.text }]}>Avatar</Text>
        <View style={styles.avatarPreview}>
          {renderAvatarPreview()}
        </View>

        {/* Avatar mode */}
        <View style={styles.avatarModes}>
          {(['initials', 'theme', 'photo'] as AvatarMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setAvatarMode(m)}
              style={[
                styles.modeBtn,
                { backgroundColor: avatarMode === m ? c.teal + '22' : c.elevated, borderColor: avatarMode === m ? c.teal : c.border, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.modeBtnText, { color: avatarMode === m ? c.teal : c.textMuted }]}>
                {m === 'initials' ? 'Initials' : m === 'theme' ? 'Course Theme' : 'Upload Photo'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Theme color picker */}
        {avatarMode === 'theme' && (
          <View style={styles.themeColors}>
            {AVATAR_THEMES.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setAvatarTheme(t.key)}
                style={[
                  styles.colorCircle,
                  { backgroundColor: t.color, borderColor: avatarTheme === t.key ? '#FFFFFF' : 'transparent', borderWidth: 2 },
                ]}
              />
            ))}
          </View>
        )}

        {/* Photo picker */}
        {avatarMode === 'photo' && (
          <View style={styles.photoPickerWrap}>
            <Pressable onPress={handlePickPhoto} style={[styles.photoPickerBtn, { backgroundColor: c.teal }]}>
              <Ionicons name="image-outline" size={18} color="#FFFFFF" />
              <Text style={styles.photoPickerBtnText}>Choose from Camera Roll</Text>
            </Pressable>
          </View>
        )}

        {/* Golfer type */}
        <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>What kind of golfer?</Text>
        <View style={styles.golferCards}>
          {GOLFER_TYPES.map((g) => (
            <Pressable
              key={g.key}
              onPress={() => setGolferType(g.key)}
              style={[
                styles.golferCard,
                {
                  backgroundColor: golferType === g.key ? c.teal + '12' : c.elevated,
                  borderColor: golferType === g.key ? c.teal : c.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={styles.golferEmoji}>{g.icon}</Text>
              <Text style={[styles.golferLabel, { color: golferType === g.key ? c.teal : c.text }]}>{g.label}</Text>
              <Text style={[styles.golferDesc, { color: c.textMuted }]}>{g.desc}</Text>
            </Pressable>
          ))}
        </View>

        {/* Handicap */}
        <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Handicap Index</Text>
        <TextInput
          value={handicap}
          onChangeText={setHandicap}
          placeholder="e.g., 12.4"
          placeholderTextColor={c.textMuted}
          style={[styles.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
          keyboardType="numeric"
        />
        <Pressable onPress={() => setHandicap('')}>
          <Text style={[styles.helperLink, { color: c.teal }]}>I don't know my handicap</Text>
        </Pressable>

        {/* GHIN */}
        <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>GHIN Number</Text>
        <View style={styles.ghinRow}>
          <TextInput
            value={ghinNumber}
            onChangeText={setGhinNumber}
            placeholder="Optional"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border, flex: 1 }]}
            keyboardType="numeric"
          />
          {ghinNumber.length > 0 && (
            <Pressable style={[styles.verifyBtn, { backgroundColor: c.teal }]}>
              <Text style={styles.verifyBtnText}>Verify</Text>
            </Pressable>
          )}
        </View>

        {/* Home course with search */}
        <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>Home Course</Text>
        <TextInput
          value={homeCourse}
          onChangeText={handleCourseSearch}
          placeholder="Search courses..."
          placeholderTextColor={c.textMuted}
          style={[styles.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
          onFocus={() => { if (courseResults.length > 0) setShowCourseDropdown(true); }}
        />
        {showCourseDropdown && (
          <View style={[styles.courseDropdown, { backgroundColor: c.elevated, borderColor: c.border }]}>
            {courseSearching && (
              <View style={styles.courseSearchingRow}>
                <ActivityIndicator size="small" color={c.teal} />
                <Text style={[styles.courseSearchingText, { color: c.textMuted }]}>Searching courses...</Text>
              </View>
            )}
            {!courseSearching && courseResults.length === 0 && homeCourse.trim().length >= 2 && (
              <View style={styles.courseSearchingRow}>
                <Ionicons name="golf-outline" size={16} color={c.textMuted} />
                <Text style={[styles.courseSearchingText, { color: c.textMuted }]}>
                  No results — you can type your course name manually
                </Text>
              </View>
            )}
            {courseResults.map((course, i) => {
              const courseName = course.name ?? course.club_name ?? '';
              const courseId = course.id ?? '';
              const courseLocation = course.location ?? (course.city && course.state ? `${course.city}, ${course.state}` : '');
              return (
                <Pressable
                  key={courseId || i}
                  onPress={() => selectCourse(courseId, courseName)}
                  style={[styles.courseResultRow, i < courseResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}
                >
                  <Ionicons name="golf" size={16} color={c.teal} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.courseResultName, { color: c.text }]} numberOfLines={1}>{courseName}</Text>
                    {courseLocation ? (
                      <Text style={[styles.courseResultLocation, { color: c.textMuted }]} numberOfLines={1}>{courseLocation}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── SCREEN 2: BUILD YOUR GROUP ───────────────────────────────────────
function BuildGroupScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [expanded, setExpanded] = useState<string | null>(null);

  // Mini animated previews
  const leaderboardAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (expanded === 'leaderboard') {
      leaderboardAnims.forEach((a) => a.setValue(0));
      Animated.stagger(
        120,
        leaderboardAnims.map((a) =>
          Animated.spring(a, { toValue: 1, friction: 6, useNativeDriver: true })
        )
      ).start();
    }
  }, [expanded, leaderboardAnims]);

  const h2hAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (expanded === 'h2h') {
      h2hAnim.setValue(0);
      Animated.timing(h2hAnim, { toValue: 1, duration: 800, useNativeDriver: false }).start();
    }
  }, [expanded, h2hAnim]);

  const seasonAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (expanded === 'seasons') {
      seasonAnim.setValue(0);
      Animated.timing(seasonAnim, { toValue: 1, duration: 1000, useNativeDriver: false }).start();
    }
  }, [expanded, seasonAnim]);

  const MOCK_LEADERBOARD = [
    { id: '2', name: 'Drew P.', score: 75 },
    { id: '3', name: 'Jake S.', score: 77 },
    { id: '4', name: 'Tommy F.', score: 79 },
    { id: '5', name: 'Mike C.', score: 81 },
    { id: '6', name: 'Sam R.', score: 83 },
  ];

  const cards = [
    {
      key: 'leaderboard',
      icon: 'trophy' as const,
      title: 'Group Leaderboard',
      desc: "See who's on top across all your rounds",
      preview: () => (
        <View style={styles.miniPreview}>
          {MOCK_LEADERBOARD.map((p, i) => (
            <Animated.View
              key={p.id}
              style={[
                styles.miniRow,
                { backgroundColor: c.elevated, opacity: leaderboardAnims[i], transform: [{ translateY: leaderboardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
              ]}
            >
              <Text style={[styles.miniRank, { color: i === 0 ? c.gold : c.textMuted, fontFamily: GEO }]}>{i + 1}</Text>
              <Avatar id={p.id} name={p.name} size={22} />
              <Text style={[styles.miniName, { color: c.text }]}>{p.name}</Text>
              <Text style={[styles.miniVal, { color: i === 0 ? c.gold : c.teal, fontFamily: GEO }]}>{p.score}</Text>
            </Animated.View>
          ))}
        </View>
      ),
    },
    {
      key: 'h2h',
      icon: 'git-compare' as const,
      title: 'Head-to-Head',
      desc: 'Track your record against every friend',
      preview: () => {
        const barWidth = h2hAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '62.5%'] });
        return (
          <View style={styles.miniPreview}>
            <View style={[styles.h2hBar, { backgroundColor: c.elevated }]}>
              <Animated.View style={[styles.h2hFill, { width: barWidth, backgroundColor: c.teal }]} />
            </View>
            <View style={styles.h2hLabels}>
              <Text style={[styles.h2hScore, { color: c.teal, fontFamily: GEO }]}>5</Text>
              <Text style={[styles.h2hVs, { color: c.textMuted }]}>YOU vs DREW</Text>
              <Text style={[styles.h2hScore, { color: c.urgent, fontFamily: GEO }]}>3</Text>
            </View>
          </View>
        );
      },
    },
    {
      key: 'seasons',
      icon: 'ribbon' as const,
      title: 'Season Competitions',
      desc: 'FedEx Cup-style season-long races',
      preview: () => {
        const progressWidth = seasonAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '72%'] });
        return (
          <View style={styles.miniPreview}>
            <Text style={[styles.miniSeasonLabel, { color: c.gold, fontFamily: GEO }]}>FedEx Cup</Text>
            <View style={[styles.seasonBar, { backgroundColor: c.elevated }]}>
              <Animated.View style={[styles.seasonFill, { width: progressWidth, backgroundColor: c.gold }]} />
            </View>
            <Text style={[styles.miniSeasonSub, { color: c.textMuted }]}>Week 7 of 10</Text>
          </View>
        );
      },
    },
  ];

  const handleShareInvite = async () => {
    try {
      await Share.share({ message: 'Join me on Dormie! Download the app and track your golf game with your crew. https://dormie.golf/invite' });
    } catch { }
  };

  return (
    <ScrollView style={[styles.screenScroll, { backgroundColor: c.bg }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: c.text }]}>Build Your Group</Text>
      <Text style={[styles.stepSubtitle, { color: c.textMuted }]}>Step 2 of 3</Text>
      <Text style={[styles.stepDesc, { color: c.textMuted }]}>
        Dormie is built for your golf crew, anywhere.
      </Text>

      {/* Feature cards */}
      {cards.map((card) => {
        const isOpen = expanded === card.key;
        return (
          <View key={card.key}>
            <Pressable
              onPress={() => setExpanded(isOpen ? null : card.key)}
              style={[styles.groupCard, { backgroundColor: c.cardBg, borderColor: isOpen ? c.teal : c.border, borderWidth: 1 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Ionicons name={card.icon} size={22} color={c.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupCardTitle, { color: c.text }]}>{card.title}</Text>
                  <Text style={[styles.groupCardDesc, { color: c.textMuted }]}>{card.desc}</Text>
                </View>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
            </Pressable>
            {isOpen && card.preview()}
          </View>
        );
      })}

      {/* Invite section */}
      <View style={[styles.inviteSection, { backgroundColor: c.elevated }]}>
        <Ionicons name="people" size={24} color={c.teal} />
        <Text style={[styles.inviteCta, { color: c.text }]}>
          Invite your first crew member to unlock the leaderboard
        </Text>
        <Pressable onPress={handleShareInvite} style={[styles.inviteBtn, { backgroundColor: c.teal }]}>
          <Ionicons name="share-outline" size={16} color="#FFFFFF" />
          <Text style={styles.inviteBtnText}>Share Invite Link</Text>
        </Pressable>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── SCREEN 3: WHAT DORMIE DOES ──────────────────────────────────────
function FeatureScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [activeTab, setActiveTab] = useState<'score' | 'compete' | 'plan'>('score');

  const tabs: { key: typeof activeTab; label: string; color: string; icon: keyof typeof Ionicons.glyphMap; headline: string; bullets: string[] }[] = [
    {
      key: 'score', label: 'Score', color: c.teal, icon: 'golf',
      headline: 'Track Every Round',
      bullets: ['13 scoring formats', 'Live scorecard with stats', '16 side games auto-detected', 'Share cards with your crew'],
    },
    {
      key: 'compete', label: 'Compete', color: c.gold, icon: 'trophy',
      headline: 'Season-Long Competitions',
      bullets: ['FedEx Cup-style standings', 'Head-to-head records', 'Course leaderboards', 'Ryder Cup mode'],
    },
    {
      key: 'plan', label: 'Plan', color: c.urgent, icon: 'airplane',
      headline: 'Trip Planning',
      bullets: ['Group trip coordination', 'Real-time chat', 'Invite codes', 'Countdown rings'],
    },
  ];

  const active = tabs.find((t) => t.key === activeTab)!;

  return (
    <ScrollView style={[styles.screenScroll, { backgroundColor: c.bg }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stepTitle, { color: c.text }]}>What Dormie Does</Text>
      <Text style={[styles.stepSubtitle, { color: c.textMuted }]}>Step 3 of 3</Text>

      {/* Tabs */}
      <View style={styles.featureTabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={[styles.featureTab, { backgroundColor: activeTab === t.key ? t.color + '22' : c.elevated, borderColor: activeTab === t.key ? t.color : 'transparent', borderWidth: 1 }]}
          >
            <Text style={[styles.featureTabText, { color: activeTab === t.key ? t.color : c.textMuted }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Feature card */}
      <View style={[styles.featureCard, { backgroundColor: c.cardBg, borderColor: active.color + '44', borderWidth: 1 }]}>
        <Ionicons name={active.icon} size={32} color={active.color} />
        <Text style={[styles.featureHeadline, { color: c.text }]}>{active.headline}</Text>
        {active.bullets.map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <Ionicons name="checkmark" size={16} color={active.color} />
            <Text style={[styles.bulletText, { color: c.textMuted }]}>{b}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── SCREEN 4: NOTIFICATIONS ─────────────────────────────────────────
function NotificationsScreen({
  notifPref,
  setNotifPref,
}: {
  notifPref: boolean;
  setNotifPref: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const pillAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    Animated.stagger(
      200,
      pillAnims.map((a) =>
        Animated.spring(a, { toValue: 1, friction: 6, useNativeDriver: true })
      )
    ).start();
  }, [pillAnims]);

  const pills = [
    '🏆 Drew just posted a 74!',
    '⛳ Your tee time is tomorrow',
    '🔥 You\'re leading the season',
    '💬 New message in Scottsdale Trip',
    '📊 Weekly stats are in',
  ];

  return (
    <View style={[styles.screenFull, { backgroundColor: c.bg }]}>
      <View style={styles.notifCenter}>
        <Ionicons name="notifications" size={48} color={c.gold} />
        <Text style={[styles.notifTitle, { color: c.text }]}>Stay in the game</Text>

        <View style={styles.pillsContainer}>
          {pills.map((pill, i) => (
            <Animated.View
              key={i}
              style={[
                styles.notifPill,
                { backgroundColor: c.elevated, opacity: pillAnims[i], transform: [{ translateY: pillAnims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] },
              ]}
            >
              <Text style={[styles.notifPillText, { color: c.text }]}>{pill}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={styles.notifButtons}>
        <Pressable
          onPress={() => setNotifPref(true)}
          style={[styles.notifPrimary, { backgroundColor: c.gold }]}
        >
          <Ionicons name="notifications" size={18} color="#000000" />
          <Text style={styles.notifPrimaryText}>Turn On Notifications</Text>
        </Pressable>
        <Pressable onPress={() => setNotifPref(false)}>
          <Text style={[styles.notifSkip, { color: c.textMuted }]}>Maybe later</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── SCREEN 5: LAUNCH MONTAGE ─────────────────────────────────────────
function LaunchMontage({ userName, onComplete }: { userName: string; onComplete: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [cardIdx, setCardIdx] = useState(0);
  const [showFinal, setShowFinal] = useState(false);
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const finalOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  const montageCards = [
    { emoji: '⛳', line1: 'CHAMPIONSHIP', line2: 'GOLF' },
    { emoji: '🏆', line1: 'GROUP', line2: 'LEADERBOARD' },
    { emoji: '🏆', line1: 'MATCH CLOSED', line2: 'TYLER 3&2' },
    { emoji: '⚔️', line1: '5-3', line2: 'YOU LEAD ALL-TIME' },
    { emoji: '💰', line1: 'SKINS', line2: 'JACKPOT' },
    { emoji: '🏆', line1: 'TEAM RED vs TEAM BLUE', line2: '12-9' },
    { emoji: '🏆', line1: 'SEASON', line2: 'CHAMPION' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCardIdx((prev) => {
        if (prev >= montageCards.length - 1) {
          clearInterval(interval);
          // Transition to final
          Animated.sequence([
            Animated.timing(cardOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.delay(200),
          ]).start(() => {
            setShowFinal(true);
            Animated.timing(finalOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
            Animated.loop(
              Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
              ])
            ).start();
          });
          return prev;
        }

        // Fade out, change, fade in
        Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        });

        return prev + 1;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [cardOpacity, finalOpacity, pulseAnim, montageCards.length]);

  // Confetti particles
  const confetti = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * SCREEN_W,
      top: Math.random() * SCREEN_H,
      size: 4 + Math.random() * 6,
      color: i % 2 === 0 ? '#D4AF37' : '#1E4D2B',
      rotation: Math.random() * 360,
    })),
  []);

  const card = montageCards[cardIdx];

  if (showFinal) {
    return (
      <Animated.View style={[styles.screenFull, { backgroundColor: '#141210', opacity: finalOpacity }]}>
        <View style={styles.finalCenter}>
          <Animated.Text style={[styles.finalLogo, { opacity: pulseAnim }]}>
            DORMIE
          </Animated.Text>
          <Text style={[styles.finalWelcome, { color: c.text }]}>Welcome, {userName.split(' ')[0]}.</Text>
          <Pressable onPress={onComplete} style={styles.enterBtn}>
            <Text style={styles.enterBtnText}>Enter Dormie</Text>
            <Ionicons name="arrow-forward" size={18} color="#000000" />
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <View style={[styles.screenFull, { backgroundColor: '#F5F1E8' }]}>
      {/* Confetti */}
      {confetti.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: [{ rotate: `${p.rotation}deg` }],
            opacity: 0.5,
          }}
        />
      ))}

      <Animated.View style={[styles.montageCard, { opacity: cardOpacity }]}>
        <Text style={styles.montageEmoji}>{card.emoji}</Text>
        <Text style={styles.montageLine1}>{card.line1}</Text>
        <Text style={styles.montageLine2}>{card.line2}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────
export default function OnboardingScreen() {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<OnboardingStep>(0);

  // Profile state
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('initials');
  const [avatarTheme, setAvatarTheme] = useState<AvatarTheme>('green');
  const [golferType, setGolferType] = useState<GolferType | null>(null);
  const [handicap, setHandicap] = useState('');
  const [ghinNumber, setGhinNumber] = useState('');
  const [homeCourse, setHomeCourse] = useState('');
  const [homeCourseId, setHomeCourseId] = useState('');
  const [notifPref, setNotifPref] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const userName = user?.user_metadata?.name || user?.user_metadata?.full_name || '';
  const displayName = userName || 'Golfer';
  const themeColor = AVATAR_THEMES.find((t) => t.key === avatarTheme)?.color ?? '#1E4D2B';

  const handleNext = useCallback(() => {
    if (step < 6) {
      setStep((step + 1) as OnboardingStep);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      setStep((step - 1) as OnboardingStep);
    }
  }, [step]);

  const handleNotifChoice = useCallback((pref: boolean) => {
    setNotifPref(pref);
    handleNext();
  }, [handleNext]);

  const handleComplete = useCallback(async () => {
    // Save onboarding data to profile
    try {
      if (user?.id) {
        await authService.updateProfile(user.id, {
          avatar_color: themeColor,
          handicap_index: handicap ? parseFloat(handicap) : 0,
          city: null,
          state: null,
        });
        // Persist home course in auth user metadata
        await supabase.auth.updateUser({
          data: {
            home_course: homeCourse || null,
            home_course_id: homeCourseId || null,
          },
        });
      }
    } catch (err) {
      // Non-blocking — profile can be updated later
      console.warn('Failed to save onboarding data:', err);
    }

    setTimeout(() => router.replace('/(tabs)'), 0);
  }, [user, themeColor, handicap, homeCourse, homeCourseId, router]);

  // Step 6: trigger navigation via useEffect to avoid "Cannot update component while rendering"
  useEffect(() => {
    if (step === 6) {
      handleComplete();
    }
  }, [step, handleComplete]);

  // Screens that manage their own navigation
  if (step === 0) {
    return <WelcomeScreen onNext={handleNext} onToggleTheme={toggleTheme} />;
  }

  if (step === 4) {
    return (
      <NotificationsScreen
        notifPref={notifPref}
        setNotifPref={(v) => { setNotifPref(v); handleNext(); }}
      />
    );
  }

  if (step === 5) {
    return <LaunchMontage userName={displayName} onComplete={handleNext} />;
  }

  if (step === 6) {
    return null;
  }

  // Steps 1-3 share layout with nav bar
  return (
    <View style={[styles.screenFull, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.navBar, { borderBottomColor: c.border }]}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={styles.progressDots}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor: s < step ? c.gold : s === step ? c.teal : c.elevated,
                  width: s === step ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
        <Pressable onPress={handleNext}>
          <Text style={[styles.skipText, { color: c.textMuted }]}>Skip</Text>
        </Pressable>
      </View>

      {/* Content */}
      {step === 1 && (
        <YourGameScreen
          avatarMode={avatarMode} setAvatarMode={setAvatarMode}
          avatarTheme={avatarTheme} setAvatarTheme={setAvatarTheme}
          golferType={golferType} setGolferType={setGolferType}
          handicap={handicap} setHandicap={setHandicap}
          ghinNumber={ghinNumber} setGhinNumber={setGhinNumber}
          homeCourse={homeCourse} setHomeCourse={setHomeCourse}
          homeCourseId={homeCourseId} setHomeCourseId={setHomeCourseId}
          userName={displayName}
          userId={user?.id ?? ''}
          photoUri={photoUri} setPhotoUri={setPhotoUri}
        />
      )}
      {step === 2 && <BuildGroupScreen />}
      {step === 3 && <FeatureScreen />}

      {/* Bottom button */}
      <View style={[styles.bottomBar, { borderTopColor: c.border }]}>
        <Pressable onPress={handleNext} style={[styles.continueBtn, { backgroundColor: step === 3 ? c.gold : c.teal }]}>
          <Text style={[styles.continueBtnText, { color: step === 3 ? '#000000' : '#FFFFFF', fontFamily: GEO }]}>
            {step === 3 ? "Let's Play" : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={step === 3 ? '#000000' : '#FFFFFF'} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screenFull: { flex: 1 },
  screenScroll: { flex: 1, paddingHorizontal: 20 },

  // Welcome
  welcomeTop: { height: SCREEN_H * 0.45, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  welcomeBottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 60, paddingHorizontal: 24 },
  welcomeCenter: { alignItems: 'center' },
  welcomeLogo: { fontSize: 32, fontFamily: GEO, fontStyle: 'italic', color: '#D4AF37', letterSpacing: 5 },
  welcomeDivider: { width: 60, height: 1, backgroundColor: '#D4AF37', marginVertical: 14 },
  welcomeTagline: { fontSize: 15, fontFamily: GEO, fontStyle: 'italic', color: '#FFFFFF' },
  welcomeSub: { fontSize: 13, color: '#FFFFFF88', marginTop: 6 },
  themeToggle: { position: 'absolute', top: STATUS_BAR_H + 8, right: 16 },
  getStartedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4AF37', paddingVertical: 16, gap: 8 },
  getStartedText: { fontSize: 16, fontWeight: '700', color: '#000000', fontFamily: GEO },

  // Corner brackets
  cornerTL: { position: 'absolute', top: STATUS_BAR_H + 40, left: 20, width: 24, height: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { position: 'absolute', top: STATUS_BAR_H + 40, right: 20, width: 24, height: 24, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { position: 'absolute', bottom: 20, left: 20, width: 24, height: 24, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { position: 'absolute', bottom: 20, right: 20, width: 24, height: 24, borderBottomWidth: 2, borderRightWidth: 2 },

  // Nav bar
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: STATUS_BAR_H + 8, paddingBottom: 12, borderBottomWidth: 1 },
  progressDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressDot: { height: 6, borderRadius: 3 },
  skipText: { fontSize: 14, fontWeight: '500' },

  // Step titles
  stepTitle: { fontSize: 22, fontFamily: GEO, fontWeight: '700', marginTop: 20 },
  stepSubtitle: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  stepDesc: { fontSize: 14, lineHeight: 20, marginBottom: 16 },

  // Fields
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  helperLink: { fontSize: 13, marginTop: 6 },

  // Avatar
  avatarPreview: { alignItems: 'center', marginBottom: 16 },
  avatarModes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  themeColors: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
  colorCircle: { width: 36, height: 36, borderRadius: 18 },
  photoPickerWrap: { alignItems: 'center', marginBottom: 12 },
  photoPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  photoPickerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // Golfer type
  golferCards: { flexDirection: 'row', gap: 8 },
  golferCard: { flex: 1, padding: 12, alignItems: 'center', gap: 4 },
  golferEmoji: { fontSize: 24 },
  golferLabel: { fontSize: 13, fontWeight: '600' },
  golferDesc: { fontSize: 10, textAlign: 'center' },

  // GHIN
  ghinRow: { flexDirection: 'row', gap: 8 },
  verifyBtn: { paddingHorizontal: 16, justifyContent: 'center' },
  verifyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // Group
  groupCard: { padding: 14, marginBottom: 8 },
  groupCardTitle: { fontSize: 15, fontWeight: '600' },
  groupCardDesc: { fontSize: 12, marginTop: 2 },
  miniPreview: { paddingHorizontal: 14, paddingBottom: 12, gap: 4 },
  miniRow: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  miniRank: { width: 20, fontSize: 14 },
  miniName: { flex: 1, fontSize: 13 },
  miniVal: { fontSize: 14 },

  // H2H preview
  h2hBar: { height: 8, overflow: 'hidden' },
  h2hFill: { height: '100%' },
  h2hLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  h2hScore: { fontSize: 20, fontWeight: '700' },
  h2hVs: { fontSize: 11, fontWeight: '600', letterSpacing: 1 },

  // Season preview
  miniSeasonLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  seasonBar: { height: 6, marginTop: 6, overflow: 'hidden' },
  seasonFill: { height: '100%' },
  miniSeasonSub: { fontSize: 11, marginTop: 4 },

  // Course search dropdown
  courseDropdown: { borderWidth: 1, marginTop: -1 },
  courseSearchingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  courseSearchingText: { fontSize: 13 },
  courseResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  courseResultName: { fontSize: 14, fontWeight: '500' },
  courseResultLocation: { fontSize: 12, marginTop: 1 },

  // Invite
  inviteSection: { padding: 16, marginTop: 16, alignItems: 'center', gap: 10 },
  inviteCta: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  inviteBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // Features
  featureTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  featureTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  featureTabText: { fontSize: 14, fontWeight: '600' },
  featureCard: { padding: 20, gap: 12 },
  featureHeadline: { fontSize: 18, fontWeight: '700', fontFamily: GEO },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletText: { fontSize: 14 },

  // Notifications
  notifCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  notifTitle: { fontSize: 22, fontFamily: GEO, fontWeight: '700', marginTop: 16, marginBottom: 20 },
  pillsContainer: { width: '100%', gap: 8, marginTop: 8 },
  notifPill: { paddingVertical: 12, paddingHorizontal: 16 },
  notifPillText: { fontSize: 14 },
  notifButtons: { paddingHorizontal: 24, paddingBottom: 60, gap: 12 },
  notifPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  notifPrimaryText: { fontSize: 16, fontWeight: '700', color: '#000000', fontFamily: GEO },
  notifSkip: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },

  // Montage
  montageCard: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  montageEmoji: { fontSize: 48 },
  montageLine1: { fontSize: 14, fontWeight: '800', letterSpacing: 3, color: '#1E4D2B', fontFamily: GEO, marginTop: 16 },
  montageLine2: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', fontFamily: GEO, marginTop: 4, textAlign: 'center' },

  // Final
  finalCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  finalLogo: { fontSize: 36, fontFamily: GEO, fontStyle: 'italic', color: '#D4AF37', letterSpacing: 5 },
  finalWelcome: { fontSize: 18, fontFamily: GEO, marginTop: 16 },
  enterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4AF37', paddingVertical: 16, paddingHorizontal: 32, gap: 8, marginTop: 40 },
  enterBtnText: { fontSize: 16, fontWeight: '700', color: '#000000', fontFamily: GEO },

  // Bottom bar
  bottomBar: { padding: 16, borderTopWidth: 1 },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  continueBtnText: { fontSize: 16, fontWeight: '700' },
});
