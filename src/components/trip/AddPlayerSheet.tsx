import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import { useToast } from '../Toast';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../Avatar';
import { friendsService } from '../../services/friends.service';
import { supabase } from '../../lib/supabase';
import type { FriendshipWithUser } from '../../lib/database.types';

// ─── Types ─────────────────────────────────────────────────────────────

export type PendingPlayer = {
  user_id?: string;
  guest_name?: string;
  name: string;
  handicap: number;
  source: 'friends' | 'recent' | 'guest' | 'invite';
};

type ExistingPlayer = {
  id: string;
  name: string;
};

interface AddPlayerSheetProps {
  tripId?: string;
  tripName?: string;
  tripInviteCode?: string;
  existingPlayers: ExistingPlayer[];
  onAddPlayers: (players: PendingPlayer[]) => void;
  onClose: () => void;
  isVisible: boolean;
}

type Tab = 'friends' | 'recent' | 'guest';

type CoPlayer = {
  id: string;
  name: string;
  handicap_index: number | null;
  avatar_url: string | null;
  last_played_at: string;
  rounds_together: number;
};

// ─── Tab bar ───────────────────────────────────────────────────────────

function SheetTabBar({ tab, onSelect, colors: c }: { tab: Tab; onSelect: (t: Tab) => void; colors: any }) {
  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'friends', label: 'Friends', icon: 'people-outline' },
    { key: 'recent', label: 'Recent', icon: 'time-outline' },
    { key: 'guest', label: 'Guest', icon: 'person-add-outline' },
  ];
  return (
    <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
      {tabs.map((t) => {
        const active = t.key === tab;
        return (
          <Pressable
            key={t.key}
            onPress={() => { haptics.light(); onSelect(t.key); }}
            style={styles.tabItem}
          >
            <View style={styles.tabItemInner}>
              <Ionicons name={t.icon} size={16} color={active ? c.teal : c.textMuted} />
              <Text style={[styles.tabLabel, { color: active ? c.teal : c.textMuted }]}>
                {t.label}
              </Text>
            </View>
            {active && <View style={[styles.tabIndicator, { backgroundColor: c.teal }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Friends Tab ───────────────────────────────────────────────────────

function FriendsTab({
  existingPlayerIds,
  selected,
  onToggle,
}: {
  existingPlayerIds: Set<string>;
  selected: Map<string, PendingPlayer>;
  onToggle: (player: PendingPlayer) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const router = useRouter();

  const [friends, setFriends] = useState<FriendshipWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    friendsService.getActiveFriends(user.id)
      .then(setFriends)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const filteredFriends = searchQuery.trim()
    ? friends.filter((f) => {
        const friend = (f as any).friend;
        return friend?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : friends;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.teal} />
      </View>
    );
  }

  if (friends.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="people-outline" size={48} color={c.textMuted} />
        <Text style={[styles.emptyTitle, { color: c.text }]}>No friends yet</Text>
        <Text style={[styles.emptySubtitle, { color: c.textMuted }]}>
          Add someone to your crew to invite them to trips
        </Text>
        <Pressable
          onPress={() => { haptics.light(); router.push('/add-friends'); }}
          style={[styles.emptyBtn, { backgroundColor: c.teal }]}
        >
          <Text style={styles.emptyBtnText}>Add Friends</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <View style={[styles.searchRow, { borderBottomColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          placeholder="Search friends..."
          placeholderTextColor={c.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </View>
      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const friend = (item as any).friend as any;
          if (!friend) return null;
          const isExisting = existingPlayerIds.has(friend.id);
          const isSelected = selected.has(friend.id);
          const handicap = friend.handicap_index ?? 0;

          return (
            <Pressable
              onPress={() => {
                if (isExisting) return;
                haptics.light();
                onToggle({
                  user_id: friend.id,
                  name: friend.name,
                  handicap,
                  source: 'friends',
                });
              }}
              disabled={isExisting}
              style={[
                styles.playerRow,
                { borderBottomColor: c.border },
                isExisting && { opacity: 0.4 },
              ]}
            >
              <Avatar id={friend.id} name={friend.name} size={36} />
              <View style={styles.playerInfo}>
                <Text style={[styles.playerName, { color: c.text, fontFamily: GEO }]} numberOfLines={1}>
                  {friend.name}
                </Text>
                <Text style={[styles.playerSub, { color: c.textMuted }]}>
                  {isExisting ? 'Already in trip' : `${handicap} HCP`}
                </Text>
              </View>
              <View style={[
                styles.checkbox,
                {
                  borderColor: isSelected ? c.teal : c.textMuted,
                  backgroundColor: isSelected ? c.teal : 'transparent',
                },
              ]}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// ─── Recent Tab ────────────────────────────────────────���───────────────

function RecentTab({
  existingPlayerIds,
  selected,
  onToggle,
}: {
  existingPlayerIds: Set<string>;
  selected: Map<string, PendingPlayer>;
  onToggle: (player: PendingPlayer) => void;
}) {
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
      .then(({ data, error }) => {
        if (!error && data) setCoPlayers(data as CoPlayer[]);
        setLoading(false);
      }, () => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.teal} />
      </View>
    );
  }

  if (coPlayers.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="time-outline" size={48} color={c.textMuted} />
        <Text style={[styles.emptyTitle, { color: c.text }]}>No recent co-players</Text>
        <Text style={[styles.emptySubtitle, { color: c.textMuted }]}>
          Play a round with friends and they'll appear here
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={coPlayers}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      style={styles.tabContent}
      renderItem={({ item }) => {
        const isExisting = existingPlayerIds.has(item.id);
        const isSelected = selected.has(item.id);
        const handicap = item.handicap_index ?? 0;
        const daysAgo = Math.floor(
          (Date.now() - new Date(item.last_played_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        return (
          <Pressable
            onPress={() => {
              if (isExisting) return;
              haptics.light();
              onToggle({
                user_id: item.id,
                name: item.name,
                handicap,
                source: 'recent',
              });
            }}
            disabled={isExisting}
            style={[
              styles.playerRow,
              { borderBottomColor: c.border },
              isExisting && { opacity: 0.4 },
            ]}
          >
            <Avatar id={item.id} name={item.name} size={36} />
            <View style={styles.playerInfo}>
              <Text style={[styles.playerName, { color: c.text, fontFamily: GEO }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.playerSub, { color: c.textMuted }]}>
                {isExisting
                  ? 'Already in trip'
                  : `Played ${item.rounds_together} time${item.rounds_together !== 1 ? 's' : ''} · ${daysAgo}d ago`}
              </Text>
            </View>
            <View style={[
              styles.checkbox,
              {
                borderColor: isSelected ? c.teal : c.textMuted,
                backgroundColor: isSelected ? c.teal : 'transparent',
              },
            ]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

// ─── Guest Tab ─────────────────────────────────────────────────────────

function GuestTab({
  onAdd,
}: {
  onAdd: (player: PendingPlayer) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  const [guestName, setGuestName] = useState('');
  const [guestHcp, setGuestHcp] = useState('');

  const handleAdd = () => {
    if (!guestName.trim()) {
      showToast({ message: 'Enter a name for the guest', type: 'error' });
      return;
    }
    const hcp = parseFloat(guestHcp) || 0;
    if (hcp < 0 || hcp > 54) {
      showToast({ message: 'Handicap must be 0-54', type: 'error' });
      return;
    }

    haptics.light();
    onAdd({
      guest_name: guestName.trim(),
      name: guestName.trim(),
      handicap: hcp,
      source: 'guest',
    });
    setGuestName('');
    setGuestHcp('');
    showToast({ message: `${guestName.trim()} added`, type: 'success' });
  };

  return (
    <View style={[styles.guestContainer, { backgroundColor: c.bg }]}>
      <Text style={[styles.guestLabel, { color: c.gold, fontFamily: GEO }]}>
        ADD A GUEST
      </Text>
      <Text style={[styles.guestHint, { color: c.textMuted }]}>
        For players who aren't on Dormie yet
      </Text>

      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>NAME</Text>
      <TextInput
        style={[styles.guestInput, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
        placeholder="Guest name"
        placeholderTextColor={c.textMuted}
        value={guestName}
        onChangeText={setGuestName}
        autoCapitalize="words"
      />

      <Text style={[styles.fieldLabel, { color: c.textMuted }]}>HANDICAP</Text>
      <TextInput
        style={[styles.guestInput, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
        placeholder="0-54"
        placeholderTextColor={c.textMuted}
        value={guestHcp}
        onChangeText={setGuestHcp}
        keyboardType="decimal-pad"
        maxLength={4}
      />

      <Pressable
        onPress={handleAdd}
        style={[styles.addGuestBtn, { backgroundColor: c.teal }]}
      >
        <Ionicons name="person-add" size={16} color="#fff" />
        <Text style={styles.addGuestBtnText}>Add Guest</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Sheet ──────────────────────────────────────���─────────────────

export default function AddPlayerSheet({
  tripId,
  tripName,
  tripInviteCode,
  existingPlayers,
  onAddPlayers,
  onClose,
  isVisible,
}: AddPlayerSheetProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [tab, setTab] = useState<Tab>('friends');
  const [selected, setSelected] = useState<Map<string, PendingPlayer>>(new Map());

  const existingIds = new Set(existingPlayers.map((p) => p.id));

  const handleToggle = useCallback((player: PendingPlayer) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = player.user_id ?? player.guest_name ?? player.name;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, player);
      }
      return next;
    });
  }, []);

  const handleGuestAdd = useCallback((player: PendingPlayer) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = `guest_${player.guest_name}_${Date.now()}`;
      next.set(key, player);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    haptics.success();
    onAddPlayers(Array.from(selected.values()));
    setSelected(new Map());
  }, [selected, onAddPlayers]);

  const handleClose = useCallback(() => {
    haptics.light();
    setSelected(new Map());
    onClose();
  }, [onClose]);

  const selectedCount = selected.size;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleClose}
    >
      <View style={[styles.sheet, { backgroundColor: c.bg }]}>
        {/* Header */}
        <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
          <Text style={[styles.sheetTitle, { color: c.text, fontFamily: GEO }]}>
            Add Players
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab bar */}
        <SheetTabBar tab={tab} onSelect={setTab} colors={c} />

        {/* Tab content */}
        <View style={styles.tabBody}>
          {tab === 'friends' && (
            <FriendsTab
              existingPlayerIds={existingIds}
              selected={selected}
              onToggle={handleToggle}
            />
          )}
          {tab === 'recent' && (
            <RecentTab
              existingPlayerIds={existingIds}
              selected={selected}
              onToggle={handleToggle}
            />
          )}
          {tab === 'guest' && (
            <GuestTab onAdd={handleGuestAdd} />
          )}
        </View>

        {/* Bottom CTA */}
        {selectedCount > 0 && (
          <View style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
            <Pressable
              onPress={handleConfirm}
              style={[styles.confirmBtn, { backgroundColor: c.teal }]}
            >
              <Text style={[styles.confirmBtnText, { fontFamily: GEO }]}>
                Add {selectedCount} Player{selectedCount !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 48,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: 18,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabIndicator: {
    height: 2,
    width: '60%',
    marginTop: 6,
  },

  // Tab content
  tabBody: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  // Player rows
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
  },
  playerSub: {
    fontSize: 13,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Guest tab
  guestContainer: {
    padding: 20,
  },
  guestLabel: {
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 4,
  },
  guestHint: {
    fontSize: 13,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 16,
  },
  guestInput: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  addGuestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 24,
  },
  addGuestBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
