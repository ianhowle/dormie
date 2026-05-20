import { View, Text, Pressable, StyleSheet, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { greenHeaderGradient, cardShadowDark, cardShadowLight } from '../src/theme/colors';
import GoldDivider from '../src/components/GoldDivider';
import { Avatar } from '../src/components/Avatar';
import { getGroupById, type GroupMember } from '../src/data/groups';
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

function MemberRow({ member, rank }: { member: GroupMember; rank: number }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[gs.memberRow, { borderBottomColor: c.borderLight }]}>
      <Text style={[gs.memberRank, { color: rank <= 3 ? c.gold : c.textMuted, fontFamily: GEO }]}>
        {rank}
      </Text>
      <Avatar id={member.userId} size={36} name={member.name} />
      <View style={gs.memberInfo}>
        <Text style={[gs.memberName, { color: c.text }]}>{member.name}</Text>
        <Text style={[gs.memberRole, { color: c.textMuted }]}>
          {member.role === 'admin' ? 'Admin' : 'Member'}
        </Text>
      </View>
      <View style={gs.memberHcpWrap}>
        <Text style={[gs.memberHcpLabel, { color: c.textMuted }]}>HCP</Text>
        <Text style={[gs.memberHcp, { color: c.teal, fontFamily: GEO }]}>
          {member.handicap.toFixed(1)}
        </Text>
      </View>
    </View>
  );
}

export default function GroupDetailScreen() {
  const { theme } = useTheme();
  const isDark = theme.isDark;
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ groupId: string; groupName: string }>();
  const cardShadow = isDark ? cardShadowDark : cardShadowLight;

  const group = getGroupById(params.groupId ?? '');
  const groupName = group?.name ?? params.groupName ?? 'Group';
  const members = group?.members ?? [];

  // Sort members by handicap (lowest first) for leaderboard
  const sortedMembers = [...members].sort((a, b) => a.handicap - b.handicap);

  return (
    <View style={[gs.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={greenHeaderGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[gs.header, { paddingTop: insets.top + 4 }]}
      >
        <Pinstripes />
        <View style={gs.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={gs.headerCenter}>
            <Text style={[gs.headerTitle, { fontFamily: GEO }]}>{groupName}</Text>
            <Text style={gs.headerSub}>{group?.memberCount ?? members.length} members</Text>
          </View>
          <View style={{ width: 22 }} />
        </View>
        <GoldDivider style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
      </LinearGradient>

      <FlatList
        data={sortedMembers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 20 }}>
            {/* Group info card */}
            <View style={[gs.infoCard, { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow }]}>
              <View style={[gs.initialsLarge, { backgroundColor: group?.color ?? c.teal }]}>
                <Text style={gs.initialsLargeText}>{group?.initials ?? '?'}</Text>
              </View>
              <View style={gs.infoCardDetails}>
                <Text style={[gs.infoCardName, { color: c.text }]}>{groupName}</Text>
                <Text style={[gs.infoCardMeta, { color: c.textMuted }]}>
                  {group?.memberCount ?? members.length} members{group?.activeSeasonId ? ' \u00B7 Active season' : ''}
                </Text>
                {group?.createdAt && (
                  <Text style={[gs.infoCardDate, { color: c.textMuted }]}>
                    Created {new Date(group.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
            </View>

            {/* Leaderboard header */}
            <Text style={[gs.sectionLabel, { color: c.gold }]}>LEADERBOARD</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <MemberRow member={item} rank={index + 1} />
          </View>
        )}
        ListFooterComponent={
          <View style={{ paddingHorizontal: 20 }}>
            <GoldDivider style={{ marginTop: 16 }} />

            {/* Invite button */}
            <Pressable
              onPress={() => {
                haptics.light();
                Alert.alert('Invite', 'Share this group code with friends to invite them.');
              }}
              style={({ pressed }) => [gs.inviteBtn, { borderColor: c.teal, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <Ionicons name="person-add-outline" size={18} color={c.teal} />
              <Text style={[gs.inviteBtnText, { color: c.teal }]}>Invite to Group</Text>
            </Pressable>

            {/* Leave group */}
            <Pressable
              onPress={() => {
                haptics.medium();
                Alert.alert('Leave Group', `Are you sure you want to leave ${groupName}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: () => router.back() },
                ]);
              }}
              style={({ pressed }) => [gs.leaveBtn, { borderColor: c.urgent, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <Ionicons name="log-out-outline" size={18} color={c.urgent} />
              <Text style={[gs.leaveBtnText, { color: c.urgent }]}>Leave Group</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const gs = StyleSheet.create({
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C9A227',
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },

  /* Group info card */
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  initialsLarge: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsLargeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  infoCardDetails: {
    flex: 1,
  },
  infoCardName: {
    fontSize: 17,
    fontWeight: '700',
  },
  infoCardMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  infoCardDate: {
    fontSize: 11,
    marginTop: 2,
  },

  /* Member row */
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  memberRank: {
    width: 24,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 11,
    marginTop: 2,
  },
  memberHcpWrap: {
    alignItems: 'flex-end',
  },
  memberHcpLabel: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1,
  },
  memberHcp: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  /* Buttons */
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 24,
    borderRadius: 12,
  },
  inviteBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 10,
    borderRadius: 12,
  },
  leaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
