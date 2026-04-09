import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { greenHeaderGradient, cardShadowDark, cardShadowLight } from '../src/theme/colors';
import GoldDivider from '../src/components/GoldDivider';
import { MOCK_GROUPS, type Group } from '../src/data/groups';

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

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const cardShadow = isDark ? cardShadowDark : cardShadowLight;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [gs.card, { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <View style={[gs.cardInitials, { backgroundColor: group.color }]}>
        <Text style={gs.cardInitialsText}>{group.initials}</Text>
      </View>
      <View style={gs.cardInfo}>
        <Text style={[gs.cardName, { color: c.text }]}>{group.name}</Text>
        <Text style={[gs.cardMembers, { color: c.textMuted }]}>{group.memberCount} members</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </Pressable>
  );
}

export default function GroupsScreen() {
  const { theme } = useTheme();
  const isDark = theme.isDark;
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[gs.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={greenHeaderGradient as unknown as string[]}
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
          <Text style={[gs.headerTitle, { fontFamily: GEO }]}>My Groups</Text>
          <View style={{ width: 22 }} />
        </View>
        <GoldDivider style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
      </LinearGradient>

      <FlatList
        data={MOCK_GROUPS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            onPress={() => router.push({ pathname: '/group-detail', params: { groupId: item.id, groupName: item.name } })}
          />
        )}
        ListEmptyComponent={
          <View style={gs.empty}>
            <Ionicons name="people-outline" size={36} color={c.textMuted} />
            <Text style={[gs.emptyText, { color: c.textMuted }]}>No groups yet</Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C9A227',
    letterSpacing: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  cardInitials: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInitialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardMembers: {
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});
