// =============================================================
// Step 7 — Confirm + Launch
// =============================================================
// The integration step. Wires Phase 1 components (TripCardPreview,
// InvitePreview, DormieMomentTripLaunched) to the wizard state and
// the Supabase trip-creation flow.
//
// Two paths:
//   - Save as draft  → tripsService.create({ status: 'draft' }),
//                      no invitations, no cinematic, dismiss wizard
//                      with a "Trip saved as draft" toast.
//   - Create & invite → tripsService.create({ status: 'active' }),
//                      add course + members, mount the Trip Launched
//                      cinematic with full wizard data threaded
//                      through. onViewTrip lands the user on
//                      /trip-detail?tripId=<created>.
//
// Both buttons gate on meetsFireFloor() — disabled with reason copy
// when the bundle isn't launchable. The cinematic is the ONLY effect
// fired from "Create & invite"; Save as draft is silent (per spec).
// =============================================================

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme/ThemeContext';
import { GEO } from '../../../../theme/fonts';
import { haptics } from '../../../../lib/haptics';
import { useAuth } from '../../../../lib/auth';
import { useToast } from '../../../Toast';
import { tripsService } from '../../../../services/trips.service';
import { TripCardPreview } from '../../TripCardPreview';
import { InvitePreview } from '../../InvitePreview';
import { DormieMomentTripLaunched } from '../../trip-launched/DormieMomentTripLaunched';
import {
  buildAdaptiveTime,
  meetsFireFloor,
  type TripLaunchedPlayer,
} from '../../trip-launched/roster';
import type { Trip } from '../../../../lib/database.types';
import { useWizard } from '../WizardContext';
import {
  deriveTripName,
  formatDateRange,
  fireFloorReasonCopy,
  summarizeStakesForCinematic,
} from '../step7Helpers';
import { fromYMD } from '../dateHelpers';

// Re-export for any callers (tests, future shared use).
export {
  deriveTripName,
  formatDateRange,
  fireFloorReasonCopy,
  summarizeStakesForCinematic,
  fromYMD,
};

const HAIRLINE = 'rgba(255,255,255,0.06)';
const CARD_BG = '#151312';
const AUGUSTA = '#006747';
const GOLD = '#C9A227';

// Helpers extracted to ../step7Helpers and ../dateHelpers (testable
// from ts-node without RN imports). Re-exported above for any callers.

// =============================================================
// Component
// =============================================================

export function Step7Confirm() {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  // ─── Derived view-model ────────────────────────────────────────

  const derivedTripName = useMemo(() => {
    if (state.tripNameOverridden) return state.tripName;
    return deriveTripName(state.course?.name ?? '', state.startDate);
  }, [
    state.tripNameOverridden,
    state.tripName,
    state.course?.name,
    state.startDate,
  ]);

  const dateRange = useMemo(
    () => formatDateRange(state.startDate),
    [state.startDate],
  );

  const previewMembers = useMemo(
    () =>
      state.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isOrganizer: p.deliveryMethod === 'self',
      })),
    [state.players],
  );

  const inviteMembers = useMemo(
    () =>
      state.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        deliveryMethod:
          p.deliveryMethod === 'self'
            ? ('dormie' as const) // organizer; rendered specially via isOrganizer
            : p.deliveryMethod === 'dormie'
              ? ('dormie' as const)
              : p.deliveryMethod === 'sms'
                ? ('sms' as const)
                : ('guest' as const),
        phoneOrEmail: p.phoneOrEmail,
        isOrganizer: p.deliveryMethod === 'self',
      })),
    [state.players],
  );

  const fireFloor = useMemo(
    () =>
      meetsFireFloor({
        destination: state.course?.name,
        startDate: fromYMD(state.startDate) ?? undefined,
        players: state.players.map((p) => ({
          name: p.name,
          isYou: p.deliveryMethod === 'self',
        })),
      }),
    [state.course, state.startDate, state.players],
  );

  // ─── Local state ───────────────────────────────────────────────
  const [submitting, setSubmitting] = useState<'idle' | 'draft' | 'active'>(
    'idle',
  );
  const [cinematicTrip, setCinematicTrip] = useState<Trip | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // ─── Trip-name override editor ─────────────────────────────────

  const handleOpenEdit = () => {
    haptics.light();
    setNameInput(derivedTripName);
    setEditingName(true);
  };

  const handleSaveName = () => {
    const next = nameInput.trim();
    if (next.length === 0) {
      handleCancelEdit();
      return;
    }
    haptics.light();
    dispatch({ type: 'SET_TRIP_NAME', name: next });
    setEditingName(false);
  };

  const handleCancelEdit = () => {
    haptics.light();
    setNameInput('');
    setEditingName(false);
  };

  // ─── Trip creation ─────────────────────────────────────────────

  const buildAndCreate = async (
    status: 'draft' | 'active',
  ): Promise<Trip | null> => {
    if (!user?.id) {
      showToast({ message: 'Sign in to create a trip', type: 'error' });
      return null;
    }
    if (!fireFloor.ok) {
      // Defensive — buttons should be disabled in this state.
      return null;
    }

    const stakesString = summarizeStakesForCinematic(
      state.format,
      state.sideGames,
      state.perGameStakes,
    );

    try {
      // 1. Create the trip row (organizer auto-added by tripsService.create)
      const trip = await tripsService.create({
        name: derivedTripName.trim() || (state.course?.name ?? 'Trip'),
        location: state.course?.name ?? '',
        start_date: state.startDate,
        end_date: state.endDate || state.startDate,
        organizer_id: user.id,
        trip_type: 'quick',
        format: state.format ?? null,
        side_games: state.sideGames,
        stakes: stakesString ?? null,
        status,
      });

      // 2. Associate course (catalog match only — free-text doesn't
      //    have a course id to link)
      if (state.course?.id) {
        try {
          await tripsService.addCourse({
            trip_id: trip.id,
            course_id: state.course.id,
            day_number: 1,
          });
        } catch (courseErr) {
          // Non-fatal — trip exists, course association can be added
          // later from trip detail. Surface a soft warning.
          console.warn('[CreateTrip] addCourse failed', courseErr);
        }
      }

      // 3. Add other players. 'self' is auto-added by tripsService.create
      //    so skip it. 'dormie' players become user_id rows; 'sms' and
      //    'guest' players become guest_name rows. Phase 2 doesn't send
      //    SMS — Phase 7's InvitePreview surfaces a copy-link affordance
      //    after creation.
      const otherPlayers = state.players.filter(
        (p) => p.deliveryMethod !== 'self',
      );
      if (otherPlayers.length > 0) {
        const memberInputs = otherPlayers.map((p) => {
          if (p.deliveryMethod === 'dormie' && p.user_id) {
            return { user_id: p.user_id, role: 'player' as const };
          }
          // 'sms' and 'guest' — store as guest_name. Future SMS-accept
          // flow can update the row to a real user_id when the invitee
          // joins Dormie.
          return { guest_name: p.name, handicap: p.handicap };
        });
        await tripsService.addMembers(trip.id, memberInputs);
      }

      return trip;
    } catch (err: any) {
      haptics.error();
      const msg = err?.message ?? 'Could not create trip';
      showToast({ message: msg, type: 'error' });
      console.error('[CreateTripQuick] failed', err);
      return null;
    }
  };

  const handleSaveDraft = async () => {
    if (submitting !== 'idle' || !fireFloor.ok) return;
    haptics.light();
    setSubmitting('draft');
    const trip = await buildAndCreate('draft');
    setSubmitting('idle');
    if (trip) {
      haptics.success();
      showToast({
        message: 'Trip saved as draft',
        type: 'gold',
        icon: 'document-outline',
      });
      // Dismiss the wizard. The route's caller (Trips tab in production,
      // Profile dev harness in 2.0–2.8) handles the back navigation.
      router.back();
    }
  };

  const handleCreateAndInvite = async () => {
    if (submitting !== 'idle' || !fireFloor.ok) return;
    haptics.light();
    setSubmitting('active');
    const trip = await buildAndCreate('active');
    setSubmitting('idle');
    if (trip) {
      // Don't fire success haptic here — the cinematic's haptics.heavy()
      // at t=0 IS the launch tactile commit.
      setCinematicTrip(trip);
    }
  };

  const handleViewTrip = () => {
    const tripId = cinematicTrip?.id;
    setCinematicTrip(null);
    if (tripId) {
      router.replace({
        pathname: '/trip-detail',
        params: { tripId },
      });
    } else {
      router.back();
    }
  };

  // ─── Cinematic prop derivation ─────────────────────────────────

  const adaptiveTime = useMemo(() => {
    const start = fromYMD(state.startDate);
    if (!start) return null;
    return buildAdaptiveTime({ startDate: start });
  }, [state.startDate]);

  const cinematicPlayers: TripLaunchedPlayer[] = useMemo(
    () =>
      state.players.map((p) => ({
        name: p.name,
        avatarUrl: p.avatarUrl,
        isYou: p.deliveryMethod === 'self',
      })),
    [state.players],
  );

  const cinematicStakes = useMemo(
    () =>
      summarizeStakesForCinematic(
        state.format,
        state.sideGames,
        state.perGameStakes,
      ),
    [state.format, state.sideGames, state.perGameStakes],
  );

  // ─── Render ────────────────────────────────────────────────────

  const isSubmitting = submitting !== 'idle';
  const buttonsDisabled = !fireFloor.ok || isSubmitting;

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
        Ready to launch?
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Review your trip and either save as a draft or launch it now.
      </Text>

      {/* Trip name override editor (revealed via TripCardPreview onEdit) */}
      {editingName ? (
        <View
          style={[
            s.nameEditor,
            { backgroundColor: CARD_BG, borderColor: HAIRLINE },
          ]}
        >
          <Text style={[s.editorLabel, { color: c.gold, fontFamily: GEO }]}>
            TRIP NAME
          </Text>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder={derivedTripName}
            placeholderTextColor={c.textMuted}
            style={[s.editorInput, { color: c.text, fontFamily: GEO }]}
            autoCapitalize="words"
            autoFocus
          />
          <View style={s.editorActions}>
            <Pressable
              onPress={handleCancelEdit}
              style={({ pressed }) => [
                s.editorCancelBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={8}
            >
              <Text
                style={[s.editorCancelText, { color: c.textMuted, fontFamily: GEO }]}
              >
                CANCEL
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSaveName}
              style={({ pressed }) => [
                s.editorSaveBtn,
                { backgroundColor: AUGUSTA, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[s.editorSaveText, { color: GOLD, fontFamily: GEO }]}>
                SAVE
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Section 1 — Trip card preview */}
      {state.format ? (
        <View style={s.section}>
          <TripCardPreview
            name={derivedTripName}
            destination={state.course?.name ?? ''}
            dateRange={dateRange}
            members={previewMembers}
            format={state.format}
            sideGames={state.sideGames}
            tripType="quick"
            onEdit={editingName ? undefined : handleOpenEdit}
          />
        </View>
      ) : null}

      {/* Section 2 — Invite preview */}
      <View style={s.section}>
        <InvitePreview
          members={inviteMembers}
          onAddPlayer={() => {
            haptics.light();
            // Jump back to Step 3 — the wizard's prior selections
            // remain in state so the player list is preserved.
            dispatch({ type: 'GOTO_STEP', step: 3 });
          }}
        />
      </View>

      {/* Section 3 — Action buttons */}
      <View style={s.actions}>
        {!fireFloor.ok && fireFloor.reason ? (
          <Text
            style={[s.disabledReason, { color: c.textMuted, fontFamily: GEO }]}
          >
            {fireFloorReasonCopy(fireFloor.reason)}
          </Text>
        ) : null}

        <Pressable
          onPress={handleCreateAndInvite}
          disabled={buttonsDisabled}
          style={({ pressed }) => [
            s.primaryBtn,
            {
              backgroundColor: !buttonsDisabled ? AUGUSTA : c.elevated,
              borderWidth: !buttonsDisabled ? 0 : 1,
              borderColor: !buttonsDisabled ? 'transparent' : HAIRLINE,
              opacity: pressed && !buttonsDisabled ? 0.85 : 1,
            },
            buttonsDisabled && { opacity: 0.6 },
          ]}
        >
          {submitting === 'active' ? (
            <ActivityIndicator size="small" color={GOLD} />
          ) : (
            <>
              <Text
                style={[
                  s.primaryBtnText,
                  {
                    color: !buttonsDisabled ? GOLD : c.textMuted,
                    fontFamily: GEO,
                  },
                ]}
              >
                CREATE TRIP & INVITE ALL
              </Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={!buttonsDisabled ? GOLD : c.textMuted}
              />
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleSaveDraft}
          disabled={buttonsDisabled}
          style={({ pressed }) => [
            s.secondaryBtn,
            {
              borderColor: HAIRLINE,
              opacity: pressed && !buttonsDisabled ? 0.7 : 1,
            },
            buttonsDisabled && { opacity: 0.5 },
          ]}
        >
          {submitting === 'draft' ? (
            <ActivityIndicator size="small" color={c.textMuted} />
          ) : (
            <Text
              style={[s.secondaryBtnText, { color: c.textMuted, fontFamily: GEO }]}
            >
              SAVE AS DRAFT
            </Text>
          )}
        </Pressable>
      </View>

      {/* Cinematic — fires only on Create & invite path */}
      {cinematicTrip && adaptiveTime ? (
        <DormieMomentTripLaunched
          visible={!!cinematicTrip}
          onViewTrip={handleViewTrip}
          destination={state.course?.name ?? ''}
          datePrimary={adaptiveTime.primary}
          dateSecondary={adaptiveTime.secondary}
          players={cinematicPlayers}
          stakes={cinematicStakes}
          format={state.format ?? undefined}
        />
      ) : null}
    </ScrollView>
  );
}

// =============================================================
// Styles
// =============================================================

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
    lineHeight: 18,
  },

  /* Section primitive */
  section: {
    marginBottom: 20,
  },

  /* Trip name editor */
  nameEditor: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  editorLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  editorInput: {
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  editorCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editorCancelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  editorSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editorSaveText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  /* Action area */
  actions: {
    marginTop: 8,
    gap: 10,
  },
  disabledReason: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
