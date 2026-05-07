// =============================================================
// Step 1 — Where
// =============================================================
// Location-first course selection with three input modes:
//   - "Recent courses" section (top): tap a card the user has played
//     before. Loaded via tripsService.getRecentCourses; section hidden
//     when the user has no history.
//   - Existing CourseLocationPicker (middle): autocomplete with the
//     three-stage fallback (local → GolfCourseAPI → Google Places).
//     Shipped as-is for Phase 2 — the spec's richer treatment
//     (sponsor + education layer) is deferred per the plan-review
//     note. Compost note logged for the v1.5 follow-up.
//   - "Couldn't find your course?" link (bottom): reveals a free-text
//     input. Used for muni rounds, foreign courses, etc.
//
// Validation gate (canAdvance): catalog match (course.id present) OR
// free-text name ≥ 3 characters. Lives in WizardContext.computeCanAdvance.
// =============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme/ThemeContext';
import { GEO } from '../../../../theme/fonts';
import { haptics } from '../../../../lib/haptics';
import { useAuth } from '../../../../lib/auth';
import { tripsService } from '../../../../services/trips.service';
import CourseLocationPicker from '../../../trip/CourseLocationPicker';
import type { SelectedCourse } from '../../../trip/CourseLocationPicker';
import { useWizard, type WizardLocationSelection } from '../WizardContext';

const HAIRLINE = 'rgba(255,255,255,0.06)';
const CARD_BG = '#151312';

interface RecentCourse {
  id: string;
  name: string;
  city?: string;
  state?: string;
}

export function Step1Where() {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();

  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([]);
  const [showFreeText, setShowFreeText] = useState(
    // If the user backs into this step with a free-text selection,
    // open the free-text input pre-filled rather than hiding it.
    !!state.course && !state.course.id,
  );
  const [freeTextInput, setFreeTextInput] = useState(
    state.course && !state.course.id ? state.course.name : '',
  );

  // ─── Load recent courses on mount ─────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    tripsService
      .getRecentCourses(user.id, 5)
      .then((courses) => {
        if (!cancelled) setRecentCourses(courses);
      })
      .catch(() => {
        // Best-effort; section just doesn't render on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ─── Selection handlers ───────────────────────────────────────────

  /** Convert a SelectedCourse from the picker (id required) into a
   *  WizardLocationSelection (id optional). */
  const toWizardLocation = (
    course: SelectedCourse,
  ): WizardLocationSelection => ({
    id: course.id,
    name: course.name,
    city: course.city || undefined,
    state: course.state || undefined,
    source: course.source,
  });

  const handlePickerChange = (course: SelectedCourse | null) => {
    if (course) {
      haptics.light();
      dispatch({ type: 'SET_COURSE', course: toWizardLocation(course) });
      // Picker selection wins over any in-progress free-text entry.
      setShowFreeText(false);
      setFreeTextInput('');
    } else {
      dispatch({ type: 'SET_COURSE', course: null });
    }
  };

  const handleRecentTap = (course: RecentCourse) => {
    haptics.light();
    dispatch({
      type: 'SET_COURSE',
      course: {
        id: course.id,
        name: course.name,
        city: course.city,
        state: course.state,
        source: 'local',
      },
    });
    setShowFreeText(false);
    setFreeTextInput('');
  };

  const handleRevealFreeText = () => {
    haptics.light();
    setShowFreeText(true);
    // Clear any catalog selection when switching to free-text mode so
    // the validation gate keys off the new input.
    if (state.course?.id) {
      dispatch({ type: 'SET_COURSE', course: null });
    }
  };

  const handleCancelFreeText = () => {
    haptics.light();
    setShowFreeText(false);
    setFreeTextInput('');
    dispatch({ type: 'SET_COURSE', course: null });
  };

  const handleFreeTextChange = (text: string) => {
    setFreeTextInput(text);
    // Push into wizard state so canAdvance tracks length live.
    dispatch({
      type: 'SET_COURSE',
      course: text.trim().length > 0
        ? { name: text, source: 'free-text' }
        : null,
    });
  };

  // ─── Render ───────────────────────────────────────────────────────

  const showRecentSection = recentCourses.length > 0 && !showFreeText;
  const isCatalogSelected = !!state.course?.id;

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
        Where are you playing?
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Type a course or city to start
      </Text>

      {/* Recent courses section — hidden when user has no history or
          when free-text mode is open. */}
      {showRecentSection ? (
        <View style={s.recentSection}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            RECENT COURSES
          </Text>
          {recentCourses.map((course) => {
            const selected = state.course?.id === course.id;
            const locationLine = [course.city, course.state]
              .filter(Boolean)
              .join(', ');
            return (
              <Pressable
                key={course.id}
                onPress={() => handleRecentTap(course)}
                style={({ pressed }) => [
                  s.recentCard,
                  {
                    backgroundColor: CARD_BG,
                    borderColor: selected ? '#006747' : HAIRLINE,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'flag-outline'}
                  size={18}
                  color={selected ? '#006747' : c.textMuted}
                />
                <View style={s.recentBody}>
                  <Text
                    style={[s.recentName, { color: c.text, fontFamily: GEO }]}
                    numberOfLines={1}
                  >
                    {course.name}
                  </Text>
                  {locationLine ? (
                    <Text
                      style={[s.recentLocation, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {locationLine}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Autocomplete picker — wraps the existing CourseLocationPicker
          as-is per the Phase 2 scope decision. Sponsor + education
          treatment deferred to v1.5 follow-up. */}
      {!showFreeText ? (
        <View style={s.pickerWrap}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            FIND A COURSE
          </Text>
          <CourseLocationPicker
            value={
              isCatalogSelected
                ? {
                    id: state.course!.id!,
                    name: state.course!.name,
                    city: state.course!.city ?? '',
                    state: state.course!.state ?? '',
                    source: state.course!.source as
                      | 'local'
                      | 'golfapi'
                      | 'google'
                      | undefined,
                  }
                : null
            }
            onChange={handlePickerChange}
            placeholder="Search courses..."
          />
          <Pressable
            onPress={handleRevealFreeText}
            hitSlop={8}
            style={({ pressed }) => [
              s.freeTextLink,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[s.freeTextLinkText, { color: c.textMuted }]}>
              Couldn't find your course? →
            </Text>
          </Pressable>
        </View>
      ) : (
        // Free-text fallback — for muni rounds, foreign courses, etc.
        <View style={s.freeTextSection}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            COURSE OR LOCATION
          </Text>
          <View
            style={[
              s.freeTextInputWrap,
              { backgroundColor: CARD_BG, borderColor: HAIRLINE },
            ]}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={c.textMuted}
              style={s.freeTextIcon}
            />
            <TextInput
              value={freeTextInput}
              onChangeText={handleFreeTextChange}
              placeholder="e.g., My Local Muni"
              placeholderTextColor={c.textMuted}
              style={[
                s.freeTextInput,
                { color: c.text, fontFamily: GEO },
              ]}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
            />
          </View>
          <Pressable
            onPress={handleCancelFreeText}
            hitSlop={8}
            style={({ pressed }) => [
              s.freeTextLink,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[s.freeTextLinkText, { color: c.textMuted }]}>
              ← Back to course search
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },

  /* Header */
  prompt: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
  },

  /* Section label primitive */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },

  /* Recent courses */
  recentSection: {
    marginBottom: 24,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  recentBody: {
    flex: 1,
  },
  recentName: {
    fontSize: 14,
    fontWeight: '700',
  },
  recentLocation: {
    fontSize: 12,
    marginTop: 2,
  },

  /* Picker wrap */
  pickerWrap: {
    marginTop: 4,
  },

  /* Free-text fallback */
  freeTextSection: {
    marginTop: 4,
  },
  freeTextInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 8,
  },
  freeTextIcon: {
    marginRight: 2,
  },
  freeTextInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },

  /* Free-text toggle link (used for both directions) */
  freeTextLink: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  freeTextLinkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
