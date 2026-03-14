import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
  Share,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { haptics } from '../lib/haptics';
import { GEO } from '../theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../theme/colors';
import GoldDivider from './GoldDivider';
import { Avatar } from './Avatar';
import { SCORE_COLORS, scoreColor, formatToPar as fmtToPar, scoreName } from '../lib/scoring-utils';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────
export type HoleResult = {
  hole: number;
  par: number;
  gross: number;
  putts: number;
  fir: boolean | null;
  gir: boolean;
  puttDistance?: number;
};

export type PlayerRound = {
  playerId: string;
  name: string;
  handicap: number;
  avatarColor: string;
  grossScore: number;
  netScore: number | null;
  coursePar: number;
  courseName: string;
  holes: HoleResult[];
};

export type SideGameResult = {
  game: string;
  label: string;
  results: { playerId: string; playerName: string; amount: number }[];
};

export type PostRoundSummaryProps = {
  players: PlayerRound[];
  sideGames: SideGameResult[];
  onSaveRound: (playerId: string) => void;
  onClose: () => void;
};

// ─── Scoring helpers ──────────────────────────────────────────────────
type ScoreCategory = 'eagles' | 'birdies' | 'pars' | 'bogeys' | 'doubles';

const SCORE_CATEGORY_COLORS: Record<ScoreCategory, string> = {
  eagles: SCORE_COLORS.eagle,
  birdies: SCORE_COLORS.birdie,
  pars: SCORE_COLORS.par,
  bogeys: SCORE_COLORS.bogey,
  doubles: SCORE_COLORS.double,
};

const SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  eagles: 'Eagles',
  birdies: 'Birdies',
  pars: 'Pars',
  bogeys: 'Bogeys',
  doubles: 'Double+',
};

function categorizeScores(holes: HoleResult[]): Record<ScoreCategory, number> {
  const counts: Record<ScoreCategory, number> = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0 };
  holes.forEach((h) => {
    const diff = h.gross - h.par;
    if (diff <= -2) counts.eagles++;
    else if (diff === -1) counts.birdies++;
    else if (diff === 0) counts.pars++;
    else if (diff === 1) counts.bogeys++;
    else counts.doubles++;
  });
  return counts;
}

function computeStats(holes: HoleResult[]) {
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const onePutts = holes.filter((h) => h.putts === 1).length;
  const threePutts = holes.filter((h) => h.putts >= 3).length;
  const fairwayHoles = holes.filter((h) => h.fir !== null);
  const firPct = fairwayHoles.length > 0
    ? Math.round((fairwayHoles.filter((h) => h.fir).length / fairwayHoles.length) * 100)
    : 0;
  const girPct = Math.round((holes.filter((h) => h.gir).length / holes.length) * 100);

  // Scramble: par or better when GIR missed
  const missedGir = holes.filter((h) => !h.gir);
  const scrambles = missedGir.filter((h) => h.gross <= h.par).length;
  const scramblePct = missedGir.length > 0 ? Math.round((scrambles / missedGir.length) * 100) : 0;

  // Penalties estimate (double bogey+)
  const penalties = holes.filter((h) => h.gross - h.par >= 2).length;

  return { totalPutts, onePutts, threePutts, firPct, girPct, scramblePct, penalties };
}

type PuttBucket = { label: string; made: number; total: number; benchmark: number };

function computePuttBuckets(holes: HoleResult[]): PuttBucket[] {
  const buckets: PuttBucket[] = [
    { label: 'Inside 5ft', made: 0, total: 0, benchmark: 90 },
    { label: '5-15ft', made: 0, total: 0, benchmark: 40 },
    { label: '15-30ft', made: 0, total: 0, benchmark: 12 },
    { label: '30ft+', made: 0, total: 0, benchmark: 5 },
  ];

  holes.forEach((h) => {
    if (h.puttDistance === undefined) return;
    let idx = 0;
    if (h.puttDistance >= 5 && h.puttDistance < 15) idx = 1;
    else if (h.puttDistance >= 15 && h.puttDistance < 30) idx = 2;
    else if (h.puttDistance >= 30) idx = 3;

    buckets[idx].total++;
    if (h.putts === 1) buckets[idx].made++;
  });

  return buckets;
}

const formatToPar = fmtToPar;

function splitNine(holes: HoleResult[], side: 'front' | 'back') {
  const slice = side === 'front' ? holes.slice(0, 9) : holes.slice(9, 18);
  return slice.reduce((s, h) => s + h.gross, 0);
}

// ─── Scoring Breakdown Bar ────────────────────────────────────────────
function BreakdownBar({ counts, total }: { counts: Record<ScoreCategory, number>; total: number }) {
  const categories: ScoreCategory[] = ['eagles', 'birdies', 'pars', 'bogeys', 'doubles'];

  return (
    <View style={styles.breakdownContainer}>
      <View style={styles.breakdownBar}>
        {categories.map((cat) => {
          const pct = total > 0 ? (counts[cat] / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <View
              key={cat}
              style={[styles.breakdownSegment, { width: `${pct}%`, backgroundColor: SCORE_CATEGORY_COLORS[cat] }]}
            />
          );
        })}
      </View>
      <View style={styles.breakdownLegend}>
        {categories.map((cat) => {
          if (counts[cat] === 0) return null;
          return (
            <View key={cat} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SCORE_CATEGORY_COLORS[cat] }]} />
              <Text style={styles.legendText}>
                {counts[cat]} {SCORE_CATEGORY_LABELS[cat]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Stats Grid ───────────────────────────────────────────────────────
function StatsGrid({ stats, colors: c }: { stats: ReturnType<typeof computeStats>; colors: any }) {
  const items = [
    { label: 'Putts', value: `${stats.totalPutts}`, color: c.text },
    { label: '1-Putts', value: `${stats.onePutts}`, color: c.teal },
    { label: '3-Putts', value: `${stats.threePutts}`, color: stats.threePutts > 0 ? c.urgent : c.text },
    { label: 'FIR%', value: `${stats.firPct}%`, color: c.text },
    { label: 'GIR%', value: `${stats.girPct}%`, color: c.text },
    { label: 'Scramble%', value: `${stats.scramblePct}%`, color: c.text },
  ];

  return (
    <View style={styles.statsGrid}>
      {items.map((item) => (
        <View key={item.label} style={[styles.statCell, { backgroundColor: c.elevated }]}>
          <Text style={[styles.statVal, { color: item.color, fontFamily: GEO }]}>{item.value}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Putt Breakdown ───────────────────────────────────────────────────
function PuttBreakdown({ buckets, colors: c }: { buckets: PuttBucket[]; colors: any }) {
  return (
    <View style={styles.puttBreakdown}>
      {buckets.map((b) => {
        const makePct = b.total > 0 ? Math.round((b.made / b.total) * 100) : 0;
        const aboveBench = makePct >= b.benchmark;
        return (
          <View key={b.label} style={[styles.puttBucketRow, { borderBottomColor: c.border }]}>
            <Text style={[styles.puttBucketLabel, { color: c.textMuted }]}>{b.label}</Text>
            <View style={styles.puttBucketBar}>
              <View style={[styles.puttBucketFill, { width: `${Math.min(makePct, 100)}%`, backgroundColor: aboveBench ? c.teal : c.urgent }]} />
              <View style={[styles.puttBenchmark, { left: `${b.benchmark}%`, backgroundColor: c.textMuted }]} />
            </View>
            <Text style={[styles.puttBucketVal, { color: aboveBench ? c.teal : c.urgent, fontFamily: GEO }]}>
              {b.total > 0 ? `${b.made}/${b.total}` : '—'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Side Game Results ────────────────────────────────────────────────
function SideGameResults({ sideGames, colors: c }: { sideGames: SideGameResult[]; colors: any }) {
  if (sideGames.length === 0) return null;

  const totalSettlement = useMemo(() => {
    const totals: Record<string, number> = {};
    sideGames.forEach((sg) => {
      sg.results.forEach((r) => {
        totals[r.playerName] = (totals[r.playerName] ?? 0) + r.amount;
      });
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [sideGames]);

  return (
    <View style={styles.sideGamesSection}>
      <Text style={[styles.sectionTitle, { color: c.gold }]}>SIDE GAMES</Text>
      {sideGames.map((sg) => (
        <View key={sg.game} style={[styles.sideGameCard, { backgroundColor: c.elevated }]}>
          <Text style={[styles.sideGameLabel, { color: c.gold }]}>{sg.label}</Text>
          {sg.results.map((r) => (
            <View key={r.playerId} style={styles.sideGameRow}>
              <Text style={[styles.sideGamePlayer, { color: c.text }]}>{r.playerName}</Text>
              <Text
                style={[
                  styles.sideGameAmt,
                  { color: r.amount >= 0 ? c.teal : c.urgent, fontFamily: GEO },
                ]}
              >
                {r.amount >= 0 ? '+' : ''}{r.amount}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {/* Settlement */}
      <View style={[styles.settlementCard, { backgroundColor: c.cardBg, borderColor: c.gold + '33', borderWidth: 1 }]}>
        <Text style={[styles.settlementTitle, { color: c.gold, fontFamily: GEO }]}>SETTLEMENT</Text>
        {totalSettlement.map(([name, amount]) => (
          <View key={name} style={styles.settlementRow}>
            <Text style={[styles.settlementName, { color: c.text }]}>{name}</Text>
            <Text
              style={[
                styles.settlementAmt,
                { color: amount >= 0 ? c.teal : c.urgent, fontFamily: GEO },
              ]}
            >
              {amount >= 0 ? '+' : ''}${Math.abs(amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Hole-by-Hole Strip ──────────────────────────────────────────────
function HoleStrip({ holes, colors: c }: { holes: HoleResult[]; colors: any }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.holeStrip}>
      {holes.map((h) => {
        const fg = scoreColor(h.gross, h.par, c.textMuted);
        const bg = fg + '22';

        return (
          <View key={h.hole} style={[styles.holeCell, { backgroundColor: bg }]}>
            <Text style={[styles.holeCellNum, { color: c.textMuted }]}>{h.hole}</Text>
            <Text style={[styles.holeCellScore, { color: fg, fontFamily: GEO }]}>{h.gross}</Text>
            <Text style={[styles.holeCellPar, { color: c.textMuted }]}>{h.par}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Share Card Preview ───────────────────────────────────────────────
function ShareCardModal({
  visible,
  player,
  format,
  onClose,
  onShare,
}: {
  visible: boolean;
  player: PlayerRound;
  format: 'story' | 'feed';
  onClose: () => void;
  onShare: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const toPar = formatToPar(player.grossScore, player.coursePar);
  const aspectRatio = format === 'story' ? 9 / 16 : 1;
  const cardWidth = SCREEN_W * 0.75;
  const cardHeight = cardWidth / aspectRatio;

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.shareModalOverlay}>
        <View style={[styles.shareModalContent, { backgroundColor: c.cardBg }]}>
          <View style={styles.shareModalHeader}>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={c.textMuted} />
            </Pressable>
            <Text style={[styles.shareModalTitle, { color: c.text }]}>
              {format === 'story' ? 'Story (9:16)' : 'Feed (1:1)'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Card preview */}
          <View style={[styles.shareCard, { width: cardWidth, height: Math.min(cardHeight, 500) }]}>
            <LinearGradient
              colors={['#1E4D2B', '#0A2614']}
              style={StyleSheet.absoluteFill}
            />
            {/* Pinstripe texture */}
            {Array.from({ length: 30 }).map((_, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: -100,
                  left: i * 16 - 50,
                  width: 1,
                  height: cardHeight + 200,
                  backgroundColor: '#FFFFFF',
                  opacity: 0.03,
                  transform: [{ rotate: '35deg' }],
                }}
              />
            ))}

            <View style={styles.shareCardInner}>
              <Text style={styles.shareCardApp}>DORMIE</Text>
              <Text style={[styles.shareCardScore, { fontFamily: GEO }]}>{player.grossScore}</Text>
              <Text style={styles.shareCardToPar}>{toPar}</Text>
              <Text style={styles.shareCardCourse}>{player.courseName}</Text>

              {/* Mini hole strip */}
              <View style={styles.shareHoleRow}>
                {player.holes.slice(0, 9).map((h) => {
                  const color = scoreColor(h.gross, h.par);
                  return (
                    <View key={h.hole} style={styles.shareHoleCell}>
                      <Text style={[styles.shareHoleCellVal, { color, fontFamily: GEO }]}>{h.gross}</Text>
                    </View>
                  );
                })}
              </View>
              {player.holes.length > 9 && (
                <View style={styles.shareHoleRow}>
                  {player.holes.slice(9, 18).map((h) => {
                    const color = scoreColor(h.gross, h.par);
                    return (
                      <View key={h.hole} style={styles.shareHoleCell}>
                        <Text style={[styles.shareHoleCellVal, { color, fontFamily: GEO }]}>{h.gross}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={styles.shareCaption}>
                Shot {player.grossScore} ({toPar}) at {player.courseName} today!{'\n'}
                Tracked with @dormiegolf
              </Text>
            </View>
          </View>

          {/* Share buttons */}
          <View style={styles.shareActions}>
            <Pressable onPress={onShare} style={({ pressed }) => [styles.shareBtn, { backgroundColor: c.greenDark, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <Ionicons name="share-outline" size={18} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export function PostRoundSummary({ players, sideGames, onSaveRound, onClose }: PostRoundSummaryProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareFormat, setShareFormat] = useState<'story' | 'feed'>('story');

  const player = players[activePlayerIdx];

  if (!player) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Text style={{ color: c.textMuted, fontSize: 16 }}>No player data available.</Text>
      </View>
    );
  }

  const toPar = formatToPar(player.grossScore, player.coursePar);
  const counts = useMemo(() => categorizeScores(player.holes ?? []), [player.holes]);
  const stats = useMemo(() => computeStats(player.holes ?? []), [player.holes]);
  const puttBuckets = useMemo(() => computePuttBuckets(player.holes ?? []), [player.holes]);
  const front9 = (player.holes?.length ?? 0) >= 9 ? splitNine(player.holes, 'front') : null;
  const back9 = (player.holes?.length ?? 0) >= 18 ? splitNine(player.holes, 'back') : null;

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Shot ${player.grossScore} (${toPar}) at ${player.courseName} today! Tracked with @dormiegolf`,
      });
    } catch { }
    setShareVisible(false);
  }, [player, toPar]);

  const handleSave = useCallback(() => {
    haptics.success();
    onSaveRound(player.playerId);
    Alert.alert('Score Posted', 'Your score is on the board.');
  }, [player.playerId, onSaveRound]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Hero header */}
      <LinearGradient colors={greenHeaderGradient as unknown as string[]} style={styles.hero}>
        <View style={styles.heroTop}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.heroTitle, { fontFamily: GEO }]}>Round Complete</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Player tabs (multi-player) */}
        {players.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerTabs}>
            {players.map((p, i) => (
              <Pressable
                key={p.playerId}
                onPress={() => { haptics.light(); setActivePlayerIdx(i); }}
                style={[
                  styles.playerTab,
                  i === activePlayerIdx && { backgroundColor: '#FFFFFF18' },
                ]}
              >
                <Avatar id={p.playerId} name={p.name} size={24} />
                <Text style={[styles.playerTabName, { color: i === activePlayerIdx ? '#FFFFFF' : '#FFFFFF88' }]}>
                  {p.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Score display */}
        <View style={styles.heroScoreRow}>
          <Text style={[styles.heroGross, { color: '#D4AF37', fontFamily: GEO }]}>
            {player.grossScore}
          </Text>
          <View style={styles.heroMeta}>
            <Text style={[styles.heroToPar, { color: '#FFFFFFCC' }]}>{toPar}</Text>
            {player.netScore !== null && (
              <Text style={[styles.heroNet, { color: '#FFFFFF88' }]}>
                Net {player.netScore}
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.heroCourse, { color: '#FFFFFFAA' }]}>{player.courseName}</Text>

        {/* Front/back split */}
        {front9 !== null && back9 !== null && (
          <View style={styles.splitRow}>
            <View style={styles.splitItem}>
              <Text style={[styles.splitLabel, { color: '#FFFFFF66' }]}>Front</Text>
              <Text style={[styles.splitVal, { color: '#FFFFFF', fontFamily: GEO }]}>{front9}</Text>
            </View>
            <View style={[styles.splitDivider, { backgroundColor: '#FFFFFF33' }]} />
            <View style={styles.splitItem}>
              <Text style={[styles.splitLabel, { color: '#FFFFFF66' }]}>Back</Text>
              <Text style={[styles.splitVal, { color: '#FFFFFF', fontFamily: GEO }]}>{back9}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Scoring breakdown */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.gold }]}>SCORING BREAKDOWN</Text>
          <BreakdownBar counts={counts} total={player.holes.length} />
        </View>

        <GoldDivider style={{ marginVertical: 8, marginHorizontal: 16 }} />

        {/* Hole-by-hole */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.gold }]}>HOLE BY HOLE</Text>
          <HoleStrip holes={player.holes} colors={c} />
        </View>

        <GoldDivider style={{ marginVertical: 8, marginHorizontal: 16 }} />

        {/* Stats grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.gold }]}>STATS</Text>
          <StatsGrid stats={stats} colors={c} />
        </View>

        <GoldDivider style={{ marginVertical: 8, marginHorizontal: 16 }} />

        {/* Putt distance breakdown */}
        {puttBuckets.some((b) => b.total > 0) && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.gold }]}>PUTTING BY DISTANCE</Text>
              <PuttBreakdown buckets={puttBuckets} colors={c} />
            </View>
            <GoldDivider style={{ marginVertical: 8, marginHorizontal: 16 }} />
          </>
        )}

        {/* Side games */}
        <SideGameResults sideGames={sideGames} colors={c} />

        {/* Share & Save */}
        <View style={styles.actionSection}>
          <Text style={[styles.sectionTitle, { color: c.gold }]}>SHARE</Text>
          <View style={styles.shareRow}>
            <Pressable
              onPress={() => { haptics.light(); setShareFormat('story'); setShareVisible(true); }}
              style={({ pressed }) => [styles.shareFormatBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <Ionicons name="phone-portrait-outline" size={24} color={c.text} />
              <Text style={[styles.shareFormatLabel, { color: c.text }]}>Story</Text>
              <Text style={[styles.shareFormatRatio, { color: c.textMuted }]}>9:16</Text>
            </Pressable>
            <Pressable
              onPress={() => { haptics.light(); setShareFormat('feed'); setShareVisible(true); }}
              style={({ pressed }) => [styles.shareFormatBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <Ionicons name="square-outline" size={24} color={c.text} />
              <Text style={[styles.shareFormatLabel, { color: c.text }]}>Feed</Text>
              <Text style={[styles.shareFormatRatio, { color: c.textMuted }]}>1:1</Text>
            </Pressable>
          </View>
        </View>

        {/* Save round button */}
        <View style={styles.saveSection}>
          <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveBtn, { backgroundColor: c.greenDark, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Ionicons name="save" size={20} color="#FFFFFF" />
            <Text style={[styles.saveBtnText, { fontFamily: GEO, color: '#FFFFFF' }]}>Post Score</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ShareCardModal
        visible={shareVisible}
        player={player}
        format={shareFormat}
        onClose={() => setShareVisible(false)}
        onShare={handleShare}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero
  hero: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  playerTabs: { marginTop: 12, flexDirection: 'row' },
  playerTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, marginRight: 4 },
  playerTabName: { fontSize: 13, fontWeight: '600' },
  heroScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 16 },
  heroGross: { fontSize: 64, fontWeight: '700', letterSpacing: -1 },
  heroMeta: {},
  heroToPar: { fontSize: 20, fontWeight: '600' },
  heroNet: { fontSize: 14, marginTop: 2 },
  heroCourse: { fontSize: 14, marginTop: 4 },
  splitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 16 },
  splitItem: { alignItems: 'center' },
  splitLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  splitVal: { fontSize: 24, fontWeight: '700', marginTop: 2, letterSpacing: -1 },
  splitDivider: { width: 1, height: 28 },

  // Sections
  section: { padding: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 10, fontWeight: '600', marginBottom: 10, letterSpacing: 2, textTransform: 'uppercase' },

  // Breakdown bar
  breakdownContainer: {},
  breakdownBar: { flexDirection: 'row', height: 8, overflow: 'hidden' },
  breakdownSegment: { height: '100%' },
  breakdownLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 0 },
  legendText: { fontSize: 10, color: '#FFFFFF99' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { width: (SCREEN_W - 56) / 3, paddingVertical: 14, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '700', letterSpacing: -1 },
  statLabel: { fontSize: 10, marginTop: 2 },

  // Putt breakdown
  puttBreakdown: {},
  puttBucketRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  puttBucketLabel: { width: 70, fontSize: 10 },
  puttBucketBar: { flex: 1, height: 6, backgroundColor: '#FFFFFF11', position: 'relative' },
  puttBucketFill: { height: '100%', position: 'absolute', left: 0, top: 0 },
  puttBenchmark: { position: 'absolute', top: -2, width: 1, height: 10 },
  puttBucketVal: { width: 40, textAlign: 'right', fontSize: 13, fontWeight: '700' },

  // Hole strip
  holeStrip: { flexDirection: 'row' },
  holeCell: { width: 36, alignItems: 'center', paddingVertical: 6, marginRight: 3 },
  holeCellNum: { fontSize: 9 },
  holeCellScore: { fontSize: 16, fontWeight: '700', marginVertical: 2 },
  holeCellPar: { fontSize: 9 },

  // Side games
  sideGamesSection: { padding: 16, paddingBottom: 8 },
  sideGameCard: { padding: 14, marginBottom: 8 },
  sideGameLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' },
  sideGameRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sideGamePlayer: { fontSize: 13 },
  sideGameAmt: { fontSize: 16 },

  // Settlement
  settlementCard: { padding: 16, marginTop: 8 },
  settlementTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 2, marginBottom: 8, textAlign: 'center' },
  settlementRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  settlementName: { fontSize: 13, fontWeight: '500' },
  settlementAmt: { fontSize: 18, letterSpacing: -1 },

  // Share
  actionSection: { padding: 16 },
  shareRow: { flexDirection: 'row', gap: 10 },
  shareFormatBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 6 },
  shareFormatLabel: { fontSize: 14, fontWeight: '600' },
  shareFormatRatio: { fontSize: 11 },

  // Share card modal
  shareModalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  shareModalContent: { maxHeight: '90%', padding: 20 },
  shareModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  shareModalTitle: { fontSize: 16, fontWeight: '600' },
  shareCard: { alignSelf: 'center', overflow: 'hidden' },
  shareCardInner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  shareCardApp: { color: '#D4AF37', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  shareCardScore: { color: '#D4AF37', fontSize: 64, fontWeight: '700', marginTop: 8, letterSpacing: -1 },
  shareCardToPar: { color: '#FFFFFFCC', fontSize: 20, fontWeight: '600', marginTop: 4 },
  shareCardCourse: { color: '#FFFFFF88', fontSize: 14, marginTop: 8 },
  shareHoleRow: { flexDirection: 'row', marginTop: 12, gap: 2 },
  shareHoleCell: { width: 22, alignItems: 'center' },
  shareHoleCellVal: { fontSize: 11, fontWeight: '700' },
  shareCaption: { color: '#FFFFFF66', fontSize: 10, textAlign: 'center', marginTop: 16, lineHeight: 14 },
  shareActions: { marginTop: 16 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  shareBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Save
  saveSection: { padding: 16, paddingBottom: 40 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700' },
});
