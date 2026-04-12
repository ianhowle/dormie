import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { GEO } from '../src/theme/fonts';
import { digestService, type DigestPayload } from '../src/services/digest.service';

export default function DigestScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user } = useAuth();

  const [digest, setDigest] = useState<DigestPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const d = await digestService.generateDigest(user.id);
      setDigest(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderColor: c.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text, fontFamily: GEO }]}>WEEKLY DIGEST</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.gold} />}
      >
        {loading ? (
          <Text style={{ color: c.textMuted }}>Generating your digest…</Text>
        ) : !digest ? (
          <Text style={{ color: c.textMuted }}>Sign in to see your weekly recap.</Text>
        ) : (
          <>
            <View style={[styles.hero, { borderColor: c.gold }]}>
              <Ionicons name="newspaper" size={28} color={c.gold} />
              <Text style={[styles.heroWeek, { color: c.gold, fontFamily: GEO }]}>
                {fmtDate(digest.weekStart)} — {fmtDate(digest.weekEnd)}
              </Text>
              <Text style={[styles.heroSub, { color: c.textMuted }]}>A look at your week in golf.</Text>
            </View>

            <Section title="STANDINGS" c={c}>
              {digest.standings.length === 0 ? (
                <Empty text="No active seasons yet." c={c} />
              ) : (
                digest.standings.map((s) => (
                  <View key={s.seasonId} style={[styles.card, { borderColor: c.border }]}>
                    <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>{s.seasonName}</Text>
                    <View style={styles.cardRow}>
                      <View>
                        <Text style={[styles.label, { color: c.textMuted }]}>YOUR POSITION</Text>
                        <Text style={[styles.bigNum, { color: c.gold, fontFamily: GEO }]}>
                          {s.position ? `#${s.position}` : '—'}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.label, { color: c.textMuted }]}>POINTS</Text>
                        <Text style={[styles.bigNum, { color: c.text, fontFamily: GEO }]}>{s.points ?? '—'}</Text>
                      </View>
                      <View>
                        <Text style={[styles.label, { color: c.textMuted }]}>LEADER</Text>
                        <Text style={[styles.leaderName, { color: c.text }]} numberOfLines={1}>
                          {s.leaderName ?? '—'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </Section>

            <Section title="THIS WEEK'S STATS" c={c}>
              <View style={[styles.statsRow, { borderColor: c.border }]}>
                {digest.stats.map((stat) => (
                  <View key={stat.label} style={styles.statCell}>
                    <Text style={[styles.statValue, { color: c.text, fontFamily: GEO }]}>{stat.value}</Text>
                    <Text style={[styles.statLabel, { color: c.textMuted }]}>{stat.label.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </Section>

            <Section title="UPCOMING DEADLINES" c={c}>
              {digest.deadlines.length === 0 ? (
                <Empty text="Nothing due this week." c={c} />
              ) : (
                digest.deadlines.map((d) => (
                  <View key={`${d.seasonId}-${d.weekNumber}`} style={[styles.deadlineRow, { borderColor: c.border }]}>
                    <Ionicons name="calendar-outline" size={16} color={c.gold} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.deadlineTitle, { color: c.text }]}>
                        {d.seasonName} · Week {d.weekNumber}
                      </Text>
                      {d.format && <Text style={[styles.deadlineDetail, { color: c.textMuted }]}>{d.format}</Text>}
                    </View>
                    {d.dueDate && (
                      <Text style={[styles.deadlineDate, { color: c.gold, fontFamily: GEO }]}>
                        {fmtDate(d.dueDate)}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </Section>

            <Section title="HIGHLIGHTS" c={c}>
              {digest.highlights.length === 0 ? (
                <Empty text="Quiet week. Go make something happen." c={c} />
              ) : (
                digest.highlights.map((h, idx) => (
                  <View key={idx} style={[styles.highlight, { borderColor: c.border }]}>
                    <Ionicons
                      name={h.kind === 'ace' ? 'flash' : h.kind === 'eagle' ? 'trophy' : h.kind === 'birdie' ? 'golf' : 'person-add'}
                      size={16}
                      color={h.kind === 'ace' || h.kind === 'eagle' ? c.gold : c.teal}
                    />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.highlightHeadline, { color: c.text }]}>{h.headline}</Text>
                      {h.detail && <Text style={[styles.highlightDetail, { color: c.textMuted }]}>{h.detail}</Text>}
                    </View>
                    <Text style={[styles.highlightDate, { color: c.textMuted, fontFamily: GEO }]}>
                      {fmtDate(h.at)}
                    </Text>
                  </View>
                ))
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children, c }: { title: string; children: React.ReactNode; c: any }) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={[styles.sectionTitle, { color: c.gold, fontFamily: GEO }]}>{title}</Text>
      {children}
    </View>
  );
}

function Empty({ text, c }: { text: string; c: any }) {
  return (
    <View style={[styles.empty, { borderColor: c.border }]}>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 14, letterSpacing: 2 },
  hero: { alignItems: 'center', padding: 16, borderWidth: 1 },
  heroWeek: { fontSize: 14, letterSpacing: 2, marginTop: 10 },
  heroSub: { fontSize: 11, marginTop: 4 },
  sectionTitle: { fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  card: { padding: 12, borderWidth: 1, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 9, letterSpacing: 1, fontWeight: '600' },
  bigNum: { fontSize: 22, marginTop: 2 },
  leaderName: { fontSize: 14, marginTop: 4, maxWidth: 120 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, borderWidth: 1 },
  statCell: { minWidth: '25%', padding: 6, alignItems: 'center' },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 9, letterSpacing: 1, marginTop: 2, textAlign: 'center' },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, marginBottom: 6 },
  deadlineTitle: { fontSize: 13, fontWeight: '600' },
  deadlineDetail: { fontSize: 11, marginTop: 2 },
  deadlineDate: { fontSize: 13 },
  highlight: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, marginBottom: 6 },
  highlightHeadline: { fontSize: 13, fontWeight: '600' },
  highlightDetail: { fontSize: 11, marginTop: 2 },
  highlightDate: { fontSize: 11 },
  empty: { padding: 16, borderWidth: 1, alignItems: 'center' },
});
