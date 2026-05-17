// =============================================================
// Step 3 — Who
// =============================================================
// Player selection with the wizard owner ("You") always pinned at the
// top and four embedded inline tabs for adding others. Solo trips are
// valid (just the user). No min, no max for v1.
//
// Top section — player list:
//   - "You" tile, gold border + ring, no remove affordance
//   - Each added player: avatar + name + delivery method line + (×) remove
//
// Tabs (embedded inline, NOT modal):
//   - Friends — multi-select from existing Dormie connections via
//     friendsService.getActiveFriends. Tap toggles state.players.
//   - Recent  — multi-select from past co-players via the
//     get_recent_co_players RPC. Tap toggles state.players.
//   - Invite  — name + phone form. Stored as a 'sms' delivery row.
//     The actual invite link is generated and surfaced in Step 7's
//     InvitePreview after the trip is created in Supabase.
//   - Guest   — name form. Stored as a 'guest' delivery row. No
//     invitation fires; included only for offline/local scoring.
//
// Self-seed: on first mount, if state.players is empty (or doesn't
// contain a 'self' row), append the current auth user as 'self'.
//
// Validation: solo is valid → state.players must include the 'self'
// row at length ≥ 1. Self-seed guarantees this so canAdvance is
// effectively always true on Step 3 once the user is loaded.
// =============================================================

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme/ThemeContext';
import { GEO } from '../../../../theme/fonts';
import { haptics } from '../../../../lib/haptics';
import { useAuth } from '../../../../lib/auth';
import { Avatar } from '../../../Avatar';
import { friendsService } from '../../../../services/friends.service';
import { supabase } from '../../../../lib/supabase';
import type { FriendshipWithUser } from '../../../../lib/database.types';
import { useWizard, type WizardPlayer } from '../WizardContext';
import { formatUSPhone, digitsOnly } from '../phoneHelpers';

// Re-export for any callers (tests, future shared use).
export { formatUSPhone, digitsOnly };

const AUGUSTA = '#006747';
const GOLD = '#C9A227';

type TabKey = 'friends' | 'recent' | 'invite' | 'guest';

interface CoPlayer {
  id: string;
  name: string;
  handicap_index: number | null;
  avatar_url: string | null;
  last_played_at: string;
  rounds_together: number;
}

// Phone helpers extracted to ../phoneHelpers (testable from ts-node
// without RN imports). Re-exported above for any callers.

// =============================================================
// Top-level Step 3 component
// =============================================================

export function Step3Who() {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('friends');

  // ─── Self-seed ─────────────────────────────────────────────────────
  // On first mount (and whenever the auth user resolves), make sure
  // 'self' is present at index 0. Re-runs are de-duped by the reducer.
  useEffect(() => {
    if (!user?.id) return;
    const hasSelf = state.players.some((p) => p.deliveryMethod === 'self');
    if (hasSelf) return;
    const meta = (user.user_metadata ?? {}) as {
      name?: string;
      handicap_index?: number;
      avatar_url?: string;
    };
    dispatch({
      type: 'ADD_PLAYER',
      player: {
        id: user.id,
        name: meta.name ?? user.email ?? 'You',
        deliveryMethod: 'self',
        avatarUrl: meta.avatar_url ?? undefined,
        user_id: user.id,
        handicap: meta.handicap_index ?? undefined,
      },
    });
  }, [user?.id, user?.user_metadata, state.players, dispatch]);

  // Set of player ids currently in state — drives the Friends/Recent
  // tabs' selection indicators (and de-duplicates "already added" rows).
  const selectedIds = useMemo(
    () => new Set(state.players.map((p) => p.id)),
    [state.players],
  );

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
        Who's playing?
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Add yourself plus invitees, or just go solo.
      </Text>

      {/* Player list */}
      <View style={s.playerList}>
        {state.players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            onRemove={() => dispatch({ type: 'REMOVE_PLAYER', playerId: player.id })}
          />
        ))}
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { borderBottomColor: c.border }]}>
        {(['friends', 'recent', 'invite', 'guest'] as TabKey[]).map((key) => {
          const active = key === activeTab;
          const label =
            key === 'friends' ? 'Friends'
            : key === 'recent' ? 'Recent'
            : key === 'invite' ? 'Invite'
            : 'Guest';
          const icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap =
            key === 'friends' ? 'people-outline'
            : key === 'recent' ? 'time-outline'
            : key === 'invite' ? 'send-outline'
            : 'person-add-outline';
          return (
            <Pressable
              key={key}
              onPress={() => {
                haptics.light();
                setActiveTab(key);
              }}
              style={s.tabBtn}
            >
              <View style={s.tabBtnInner}>
                <Ionicons
                  name={icon}
                  size={14}
                  color={active ? GOLD : c.textMuted}
                />
                <Text
                  style={[
                    s.tabLabel,
                    {
                      color: active ? GOLD : c.textMuted,
                      fontFamily: GEO,
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
              {active ? (
                <View style={[s.tabIndicator, { backgroundColor: GOLD }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Active tab content */}
      <View style={s.tabContent}>
        {activeTab === 'friends' ? (
          <FriendsTab selectedIds={selectedIds} />
        ) : activeTab === 'recent' ? (
          <RecentTab selectedIds={selectedIds} />
        ) : activeTab === 'invite' ? (
          <InviteTab />
        ) : (
          <GuestTab />
        )}
      </View>
    </ScrollView>
  );
}

// =============================================================
// Player row (player list)
// =============================================================

function PlayerRow({
  player,
  onRemove,
}: {
  player: WizardPlayer;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isSelf = player.deliveryMethod === 'self';
  const deliveryLabel =
    isSelf ? 'You'
    : player.deliveryMethod === 'dormie' ? 'via Dormie'
    : player.deliveryMethod === 'sms' ? `via SMS${player.phoneOrEmail ? ` — ${player.phoneOrEmail}` : ''}`
    : 'Guest player';

  return (
    <View
      style={[
        s.playerRow,
        {
          backgroundColor: c.cardBg,
          borderColor: isSelf ? GOLD : c.border,
          borderWidth: isSelf ? 1.5 : 1,
        },
      ]}
    >
      <Avatar
        id={player.id}
        name={player.name}
        photoUrl={player.avatarUrl}
        size={36}
      />
      <View style={s.playerBody}>
        <Text
          style={[s.playerName, { color: c.text, fontFamily: GEO }]}
          numberOfLines={1}
        >
          {player.name}
        </Text>
        <Text
          style={[s.playerDelivery, { color: isSelf ? GOLD : c.textMuted }]}
          numberOfLines={1}
        >
          {deliveryLabel}
        </Text>
      </View>
      {isSelf ? null : (
        <Pressable
          onPress={() => {
            haptics.light();
            onRemove();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            s.removeBtn,
            { opacity: pressed ? 0.5 : 1 },
          ]}
          accessibilityLabel={`Remove ${player.name}`}
        >
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

// =============================================================
// Friends tab
// =============================================================

function FriendsTab({ selectedIds }: { selectedIds: Set<string> }) {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();

  const [friends, setFriends] = useState<FriendshipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    friendsService
      .getActiveFriends(user.id)
      .then((data) => setFriends(data))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.friend?.name?.toLowerCase().includes(q));
  }, [friends, search]);

  const handleToggle = (friend: FriendshipWithUser['friend']) => {
    haptics.light();
    if (selectedIds.has(friend.id)) {
      dispatch({ type: 'REMOVE_PLAYER', playerId: friend.id });
    } else {
      dispatch({
        type: 'ADD_PLAYER',
        player: {
          id: friend.id,
          name: friend.name,
          deliveryMethod: 'dormie',
          user_id: friend.id,
          handicap: friend.handicap_index ?? undefined,
        },
      });
    }
  };

  if (loading) {
    return (
      <View style={s.tabEmpty}>
        <ActivityIndicator size="small" color={c.textMuted} />
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={s.tabEmpty}>
        <Ionicons name="people-outline" size={32} color={c.textMuted} />
        <Text style={[s.emptyTitle, { color: c.text, fontFamily: GEO }]}>
          No crew yet
        </Text>
        <Text style={[s.emptySub, { color: c.textMuted }]}>
          Add Dormie friends from your profile, then invite them here.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Search */}
      <View
        style={[
          s.searchWrap,
          { backgroundColor: c.cardBg, borderColor: c.border },
        ]}
      >
        <Ionicons name="search" size={14} color={c.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search friends..."
          placeholderTextColor={c.textMuted}
          style={[s.searchInput, { color: c.text, fontFamily: GEO }]}
          autoCapitalize="none"
        />
      </View>

      {/* Selectable rows */}
      {filtered.map((item) => {
        const friend = item.friend;
        if (!friend) return null;
        const selected = selectedIds.has(friend.id);
        return (
          <Pressable
            key={friend.id}
            onPress={() => handleToggle(friend)}
            style={({ pressed }) => [
              s.selectRow,
              {
                backgroundColor: c.cardBg,
                borderColor: selected ? AUGUSTA : c.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Avatar id={friend.id} name={friend.name} size={32} />
            <View style={s.selectBody}>
              <Text
                style={[s.selectName, { color: c.text, fontFamily: GEO }]}
                numberOfLines={1}
              >
                {friend.name}
              </Text>
              {friend.handicap_index != null ? (
                <Text style={[s.selectSub, { color: c.textMuted }]}>
                  {friend.handicap_index} HCP
                </Text>
              ) : null}
            </View>
            <View
              style={[
                s.checkbox,
                {
                  backgroundColor: selected ? AUGUSTA : 'transparent',
                  borderColor: selected ? AUGUSTA : c.textMuted,
                },
              ]}
            >
              {selected ? (
                <Ionicons name="checkmark" size={14} color={GOLD} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// =============================================================
// Recent tab
// =============================================================

function RecentTab({ selectedIds }: { selectedIds: Set<string> }) {
  const { dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();

  const [coPlayers, setCoPlayers] = useState<CoPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    supabase
      .rpc('get_recent_co_players', { p_user_id: user.id, p_days: 90 })
      .then(
        ({ data, error }) => {
          if (!error && Array.isArray(data)) setCoPlayers(data as CoPlayer[]);
          setLoading(false);
        },
        () => setLoading(false),
      );
  }, [user?.id]);

  const handleToggle = (cp: CoPlayer) => {
    haptics.light();
    if (selectedIds.has(cp.id)) {
      dispatch({ type: 'REMOVE_PLAYER', playerId: cp.id });
    } else {
      dispatch({
        type: 'ADD_PLAYER',
        player: {
          id: cp.id,
          name: cp.name,
          deliveryMethod: 'dormie',
          avatarUrl: cp.avatar_url ?? undefined,
          user_id: cp.id,
          handicap: cp.handicap_index ?? undefined,
        },
      });
    }
  };

  if (loading) {
    return (
      <View style={s.tabEmpty}>
        <ActivityIndicator size="small" color={c.textMuted} />
      </View>
    );
  }

  if (coPlayers.length === 0) {
    return (
      <View style={s.tabEmpty}>
        <Ionicons name="time-outline" size={32} color={c.textMuted} />
        <Text style={[s.emptyTitle, { color: c.text, fontFamily: GEO }]}>
          Nobody recent
        </Text>
        <Text style={[s.emptySub, { color: c.textMuted }]}>
          Play a round with someone and they'll surface here next time.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {coPlayers.map((cp) => {
        const selected = selectedIds.has(cp.id);
        const daysAgo = Math.floor(
          (Date.now() - new Date(cp.last_played_at).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return (
          <Pressable
            key={cp.id}
            onPress={() => handleToggle(cp)}
            style={({ pressed }) => [
              s.selectRow,
              {
                backgroundColor: c.cardBg,
                borderColor: selected ? AUGUSTA : c.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Avatar
              id={cp.id}
              name={cp.name}
              photoUrl={cp.avatar_url ?? undefined}
              size={32}
            />
            <View style={s.selectBody}>
              <Text
                style={[s.selectName, { color: c.text, fontFamily: GEO }]}
                numberOfLines={1}
              >
                {cp.name}
              </Text>
              <Text style={[s.selectSub, { color: c.textMuted }]}>
                {`${cp.rounds_together} round${cp.rounds_together !== 1 ? 's' : ''} · ${daysAgo}d ago`}
              </Text>
            </View>
            <View
              style={[
                s.checkbox,
                {
                  backgroundColor: selected ? AUGUSTA : 'transparent',
                  borderColor: selected ? AUGUSTA : c.textMuted,
                },
              ]}
            >
              {selected ? (
                <Ionicons name="checkmark" size={14} color={GOLD} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// =============================================================
// Invite tab — name + phone form, stores as 'sms' delivery row
// =============================================================

function InviteTab() {
  const { dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;

  const [name, setName] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');

  const phoneDigits = useMemo(() => digitsOnly(phoneDisplay), [phoneDisplay]);
  const canAdd = name.trim().length > 0 && phoneDigits.length >= 10;

  const handleAdd = () => {
    if (!canAdd) return;
    haptics.success();
    const id = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    dispatch({
      type: 'ADD_PLAYER',
      player: {
        id,
        name: name.trim(),
        deliveryMethod: 'sms',
        phoneOrEmail: phoneDisplay,
      },
    });
    setName('');
    setPhoneDisplay('');
  };

  return (
    <View style={s.formBlock}>
      <Text style={[s.formHint, { color: c.textMuted }]}>
        We'll create an SMS invite link on launch. You'll copy the link to
        your messages from the next step.
      </Text>

      <Text style={[s.fieldLabel, { color: c.gold, fontFamily: GEO }]}>
        NAME
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Friend's name"
        placeholderTextColor={c.textMuted}
        autoCapitalize="words"
        style={[
          s.formInput,
          { backgroundColor: c.cardBg, borderColor: c.border, color: c.text, fontFamily: GEO },
        ]}
      />

      <Text style={[s.fieldLabel, { color: c.gold, fontFamily: GEO }]}>
        PHONE
      </Text>
      <TextInput
        value={phoneDisplay}
        onChangeText={(raw) => setPhoneDisplay(formatUSPhone(raw))}
        placeholder="(555) 555-5555"
        placeholderTextColor={c.textMuted}
        keyboardType="phone-pad"
        style={[
          s.formInput,
          { backgroundColor: c.cardBg, borderColor: c.border, color: c.text, fontFamily: GEO },
        ]}
      />

      <Pressable
        onPress={handleAdd}
        disabled={!canAdd}
        style={({ pressed }) => [
          s.addBtn,
          {
            backgroundColor: canAdd ? AUGUSTA : c.elevated,
            opacity: pressed && canAdd ? 0.85 : !canAdd ? 0.5 : 1,
          },
        ]}
      >
        <Ionicons
          name="send"
          size={14}
          color={canAdd ? GOLD : c.textMuted}
        />
        <Text
          style={[
            s.addBtnText,
            {
              color: canAdd ? GOLD : c.textMuted,
              fontFamily: GEO,
            },
          ]}
        >
          ADD VIA SMS
        </Text>
      </Pressable>
    </View>
  );
}

// =============================================================
// Guest tab — name only, stored as 'guest' delivery row
// =============================================================

function GuestTab() {
  const { dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;

  const [name, setName] = useState('');
  const canAdd = name.trim().length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    haptics.success();
    const id = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    dispatch({
      type: 'ADD_PLAYER',
      player: {
        id,
        name: name.trim(),
        deliveryMethod: 'guest',
      },
    });
    setName('');
  };

  return (
    <View style={s.formBlock}>
      <Text style={[s.formHint, { color: c.textMuted }]}>
        For players who aren't on Dormie. They'll appear in scoring but
        won't get an invitation.
      </Text>

      <Text style={[s.fieldLabel, { color: c.gold, fontFamily: GEO }]}>
        NAME
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Guest name"
        placeholderTextColor={c.textMuted}
        autoCapitalize="words"
        style={[
          s.formInput,
          { backgroundColor: c.cardBg, borderColor: c.border, color: c.text, fontFamily: GEO },
        ]}
      />

      <Pressable
        onPress={handleAdd}
        disabled={!canAdd}
        style={({ pressed }) => [
          s.addBtn,
          {
            backgroundColor: canAdd ? AUGUSTA : c.elevated,
            opacity: pressed && canAdd ? 0.85 : !canAdd ? 0.5 : 1,
          },
        ]}
      >
        <Ionicons
          name="person-add"
          size={14}
          color={canAdd ? GOLD : c.textMuted}
        />
        <Text
          style={[
            s.addBtnText,
            { color: canAdd ? GOLD : c.textMuted, fontFamily: GEO },
          ]}
        >
          ADD GUEST
        </Text>
      </Pressable>
    </View>
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
    marginBottom: 20,
  },

  /* Player list */
  playerList: {
    gap: 8,
    marginBottom: 24,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  playerBody: { flex: 1 },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  playerDelivery: {
    fontSize: 12,
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
  },

  /* Tab content */
  tabContent: {
    paddingTop: 16,
  },
  tabEmpty: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },

  /* Selectable row (Friends + Recent) */
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  selectBody: { flex: 1 },
  selectName: {
    fontSize: 14,
    fontWeight: '700',
  },
  selectSub: {
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Form (Invite + Guest) */
  formBlock: {
    gap: 8,
  },
  formHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 8,
  },
  formInput: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 16,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
