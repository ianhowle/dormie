import { View, Text, ScrollView, Pressable, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO } from '../../src/theme/fonts';
import { Avatar } from '../../src/components/Avatar';
import {
  MOCK_QUICK_STATS,
  MOCK_FEED,
  MOCK_UPCOMING,
  type FeedItem,
  type UpcomingItem,
} from '../../src/data/homeFeed';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Greeting ─────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Time ago ─────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const mins = Math.floor((now - then) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Feed icon ────────────────────────────────────────────────────────
function feedIcon(type: FeedItem['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'round_posted': return 'golf-outline';
    case 'trip_created': return 'airplane-outline';
    case 'season_update': return 'trophy-outline';
    case 'achievement': return 'star-outline';
  }
}

// ─── Header ───────────────────────────────────────────────────────────
function Header() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[st.header, { backgroundColor: c.surface }]}>
      <Text style={[st.dormieLabel, { color: c.gold, fontFamily: GEO }]}>
        DORMIE
      </Text>
      <Text style={[st.greeting, { color: c.text, fontFamily: GEO }]}>
        {getGreeting()}, Ian
      </Text>
    </View>
  );
}

// ─── Quick stats ──────────────────────────────────────────────────────
function QuickStatsRow() {
  const { theme } = useTheme();
  const c = theme.colors;
  const s = MOCK_QUICK_STATS;

  return (
    <View style={st.statsRow}>
      <View style={[st.statBox, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <Text style={[st.statValue, { color: c.teal, fontFamily: GEO, fontSize: 22 }]}>
          {s.handicap.toFixed(1)}
        </Text>
        <Text style={[st.statLabel, { color: c.textMuted }]}>HANDICAP</Text>
      </View>
      <View style={[st.statBox, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <Text style={[st.statValue, { color: c.gold, fontFamily: GEO }]}>
          {s.monthRounds}
        </Text>
        <Text style={[st.statLabel, { color: c.textMuted }]}>THIS MONTH</Text>
      </View>
      <View style={[st.statBox, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <Text style={[st.statValue, { color: c.gold, fontFamily: GEO }]}>
          {s.bestRecent}
        </Text>
        <Text style={[st.statLabel, { color: c.textMuted }]}>BEST RECENT</Text>
      </View>
      <View style={[st.statBox, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <Text style={[st.statValue, { color: c.gold, fontFamily: GEO }]}>
          {s.streak}
        </Text>
        <Text style={[st.statLabel, { color: c.textMuted }]}>STREAK</Text>
      </View>
    </View>
  );
}

// ─── Feed card ────────────────────────────────────────────────────────
function FeedCard({ item }: { item: FeedItem }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isMe = item.playerId === '1';

  return (
    <View style={[st.feedCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <View style={st.feedLeft}>
        <Avatar id={item.playerId} size={36} name={item.playerName} />
      </View>
      <View style={st.feedContent}>
        <View style={st.feedTopRow}>
          <Text style={[st.feedName, { color: c.text }]} numberOfLines={1}>
            {isMe ? 'You' : item.playerName}
          </Text>
          <Text style={[st.feedTime, { color: c.textMuted }]}>
            {timeAgo(item.timestamp)}
          </Text>
        </View>
        <Text style={[st.feedDesc, { color: c.textMuted }]} numberOfLines={2}>
          {isMe ? item.description : item.description}
        </Text>
      </View>
      <Ionicons
        name={feedIcon(item.type)}
        size={16}
        color={c.textMuted}
        style={st.feedIcon}
      />
    </View>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────
function QuickActions() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <View style={st.actionsRow}>
      <Pressable
        onPress={() => router.push('/(tabs)/score')}
        style={[st.actionBtn, { backgroundColor: c.teal }]}
      >
        <Ionicons name="add-circle-outline" size={18} color="#fff" />
        <Text style={st.actionPrimaryText}>Log Round</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/(tabs)/trips')}
        style={[st.actionBtn, { backgroundColor: `${c.gold}20`, borderWidth: 1, borderColor: c.gold }]}
      >
        <Ionicons name="airplane-outline" size={18} color={c.gold} />
        <Text style={[st.actionSecText, { color: c.gold }]}>New Trip</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/(tabs)/leaderboard')}
        style={[st.actionBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }]}
      >
        <Ionicons name="trophy-outline" size={18} color={c.textMuted} />
        <Text style={[st.actionSecText, { color: c.textMuted }]}>Leaderboard</Text>
      </Pressable>
    </View>
  );
}

// ─── Upcoming card ────────────────────────────────────────────────────
function UpcomingCard({ item }: { item: UpcomingItem }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isTrip = item.type === 'trip';

  return (
    <View
      style={[
        st.upcomingCard,
        {
          backgroundColor: c.cardBg,
          borderColor: isTrip ? c.teal : c.gold,
          borderLeftWidth: 3,
        },
      ]}
    >
      <View style={st.upcomingInfo}>
        <View style={st.upcomingTopRow}>
          <Ionicons
            name={isTrip ? 'airplane-outline' : 'trophy-outline'}
            size={14}
            color={isTrip ? c.teal : c.gold}
          />
          <Text style={[st.upcomingTitle, { color: c.text }]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Text style={[st.upcomingSub, { color: c.textMuted }]}>
          {item.subtitle}
        </Text>
      </View>
      <View style={[st.countdownBadge, { backgroundColor: isTrip ? `${c.teal}18` : `${c.gold}18` }]}>
        <Text style={[st.countdownNum, { color: isTrip ? c.teal : c.gold, fontFamily: GEO }]}>
          {item.daysAway}
        </Text>
        <Text style={[st.countdownLabel, { color: isTrip ? c.teal : c.gold }]}>
          days
        </Text>
      </View>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
      {title}
    </Text>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────
export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={st.body}>
          {/* Quick stats */}
          <QuickStatsRow />

          {/* Quick actions */}
          <QuickActions />

          {/* Activity feed */}
          <SectionHeader title="LATEST" />
          {MOCK_FEED.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}

          {/* Upcoming */}
          {MOCK_UPCOMING.length > 0 && (
            <>
              <SectionHeader title="UPCOMING" />
              {MOCK_UPCOMING.map((item) => (
                <UpcomingCard key={item.id} item={item} />
              ))}
            </>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: {
    flex: 1,
  },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H + 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  dormieLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 3,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },

  /* Body */
  body: {
    paddingHorizontal: 16,
  },

  /* Quick stats */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  /* Quick actions */
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
  },
  actionPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionSecText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Section */
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },

  /* Feed card */
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  feedLeft: {
    marginRight: 10,
  },
  feedContent: {
    flex: 1,
  },
  feedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  feedTime: {
    fontSize: 10,
  },
  feedDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  feedIcon: {
    marginLeft: 8,
  },

  /* Upcoming */
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  upcomingSub: {
    fontSize: 11,
    marginTop: 3,
  },
  countdownBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 10,
  },
  countdownNum: {
    fontSize: 20,
    fontWeight: '700',
  },
  countdownLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
