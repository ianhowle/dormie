import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import { useToast } from '../Toast';
import { coursesService } from '../../services/courses.service';
import type { Course } from '../../lib/database.types';
import type { SearchResult } from '../../services/courses.service';

// ─── Types ─────────────────────────────────────────────────────────────

export type SelectedCourse = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  par?: number;
  source?: 'local' | 'golfapi' | 'google';
};

interface CourseLocationPickerProps {
  value: SelectedCourse | null;
  onChange: (course: SelectedCourse | null) => void;
  placeholder?: string;
  initialQuery?: string;
}

type FallbackStage = 'local' | 'golfApi' | 'places';

// ─── Component ─────────────────────────────────────────────────────────

export default function CourseLocationPicker({
  value,
  onChange,
  placeholder = 'Search courses...',
  initialQuery,
}: CourseLocationPickerProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<SelectedCourse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [stage, setStage] = useState<FallbackStage>('local');
  const [exhaustedStages, setExhaustedStages] = useState<Set<FallbackStage>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Local search (debounced) ──────────────────────────────────────

  const searchLocal = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setStage('local');
    setExhaustedStages(new Set());

    try {
      const local = await coursesService.search(q.trim(), 10);
      const mapped: SelectedCourse[] = local.map((course: Course) => ({
        id: course.id,
        name: course.name,
        city: (course as any).city ?? '',
        state: (course as any).state ?? '',
        par: (course as any).par ?? undefined,
        source: 'local' as const,
      }));
      setResults(mapped);
      setShowDropdown(true);
      if (mapped.length === 0) {
        setExhaustedStages(new Set(['local']));
      }
    } catch {
      setResults([]);
      setShowDropdown(true);
      setExhaustedStages(new Set(['local']));
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Run an initial search if the parent supplied a starting query
  // (e.g. "Pebble Beach, CA" from a Dream Board "Plan Trip" tap).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 2) {
      searchLocal(initialQuery.trim());
    }
  }, []);

  const handleTextChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchLocal(text), 300);
  }, [searchLocal]);

  // ─── GolfCourseAPI fallback ────────────────────────────────────────

  const searchGolfApi = useCallback(async () => {
    setIsSearching(true);
    setStage('golfApi');
    try {
      const apiResults = await coursesService.searchAPI(query.trim());
      const mapped: SelectedCourse[] = (apiResults ?? []).map((course: any) => {
        const teeBoxes = coursesService.parseTeeBoxes(course);
        const maleTees = teeBoxes.filter((t) => t.gender === 'male');
        const defaultTee = maleTees[0] ?? teeBoxes[0];
        return {
          id: `gca_${course.id ?? course.club_name}`,
          name: course.club_name ?? course.name ?? '',
          city: course.city ?? course.location?.city ?? '',
          state: course.state ?? course.location?.state ?? '',
          par: defaultTee?.par ?? 72,
          source: 'golfapi' as const,
        };
      }).filter((c: SelectedCourse) => c.name);

      if (mapped.length > 0) {
        setResults(mapped);
      } else {
        setExhaustedStages((prev) => new Set([...prev, 'golfApi']));
      }
    } catch {
      setExhaustedStages((prev) => new Set([...prev, 'golfApi']));
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  // ─── Google Places fallback ────────────────────────────────────────

  const searchPlaces = useCallback(async () => {
    setIsSearching(true);
    setStage('places');
    try {
      const placesResults = await coursesService.searchGooglePlaces(query.trim());
      const mapped: SelectedCourse[] = placesResults.map((r: SearchResult) => ({
        id: r.id,
        name: r.name,
        city: r.city,
        state: r.state,
        par: r.par || undefined,
        source: 'google' as const,
      }));

      if (mapped.length > 0) {
        setResults(mapped);
      } else {
        setExhaustedStages((prev) => new Set([...prev, 'places']));
      }
    } catch {
      setExhaustedStages((prev) => new Set([...prev, 'places']));
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  // ─── Selection handler ─────────────────────────────────────────────

  const handleSelect = useCallback(async (course: SelectedCourse) => {
    haptics.light();

    // For external sources, ensure the course exists in Supabase
    if (course.source === 'golfapi' || course.source === 'google') {
      try {
        const loc = [course.city, course.state].filter(Boolean).join(', ');
        const saved = await coursesService.ensureCourse({
          name: course.name,
          location: loc,
        } as any);
        course = { ...course, id: saved.id };

        if (course.source === 'google') {
          showToast({ message: 'Rating and slope will be filled when first played', type: 'info' });
        }
      } catch {
        showToast({ message: 'Could not save course', type: 'error' });
        return;
      }
    }

    onChange(course);
    setShowDropdown(false);
    setQuery('');
  }, [onChange, showToast]);

  // ─── Clear ─────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    haptics.light();
    onChange(null);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setExhaustedStages(new Set());
    setStage('local');
  }, [onChange]);

  // ─── Selected state ────────────────────────────────────────────────

  if (value) {
    const loc = [value.city, value.state].filter(Boolean).join(', ');
    return (
      <View style={[styles.selectedContainer, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.selectedGoldBar, { backgroundColor: c.gold }]} />
        <Ionicons name="checkmark-circle" size={18} color={c.teal} style={styles.selectedCheck} />
        <View style={styles.selectedInfo}>
          <Text style={[styles.selectedName, { color: c.text, fontFamily: GEO }]} numberOfLines={1}>
            {value.name}
          </Text>
          {loc ? (
            <Text style={[styles.selectedLocation, { color: c.textMuted }]} numberOfLines={1}>
              {loc}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={handleClear} hitSlop={12}>
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>
    );
  }

  // ─── Search state ──────────────────────────────────────────────────

  const showGolfApiFallback = exhaustedStages.has('local') && !exhaustedStages.has('golfApi') && query.trim().length >= 2;
  const showPlacesFallback = exhaustedStages.has('golfApi') && !exhaustedStages.has('places') && query.trim().length >= 2;
  const showNoResults = exhaustedStages.has('places') && results.length === 0 && query.trim().length >= 2;

  return (
    <View style={styles.container}>
      <View style={[styles.inputRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.textMuted} />
        <TextInput
          style={[styles.input, { color: c.text }]}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={handleTextChange}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {isSearching && <ActivityIndicator size="small" color={c.gold} />}
      </View>

      {showDropdown && (
        <View style={[styles.dropdown, { backgroundColor: c.surface, borderColor: c.border }]}>
          {results.length > 0 && (
            <View style={styles.resultsList}>
              {results.slice(0, 5).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelect(item)}
                  style={[styles.resultRow, { borderBottomColor: c.border }]}
                >
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultName, { color: c.text, fontFamily: GEO }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.resultLocation, { color: c.textMuted }]} numberOfLines={1}>
                      {[item.city, item.state].filter(Boolean).join(', ')}
                      {item.source === 'golfapi' ? ' · GolfCourseAPI' : item.source === 'google' ? ' · Google Places' : ''}
                    </Text>
                  </View>
                  <Ionicons name="add" size={24} color={c.gold} />
                </Pressable>
              ))}
            </View>
          )}

          {/* GolfCourseAPI fallback row */}
          {showGolfApiFallback && (
            <Pressable
              onPress={searchGolfApi}
              style={[styles.fallbackRow, { borderTopColor: c.border }]}
              disabled={isSearching}
            >
              <Ionicons name="globe-outline" size={16} color={c.gold} />
              <Text style={[styles.fallbackText, { color: c.gold }]}>
                Search GolfCourseAPI for '{query.trim()}'
              </Text>
              {isSearching && stage === 'golfApi' && <ActivityIndicator size="small" color={c.gold} />}
            </Pressable>
          )}

          {/* Google Places fallback row */}
          {showPlacesFallback && (
            <Pressable
              onPress={searchPlaces}
              style={[styles.fallbackRow, { borderTopColor: c.border }]}
              disabled={isSearching}
            >
              <Ionicons name="location-outline" size={16} color={c.gold} />
              <Text style={[styles.fallbackText, { color: c.gold }]}>
                Search Google Places for '{query.trim()}'
              </Text>
              {isSearching && stage === 'places' && <ActivityIndicator size="small" color={c.gold} />}
            </Pressable>
          )}

          {/* No results anywhere */}
          {showNoResults && (
            <View style={styles.noResults}>
              <Text style={[styles.noResultsText, { color: c.textMuted }]}>
                No courses found for '{query.trim()}'
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  dropdown: {
    borderWidth: 1,
    marginTop: 2,
    maxHeight: 340,
  },
  resultsList: {
    maxHeight: 280,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultInfo: {
    flex: 1,
    marginRight: 12,
  },
  resultName: {
    fontSize: 16,
  },
  resultLocation: {
    fontSize: 13,
    marginTop: 2,
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fallbackText: {
    fontSize: 14,
    fontStyle: 'italic',
    flex: 1,
  },
  noResults: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Selected state
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  selectedGoldBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  selectedCheck: {
    marginLeft: 4,
    marginRight: 8,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 16,
  },
  selectedLocation: {
    fontSize: 13,
    marginTop: 1,
  },
});
