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

import { useEffect, useMemo, useState } from 'react';
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
import { useToast } from '../../../Toast';
import { tripsService } from '../../../../services/trips.service';
import { coursesService } from '../../../../services/courses.service';
import CourseLocationPicker from '../../../trip/CourseLocationPicker';
import type { SelectedCourse } from '../../../trip/CourseLocationPicker';
import { useWizard, type WizardLocationSelection } from '../WizardContext';


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
  const { showToast } = useToast();

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

  // Multi-course off-ramp: user wants Plan Ahead. Wipe wizard state
  // back to Step 0 and toast the next-release callout. The user can
  // then pick Plan Ahead from the persona fork once that flow ships.
  const handleMultiCourseOffRamp = () => {
    haptics.light();
    dispatch({ type: 'RESET_WIZARD' });
    showToast({
      message: 'Plan Ahead supports multi-course trips — coming next release',
      type: 'info',
    });
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

  // ─── Home course (read-only from user_metadata) ───────────────────
  // Set during signup wizard (app/auth/onboarding.tsx) or via Profile →
  // course-search. Stored on the auth user's metadata blob — three
  // fields with legacy fallback so accounts created before the field
  // rename still surface their home course.
  const homeCourse = useMemo<RecentCourse | null>(() => {
    const meta = (user?.user_metadata ?? {}) as {
      home_course_id?: string | null;
      home_course_name?: string | null;
      home_course?: string | null;
    };
    const id = meta.home_course_id ?? undefined;
    const name = (meta.home_course_name ?? meta.home_course ?? '').trim();
    if (!id && !name) return null;
    return {
      id: id ?? `home-${name}`, // synthetic id when only name is set
      name: name || 'Home course',
    };
  }, [user?.user_metadata]);

  const homeCourseHasRealId = !!user?.user_metadata?.home_course_id;

  // Fetch home-course location from the courses table when the user
  // has a real catalog id. user_metadata only stores id + name, so we
  // hydrate the rest here so the card can match the recent-course
  // card layout (name + location line).
  //
  // Read three fields with a fallback chain:
  //   1. city + state (preferred — matches recent-course rendering)
  //   2. location (always non-null per migration 003_courses.sql; used
  //      when city/state happen to be unpopulated on this row)
  //   3. nothing (line gracefully omits)
  //
  // Course type in database.types.ts doesn't expose city/state —
  // they exist in the DB schema but the generated types are out of
  // date (pre-existing baseline TS error at line 313). Using
  // `as any` matches the existing pattern in trips.service.ts's
  // getRecentCourses query.
  const [homeCourseLocation, setHomeCourseLocation] = useState<{
    city?: string;
    state?: string;
    location?: string;
  }>({});

  useEffect(() => {
    if (!homeCourseHasRealId || !homeCourse?.id) {
      setHomeCourseLocation({});
      return;
    }
    let cancelled = false;
    coursesService
      .getById(homeCourse.id)
      .then((course) => {
        if (cancelled) return;
        setHomeCourseLocation({
          city: (course as any).city ?? undefined,
          state: (course as any).state ?? undefined,
          location: course.location ?? undefined,
        });
      })
      .catch(() => {
        // Best-effort. Card just renders without the location line.
      });
    return () => {
      cancelled = true;
    };
  }, [homeCourse?.id, homeCourseHasRealId]);

  // Dedupe: when the home course also appears in the recent-courses
  // list, drop it from recents so the user doesn't see the same course
  // twice on the screen. Match by id when the home course has a real
  // catalog id; otherwise match by case-insensitive name.
  const dedupedRecentCourses = useMemo<RecentCourse[]>(() => {
    if (!homeCourse) return recentCourses;
    if (homeCourseHasRealId) {
      return recentCourses.filter((rc) => rc.id !== homeCourse.id);
    }
    const homeNameLower = homeCourse.name.trim().toLowerCase();
    return recentCourses.filter(
      (rc) => rc.name.trim().toLowerCase() !== homeNameLower,
    );
  }, [recentCourses, homeCourse, homeCourseHasRealId]);

  const showHomeCourseSection = homeCourse !== null && !showFreeText;

  // Recent-courses section render mode (Phase 2.9 audit):
  //   'list'   — non-empty deduped recents
  //   'empty'  — both home course AND recents are absent → render the
  //              section header + a muted placeholder so the user has
  //              orientation about where past courses surface
  //   'hidden' — free-text mode is open OR home course is present and
  //              there are no other recents (home course alone is
  //              enough orientation)
  const recentSectionMode: 'list' | 'empty' | 'hidden' = showFreeText
    ? 'hidden'
    : dedupedRecentCourses.length > 0
      ? 'list'
      : showHomeCourseSection
        ? 'hidden'
        : 'empty';
  const isCatalogSelected = !!state.course?.id;

  // Tap handler for the home course card. Mirrors the recent-courses
  // tap behavior but uses the home course's id (real or synthetic)
  // and name. Synthetic-id home courses route through SET_COURSE
  // without the catalog-id check so canAdvance treats them as
  // free-text matches (≥ 3 chars).
  const handleHomeCourseTap = () => {
    if (!homeCourse) return;
    haptics.light();
    if (homeCourseHasRealId) {
      dispatch({
        type: 'SET_COURSE',
        course: {
          id: homeCourse.id,
          name: homeCourse.name,
          source: 'local',
        },
      });
    } else {
      dispatch({
        type: 'SET_COURSE',
        course: {
          name: homeCourse.name,
          source: 'free-text',
        },
      });
    }
    setShowFreeText(false);
    setFreeTextInput('');
  };

  // Selection check: home course is "selected" when state.course's
  // id matches (catalog) or name matches (free-text).
  const homeCourseSelected = useMemo(() => {
    if (!homeCourse || !state.course) return false;
    if (homeCourseHasRealId && state.course.id) {
      return state.course.id === homeCourse.id;
    }
    return (
      state.course.name.trim().toLowerCase() ===
      homeCourse.name.trim().toLowerCase()
    );
  }, [homeCourse, homeCourseHasRealId, state.course]);

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

      {/* Autocomplete picker — top section per the Phase 2.9 layout
          reorder. Wraps the existing CourseLocationPicker as-is per
          the Phase 2 scope decision. Sponsor + education treatment
          deferred to v1.5 follow-up. */}
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
        </View>
      ) : null}

      {/* Your home course — single card, conditional on home_course_id
          OR home_course_name being set in user_metadata. Set during
          signup or Profile → course-search. Deduped against the
          recent-courses list below so the user never sees the same
          course twice. */}
      {showHomeCourseSection && homeCourse ? (
        <View style={s.recentSection}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            YOUR HOME COURSE
          </Text>
          <Pressable
            onPress={handleHomeCourseTap}
            style={({ pressed }) => [
              s.recentCard,
              {
                backgroundColor: c.cardBg,
                borderColor: homeCourseSelected ? '#006747' : c.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons
              name={homeCourseSelected ? 'checkmark-circle' : 'home-outline'}
              size={18}
              color={homeCourseSelected ? '#006747' : c.textMuted}
            />
            <View style={s.recentBody}>
              <Text
                style={[s.recentName, { color: c.text, fontFamily: GEO }]}
                numberOfLines={2}
              >
                {homeCourse.name}
              </Text>
              {(() => {
                // Fallback chain: city,state → location → nothing.
                const cityState = [
                  homeCourseLocation.city,
                  homeCourseLocation.state,
                ]
                  .filter(Boolean)
                  .join(', ');
                const line = cityState || homeCourseLocation.location || '';
                if (!line) return null;
                return (
                  <Text
                    style={[s.recentLocation, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {line}
                  </Text>
                );
              })()}
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* Recent courses section. Three render modes — see
          recentSectionMode derivation above:
            'list'   — non-empty deduped recents (normal case)
            'empty'  — header + muted placeholder (no home course, no
                       recents → user gets orientation about where
                       past courses will surface)
            'hidden' — free-text open, OR home course alone is enough
        */}
      {recentSectionMode === 'empty' ? (
        <View style={s.recentSection}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            RECENT COURSES
          </Text>
          <Text style={[s.recentEmpty, { color: c.textMuted }]}>
            Your past courses will show up here. For now, search above.
          </Text>
        </View>
      ) : null}
      {recentSectionMode === 'list' ? (
        <View style={s.recentSection}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            RECENT COURSES
          </Text>
          {dedupedRecentCourses.map((course) => {
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
                    backgroundColor: c.cardBg,
                    borderColor: selected ? '#006747' : c.border,
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

      {/* "Couldn't find your course?" link + multi-course off-ramp.
          Both visible when picker is open (free-text mode hides them
          along with the picker). */}
      {!showFreeText ? (
        <View>
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
          <Pressable
            onPress={handleMultiCourseOffRamp}
            hitSlop={8}
            style={({ pressed }) => [
              s.multiCourseLink,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <Text style={[s.multiCourseLinkText, { fontFamily: GEO }]}>
              Playing more than one course? Try Plan Ahead →
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
              { backgroundColor: c.cardBg, borderColor: c.border },
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
    marginBottom: 36,
  },

  /* Section label primitive */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 14,
  },

  /* Recent courses */
  recentSection: {
    // Section-to-section breathing room. Each section header sits 28pt
    // below the section above so YOUR HOME COURSE / RECENT COURSES
    // each read as their own composition rather than blurring into
    // the FIND A COURSE block. Bottom margin intentionally omitted —
    // gap-above is the rule across all sections.
    marginTop: 28,
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
  recentEmpty: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    paddingVertical: 6,
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
    // Link group sits 16pt below the last section. Tertiary
    // affordance — not a section, lighter than the 28pt section gap
    // above but enough to not collide with the section content.
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  freeTextLinkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  /* Multi-course off-ramp link — tertiary affordance, quieter than
     "Couldn't find your course?". Muted gold via reduced-opacity
     gold rgba so it reads as gold-toned without competing with the
     primary gold accents (section labels, selected pill labels). */
  multiCourseLink: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 8,
  },
  multiCourseLinkText: {
    fontSize: 12,
    color: 'rgba(201,162,39,0.65)',
    letterSpacing: 0.2,
  },
});
