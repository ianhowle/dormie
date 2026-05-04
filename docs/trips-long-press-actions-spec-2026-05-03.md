# Trips Long-Press Quick Actions Spec

**Date created:** 2026-05-03
**Phase reference:** Item 8 from `docs/trips-product-vision-2026-05-03.md`
**Estimated time:** 45-60 minutes focused work
**Goal:** Add long-press quick actions on trip cards. Edit / Duplicate / Share / Delete. Power user polish that doesn't crowd the UI for casual users.

---

## Strategic Context

Reference `docs/trips-product-vision-2026-05-03.md` and `docs/dormie-strategy.md`.

Today users have to open a trip to do anything with it — even simple actions like sharing the invite code or deleting an old test trip. Power users (the trip organizer who runs 5+ trips per year) want faster paths. Long-press is the iOS-native pattern for surfacing contextual actions without crowding the default view.

This is intentionally NOT a context menu on tap (which would conflict with navigation) or a swipe action (which conflicts with horizontal scrolling). Long-press is the right gesture: discoverable to power users, invisible to casual users, doesn't change the default tap behavior.

---

## CRITICAL: Read Before Writing Any Code

Claude Code MUST read these files first to ground the work in actual codebase shape:

1. `app/(tabs)/trips.tsx` — confirm where TripCard is rendered, the navigation handler on tap
2. `src/components/trip/TripCard.tsx` — current Pressable structure, existing onPress handler
3. `src/services/trips.service.ts` — confirm we have `delete(tripId)` method; if not, we need to add it. Also need to confirm what data is needed to duplicate a trip
4. `app/create-trip.tsx` — to understand how a duplicated trip would prefill the wizard
5. Any existing Action Sheet patterns in the app — search for `Alert.alert` with multiple buttons or any custom action sheet component
6. `docs/trips-product-vision-2026-05-03.md` for vision context

If anything in this spec doesn't match actual code, adjust accordingly.

---

## Required Behavior

### Long-press gesture

- Long-press anywhere on a trip card (300-500ms hold) triggers an Action Sheet
- Light haptic on long-press recognition
- Action Sheet uses iOS-native `Alert.alert` with multiple buttons OR React Native `ActionSheetIOS` (if available — check the codebase pattern)

### Actions in the sheet

The four actions, in this order:

1. **Open Trip** — same as a regular tap. Useful so the long-press doesn't feel like it strands the user. Top of menu, default action.
2. **Edit Trip** — navigates to a trip edit flow (which doesn't exist yet — see "Edit Trip handling" below)
3. **Duplicate Trip** — creates a new trip with same metadata (name, format, side games, members) but blank dates and course. Navigates to create-trip wizard with prefilled state.
4. **Share Invite** — copies the trip's invite code to clipboard with a success toast. Quick way to share without opening the trip.
5. **Delete Trip** — destructive action, red text, confirmation alert before delete.
6. **Cancel** — close the sheet.

### Edit Trip handling

A full Edit Trip flow doesn't exist today. For tonight, we have three options:

**Option A — Hide the Edit option entirely until the flow exists.** Cleanest. Five actions become four.

**Option B — Show Edit but show "Coming soon" toast on tap.** Telegraphs the future feature. Risky if it lingers.

**Option C — Build a minimal Edit screen tonight.** Way out of scope for 60 minutes.

**Recommendation: Option A.** Hide Edit until the flow exists. Don't promise what isn't built. The remaining four actions (Open / Duplicate / Share / Delete) are valuable on their own.

### Duplicate Trip flow

When user taps Duplicate:
- Light haptic
- Navigate to `/create-trip` with prefilled state via query params or navigation state:
  - Trip name: `${original.name} (Copy)` (e.g. "Myrtle Beach 2025 (Copy)")
  - Format: same as original
  - Side games: same as original
  - Members (real users): same as original (excluding guests for v1, since guest re-add is fragile)
  - Course: blank (user picks new course)
  - Dates: blank (user picks new dates)
  - Stakes: same as original
- The create-trip wizard handles the prefill via the existing `?location=` pattern, just expanded to handle more params

### Share Invite flow

When user taps Share Invite:
- Light haptic
- Copy `trip.inviteCode` to clipboard via `Clipboard.setStringAsync`
- Show success toast: "Invite code copied: {code}"
- No system share sheet for v1 (that would require building share text, link, etc.) — just clipboard for now. Power users know what to do with a copied code.

### Delete Trip flow

When user taps Delete:
- Light haptic
- Show iOS-native confirmation alert:
  - Title: "Delete this trip?"
  - Body: "This can't be undone. The trip and all its members will be removed."
  - Buttons: Cancel (default) / Delete (destructive style)
- On confirm:
  - Call `tripsService.delete(tripId)` — confirm this method exists or add it
  - On success: success haptic, toast "Trip deleted", trip removed from list (refetch realTrips)
  - On error: error haptic, toast with error message

### Permissions

Only the trip organizer can Delete or Duplicate a trip. For non-organizer members:
- Open Trip — visible
- Share Invite — visible
- Duplicate Trip — hidden
- Delete Trip — hidden

So the menu adapts based on whether `trip.organizerId === user.id`.

---

## Implementation Steps

### Step 1 — Add long-press handler to TripCard

In `TripCard.tsx`:

```typescript
import { Pressable, Alert, ActionSheetIOS, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

interface TripCardProps {
  trip: Trip;
  showDays?: boolean;
  isDemo?: boolean;
  onLongPress?: (trip: Trip) => void;  // new
}

<Pressable
  onPress={() => onPress?.(trip)}
  onLongPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress?.(trip);
  }}
  delayLongPress={400}
  style={...}
>
```

Demo trips skip the long-press (no real actions to take):

```typescript
onLongPress={!isDemo ? () => { ... } : undefined}
```

### Step 2 — Action Sheet handler in app/(tabs)/trips.tsx

```typescript
import { ActionSheetIOS, Alert, Platform } from 'react-native';

const handleLongPress = (trip: Trip) => {
  const isOrganizer = trip.organizerId === user.id;

  const options: string[] = ['Open Trip', 'Share Invite'];
  if (isOrganizer) {
    options.push('Duplicate Trip');
    options.push('Delete Trip');
  }
  options.push('Cancel');

  const cancelButtonIndex = options.length - 1;
  const destructiveButtonIndex = isOrganizer ? options.indexOf('Delete Trip') : -1;

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
        title: trip.name,
      },
      (buttonIndex) => {
        const selected = options[buttonIndex];
        handleAction(trip, selected);
      }
    );
  } else {
    // Android fallback: use Alert with buttons (not as polished but functional)
    Alert.alert(
      trip.name,
      undefined,
      options.map((opt, idx) => ({
        text: opt,
        style: idx === cancelButtonIndex ? 'cancel' : (idx === destructiveButtonIndex ? 'destructive' : 'default'),
        onPress: () => idx !== cancelButtonIndex && handleAction(trip, opt),
      }))
    );
  }
};

const handleAction = async (trip: Trip, action: string) => {
  switch (action) {
    case 'Open Trip':
      router.push(`/trip-detail?tripId=${trip.id}`);
      break;
    case 'Share Invite':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Clipboard.setStringAsync(trip.inviteCode);
      showToast({ message: `Invite code copied: ${trip.inviteCode}`, type: 'success' });
      break;
    case 'Duplicate Trip':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Navigate to create-trip with prefilled state
      router.push({
        pathname: '/create-trip',
        params: {
          duplicateFromName: `${trip.name} (Copy)`,
          duplicateFromFormat: trip.format,
          duplicateFromSideGames: JSON.stringify(trip.sideGames || []),
          duplicateFromMemberIds: JSON.stringify(trip.members?.filter(m => m.user_id).map(m => m.user_id) || []),
          duplicateFromStakes: trip.stakes || '',
        },
      });
      break;
    case 'Delete Trip':
      Alert.alert(
        'Delete this trip?',
        "This can't be undone. The trip and all its members will be removed.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await tripsService.delete(trip.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast({ message: 'Trip deleted', type: 'success' });
                // Refetch trips
                if (user) {
                  const updated = await tripsService.getByUser(user.id);
                  setRealTrips(updated);
                }
              } catch (err: any) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                showToast({ message: err?.message || 'Could not delete trip', type: 'error' });
              }
            },
          },
        ]
      );
      break;
  }
};
```

Pass `handleLongPress` as the `onLongPress` prop to all real TripCards (skip demo trips).

### Step 3 — Confirm tripsService.delete exists

Check `src/services/trips.service.ts` for an existing delete method. If it exists, confirm it's safe (cascades correctly on related tables: trip_members, trip_courses, trip_invites, etc.).

If it doesn't exist, add it:

```typescript
async delete(tripId: string): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);
  if (error) throw error;
},
```

The Supabase RLS policy already restricts deletes to organizers (`trips_delete: organizer_id = auth.uid()`), so non-organizers can't successfully call this even if the UI mistakenly let them tap.

### Step 4 — Handle Duplicate prefill in create-trip.tsx

Add reading of the `duplicateFrom*` params:

```typescript
const params = useLocalSearchParams<{
  location?: string;
  duplicateFromName?: string;
  duplicateFromFormat?: string;
  duplicateFromSideGames?: string;
  duplicateFromMemberIds?: string;
  duplicateFromStakes?: string;
}>();

useEffect(() => {
  if (params.duplicateFromName) setTripName(params.duplicateFromName);
  if (params.duplicateFromFormat) setSelectedFormat(params.duplicateFromFormat as ScoringFormat);
  if (params.duplicateFromSideGames) {
    try {
      const games = JSON.parse(params.duplicateFromSideGames);
      setSelectedSideGames(games);
    } catch {}
  }
  if (params.duplicateFromMemberIds) {
    try {
      const memberIds = JSON.parse(params.duplicateFromMemberIds);
      // Need to fetch full user details for each id and add to selected players
      // This may require a friendsService.getByIds(ids) or similar
    } catch {}
  }
  if (params.duplicateFromStakes) setStakes(params.duplicateFromStakes);
}, [params.duplicateFromName, /* etc */]);
```

The member prefill is the trickiest part. Two options:
- **Option A (simpler):** Just prefill name/format/side games/stakes. Members must be re-added. Smaller scope, fewer edge cases.
- **Option B (full):** Resolve member IDs to full user objects and pre-populate the players list.

**Recommendation: Option A for tonight.** Members are easy to re-add via the AddPlayerSheet, and the friendsService might not have a simple "get users by IDs" method. Mark Option B as future work in compost pile.

If choosing Option A, just skip the duplicateFromMemberIds handling.

### Step 5 — Verify everything compiles and runs

`npx tsc --noEmit` should pass with no new errors. Run on device.

---

## Acceptance Criteria

- [ ] Long-press on a real trip card (400ms hold) triggers haptic + action sheet
- [ ] Action sheet shows trip name as title
- [ ] Action sheet shows correct options based on organizer status
- [ ] Open Trip action navigates correctly (same as tap)
- [ ] Share Invite copies invite code to clipboard with success toast
- [ ] Duplicate Trip navigates to create-trip with prefilled name (with " (Copy)" suffix), format, side games, stakes
- [ ] Delete Trip shows destructive confirmation alert
- [ ] Confirming delete actually deletes the trip and refetches the list
- [ ] Cancelling delete leaves the trip intact
- [ ] Non-organizers see only Open + Share Invite options
- [ ] Demo trips don't respond to long-press (or show a toast "Demo trips can't be modified")
- [ ] No regressions on existing tap behavior
- [ ] `npx tsc --noEmit` passes

---

## Edge Cases

- **Long-press on a live trip** — same actions available. Delete a live trip is allowed (organizer's choice).
- **Trip with status='completed'** — same actions, including Delete. Duplicate is fine — copy a completed trip to start a new one for next year.
- **Demo trip long-press** — show a toast "Demo trips can't be modified" instead of the action sheet. OR skip the long-press handler entirely. Pick one and stick with it.
- **Network failure on delete** — error toast with retry hint, trip stays in list.
- **Cascade deletion** — trip_members, trip_courses, trip_invites should cascade via existing FK constraints. Verify.

---

## Visual Design Notes

ActionSheetIOS is iOS-native — it inherits the system style. We don't customize it heavily.

For the toast on Share Invite, use the existing toast pattern with `type: 'success'`.

The destructive Delete style on iOS is automatic when using `destructiveButtonIndex`.

---

## Hand-Off Prompt for Claude Code

Paste this at the start of next session:

```
Read docs/trips-long-press-actions-spec-2026-05-03.md carefully. Single-feature implementation: long-press quick actions on trip cards (Item 8 from the Trips product vision).

Goal: power user polish — Open / Share Invite / Duplicate / Delete via long-press action sheet. Single commit.

Before writing code:
1. Read the spec
2. Read the 6 critical files listed
3. Confirm tripsService.delete exists or needs to be added
4. Decide between Option A (simpler member duplication) vs Option B (full prefill)
5. Summarize the implementation in your own words
6. Flag any spec assumptions that don't match the codebase

Then implement. Single commit when complete.

Run npx tsc --noEmit. Push.
```

---

*End of spec. Single feature, one focused session, ships clean power-user polish.*
