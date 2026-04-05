import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { GEO, SANS } from '../src/theme/fonts';
import { greenHeaderGradient, cardShadowDark, cardShadowLight } from '../src/theme/colors';
import { coursesService } from '../src/services/courses.service';
import { authService } from '../src/services/auth.service';
import { useToast } from '../src/components/Toast';
import { haptics } from '../src/lib/haptics';

function Pinstripes() {
  const lines = Array.from({ length: 40 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -200,
            left: i * 18 - 100,
            width: 1,
            height: 800,
            backgroundColor: '#fff',
            opacity: 0.03,
            transform: [{ rotate: '35deg' }],
          }}
        />
      ))}
    </View>
  );
}

type CourseResult = {
  id?: string;
  name: string;
  location?: string;
  city?: string;
  state?: string;
};

export default function CourseSearchScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CourseResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef[0] = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await coursesService.search(text.trim());
        setResults(data as CourseResult[]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSelect = async (course: CourseResult) => {
    if (!user || saving) return;
    haptics.light();
    setSaving(true);
    try {
      // Update auth metadata with home course info (triggers useAuth refresh)
      const { error } = await (await import('../src/lib/supabase')).supabase.auth.updateUser({
        data: { home_course_id: course.id ?? null, home_course_name: course.name },
      });
      if (error) throw error;

      showToast({ message: `Home course set to ${course.name}`, type: 'gold', icon: 'golf' });
      router.back();
    } catch {
      showToast({ message: 'Failed to save home course', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const cardShadow = isDark ? cardShadowDark : cardShadowLight;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={greenHeaderGradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 4 }]}
      >
        <Pinstripes />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Home Course</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: c.elevated, borderBottomColor: c.border }]}>
        <Ionicons name="search" size={18} color={c.textMuted} />
        <TextInput
          value={query}
          onChangeText={handleSearch}
          placeholder="Search for a golf course"
          placeholderTextColor={c.textMuted}
          style={[styles.searchInput, { color: c.text }]}
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); }} hitSlop={12}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      {searching && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={c.teal} />
        </View>
      )}

      {!searching && query.length >= 2 && results.length === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="golf-outline" size={32} color={c.textMuted} />
          <Text style={[styles.emptyText, { color: c.textMuted }]}>No courses found</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item, i) => item.id ?? `${item.name}-${i}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleSelect(item)}
            disabled={saving}
            style={({ pressed }) => [
              styles.resultRow,
              { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons name="golf" size={20} color={c.teal} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.courseName, { color: c.text }]}>{item.name}</Text>
              {(item.location || item.city) && (
                <Text style={[styles.courseLocation, { color: c.textMuted }]}>
                  {item.location || [item.city, item.state].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: GEO,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  loadingWrap: {
    padding: 32,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: GEO,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: SANS,
  },
  courseLocation: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: SANS,
  },
});
