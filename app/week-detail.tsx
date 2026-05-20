import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, StatusBar, Modal, Alert } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { haptics } from '../src/lib/haptics';
import {
  type WeeklySideGame,
  type WeeklySideGameType,
  SIDE_GAME_TYPE_CONFIG,
} from '../src/data/seasons-detail';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

const POINTS_TABLE = [25, 20, 16, 12, 10, 8, 6, 4, 2, 1];

const FORMAT_LABELS: Record<string, string> = {
  stableford: 'Stableford',
  modified_stableford: 'Mod. Stableford',
  stroke_net: 'Stroke (Net)',
  quota: 'Quota',
  best9: 'Best 9',
};

const FORMAT_EXPLANATIONS: Record<string, string> = {
  stableford: 'Points awarded per hole based on score relative to par. Double bogey+ = 0, Bogey = 1, Par = 2, Birdie = 3, Eagle = 4, Albatross = 5.',
  modified_stableford: 'Like Stableford but rewards aggressive play. Double bogey+ = -3, Bogey = -1, Par = 0, Birdie = +2, Eagle = +5, Albatross = +8.',
  stroke_net: 'Total strokes minus handicap strokes. Lowest net score wins. Handicap strokes allocated by hole difficulty.',
  quota: 'Each player has a quota based on handicap (36 minus handicap). Stableford points earned above quota are your score.',
  best9: 'Only your best 9-hole score counts. Pick front or back nine — whichever is better after handicap adjustment.',
};

// Demo players matching season-detail standings
const DEMO_PLAYERS = [
  { playerId: '1', name: 'McGowan', handicap: 8, avatarColor: '#006747' },
  { playerId: '2', name: 'Fletcher', handicap: 12, avatarColor: '#C9A227' },
  { playerId: '3', name: 'Patterson', handicap: 6, avatarColor: '#1E4D2B' },
  { playerId: '4', name: 'Sullivan', handicap: 15, avatarColor: '#C41E3A' },
  { playerId: '5', name: 'Rodriguez', handicap: 10, avatarColor: '#006747' },
  { playerId: '6', name: 'Chen', handicap: 18, avatarColor: '#C9A227' },
  { playerId: '7', name: 'Taylor', handicap: 14, avatarColor: '#1E4D2B' },
  { playerId: '8', name: 'Brooks', handicap: 20, avatarColor: '#C41E3A' },
];

// Week results per player (index = week-1, value = points earned that week)
const DEMO_WEEK_RESULTS: Record<string, number[]> = {
  '1': [25, 16, 20, 12],
  '2': [20, 25, 12, 8],
  '3': [16, 12, 25, 4],
  '4': [12, 20, 10, 2],
  '5': [10, 8, 16, 6],
  '6': [8, 10, 6, 6],
  '7': [6, 4, 8, 4],
  '8': [4, 6, 2, 2],
};

// Gross scores for display (fabricated per-week demo data)
const DEMO_GROSS_SCORES: Record<string, number[]> = {
  '1': [74, 78, 76, 80, 82, 84, 86, 90],
  '2': [76, 74, 80, 78, 84, 82, 88, 86],
  '3': [78, 80, 74, 82, 76, 86, 84, 90],
  '4': [80, 78, 82, 90, 84, 86, 88, 92],
};

// Demo course par for to-par calculation
const COURSE_PAR = 72;

// Previous week positions for delta calculation
const DEMO_PREV_POSITIONS: Record<string, Record<number, number>> = {
  '1': { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
  '2': { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 },
  '3': { 1: 1, 2: 2, 3: 3, 4: 5, 5: 4, 6: 6, 7: 7, 8: 8 },
  '4': { 1: 1, 2: 3, 3: 2, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 },
};

// Demo highlights per week
const DEMO_HIGHLIGHTS: Record<number, { roundHighlight: string; mostBirdies: string; biggestComeback: string }> = {
  1: {
    roundHighlight: 'McGowan — eagle on the par 5 7th to take the outright lead',
    mostBirdies: 'McGowan (5 birdies)',
    biggestComeback: 'Patterson (+3 positions)',
  },
  2: {
    roundHighlight: 'Fletcher — 3 consecutive birdies on holes 10-12 to surge past McGowan',
    mostBirdies: 'Fletcher (6 birdies)',
    biggestComeback: 'Sullivan (+2 positions)',
  },
  3: {
    roundHighlight: 'Patterson — came back from 5 over through 9 to finish +1',
    mostBirdies: 'Patterson (4 birdies)',
    biggestComeback: 'Rodriguez (+3 positions)',
  },
  4: {
    roundHighlight: 'Fletcher — birdie-birdie-birdie stretch on holes 4-6 to lock up 1st',
    mostBirdies: 'Fletcher (4 birdies)',
    biggestComeback: 'Chen (+2 positions)',
  },
};

// Demo season impact after each week
const DEMO_IMPACT: Record<number, string> = {
  1: 'After this week: McGowan leads by 5 pts, Patterson sits 2nd',
  2: 'After this week: McGowan leads by 3 pts, Fletcher closes the gap',
  3: 'After this week: McGowan leads by 8 pts, Patterson moves to 3rd',
  4: 'After this week: McGowan leads by 8 pts, Sullivan falls to 4th',
};

// Demo side games per week
const DEMO_SIDE_GAMES: Record<number, WeeklySideGame[]> = {
  1: [
    { id: 'sg1', week_id: 'w1', type: 'closest_to_pin', label: 'Closest to Pin', description: 'Closest tee shot to the pin on a par 3', points: 10, hole_number: 7, winner_user_id: '1', winner_name: 'McGowan', created_at: '2026-03-02' },
    { id: 'sg2', week_id: 'w1', type: 'longest_drive', label: 'Longest Drive', description: 'Longest drive in the fairway', points: 10, hole_number: 12, winner_user_id: '3', winner_name: 'Patterson', created_at: '2026-03-02' },
  ],
  2: [
    { id: 'sg3', week_id: 'w2', type: 'most_birdies', label: 'Most Birdies', description: 'Player with the most birdies this week', points: 15, hole_number: null, winner_user_id: '2', winner_name: 'Fletcher', created_at: '2026-03-09' },
    { id: 'sg4', week_id: 'w2', type: 'fewest_putts', label: 'Fewest Putts', description: 'Player with the fewest total putts', points: 10, hole_number: null, winner_user_id: null, winner_name: null, created_at: '2026-03-09' },
  ],
  3: [
    { id: 'sg5', week_id: 'w3', type: 'low_round', label: 'Low Round', description: 'Lowest gross score', points: 15, hole_number: null, winner_user_id: '3', winner_name: 'Patterson', created_at: '2026-03-16' },
  ],
  4: [
    { id: 'sg6', week_id: 'w4', type: 'sandbagger', label: 'Sandbagger Alert', description: 'Player who most outperforms their handicap', points: 10, hole_number: null, winner_user_id: null, winner_name: null, created_at: '2026-03-23' },
    { id: 'sg7', week_id: 'w4', type: 'closest_to_pin', label: 'Closest to Pin', description: 'Closest tee shot to the pin on a par 3', points: 10, hole_number: 4, winner_user_id: null, winner_name: null, created_at: '2026-03-23' },
    { id: 'sg8', week_id: 'w4', type: 'custom', label: 'First Ace Watch', description: 'Hole-in-one on any par 3 — dream big', points: 50, hole_number: null, winner_user_id: null, winner_name: null, created_at: '2026-03-23' },
  ],
};

const SIDE_GAME_TYPES: WeeklySideGameType[] = [
  'closest_to_pin', 'longest_drive', 'most_birdies', 'low_round',
  'most_improved', 'fewest_putts', 'sandbagger', 'custom',
];

// ─── Add Side Game Modal ─────────────────────────────────────────────
function AddSideGameModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (game: { type: WeeklySideGameType; points: number; hole_number: number | null; customLabel: string; customDesc: string }) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [selectedType, setSelectedType] = useState<WeeklySideGameType>('closest_to_pin');
  const [points, setPoints] = useState(10);
  const [holeNumber, setHoleNumber] = useState(1);
  const [customLabel, setCustomLabel] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  const config = SIDE_GAME_TYPE_CONFIG[selectedType];

  const handleAdd = () => {
    haptics.success();
    onAdd({
      type: selectedType,
      points,
      hole_number: config.needsHole ? holeNumber : null,
      customLabel: selectedType === 'custom' ? customLabel : '',
      customDesc: selectedType === 'custom' ? customDesc : '',
    });
    // Reset
    setSelectedType('closest_to_pin');
    setPoints(10);
    setHoleNumber(1);
    setCustomLabel('');
    setCustomDesc('');
  };

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={sgStyles.modalOverlay}>
        <View style={[sgStyles.modalContent, { backgroundColor: c.cardBg }]}>
          <View style={sgStyles.modalHeader}>
            <Text style={[sgStyles.modalTitle, { color: c.gold, fontFamily: GEO }]}>ADD SIDE GAME</Text>
            <Pressable onPress={() => { haptics.light(); onClose(); }} hitSlop={12}>
              <Ionicons name="close" size={24} color={c.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Type Selection */}
            <Text style={[sgStyles.fieldLabel, { color: c.textMuted }]}>Game Type</Text>
            <View style={sgStyles.typeGrid}>
              {SIDE_GAME_TYPES.map((type) => {
                const cfg = SIDE_GAME_TYPE_CONFIG[type];
                const isSelected = type === selectedType;
                return (
                  <Pressable
                    key={type}
                    onPress={() => { haptics.light(); setSelectedType(type); }}
                    style={[
                      sgStyles.typeChip,
                      { backgroundColor: isSelected ? c.gold + '22' : c.elevated, borderColor: isSelected ? c.gold : c.border },
                    ]}
                  >
                    <Text style={sgStyles.typeEmoji}>{cfg.emoji}</Text>
                    <Text style={[sgStyles.typeLabel, { color: isSelected ? c.gold : c.text }]} numberOfLines={1}>
                      {cfg.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[sgStyles.fieldDesc, { color: c.textMuted }]}>{config.description}</Text>

            {/* Points Stepper */}
            <Text style={[sgStyles.fieldLabel, { color: c.textMuted, marginTop: 16 }]}>Points Value</Text>
            <View style={sgStyles.stepperRow}>
              <Pressable
                onPress={() => { haptics.light(); setPoints(Math.max(5, points - 5)); }}
                style={[sgStyles.stepperBtn, { backgroundColor: c.elevated }]}
              >
                <Ionicons name="remove" size={20} color={c.text} />
              </Pressable>
              <Text style={[sgStyles.stepperValue, { color: c.gold, fontFamily: GEO }]}>{points}</Text>
              <Pressable
                onPress={() => { haptics.light(); setPoints(Math.min(50, points + 5)); }}
                style={[sgStyles.stepperBtn, { backgroundColor: c.elevated }]}
              >
                <Ionicons name="add" size={20} color={c.text} />
              </Pressable>
            </View>

            {/* Hole Picker (if applicable) */}
            {config.needsHole && (
              <>
                <Text style={[sgStyles.fieldLabel, { color: c.textMuted, marginTop: 16 }]}>Hole Number</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sgStyles.holePicker}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => { haptics.light(); setHoleNumber(h); }}
                      style={[
                        sgStyles.holeChip,
                        { backgroundColor: h === holeNumber ? c.gold : c.elevated, borderColor: h === holeNumber ? c.gold : c.border },
                      ]}
                    >
                      <Text style={[sgStyles.holeChipText, { color: h === holeNumber ? '#000000' : c.text, fontFamily: GEO }]}>{h}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Custom label/description (for custom type only) */}
            {selectedType === 'custom' && (
              <>
                <Text style={[sgStyles.fieldLabel, { color: c.textMuted, marginTop: 16 }]}>Game Name</Text>
                <View style={[sgStyles.textInput, { backgroundColor: c.elevated, borderColor: c.border }]}>
                  <Text style={[sgStyles.textInputPlaceholder, { color: customLabel ? c.text : c.textMuted }]}>
                    {customLabel || 'Enter a name...'}
                  </Text>
                </View>
                <Text style={[sgStyles.fieldLabel, { color: c.textMuted, marginTop: 12 }]}>Description</Text>
                <View style={[sgStyles.textInput, { backgroundColor: c.elevated, borderColor: c.border }]}>
                  <Text style={[sgStyles.textInputPlaceholder, { color: customDesc ? c.text : c.textMuted }]}>
                    {customDesc || 'Enter a description...'}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Add Button */}
          <Pressable onPress={handleAdd} style={[sgStyles.addBtn, { backgroundColor: c.gold }]}>
            <Ionicons name="add-circle" size={20} color="#000000" />
            <Text style={[sgStyles.addBtnText, { fontFamily: GEO }]}>Add Side Game</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Pick Side Game Winners Modal ────────────────────────────────────
function PickWinnersModal({
  visible,
  sideGames,
  players,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  sideGames: WeeklySideGame[];
  players: { playerId: string; name: string }[];
  onClose: () => void;
  onConfirm: (picks: { sideGameId: string; winnerUserId: string | null }[]) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const unpicked = sideGames.filter((sg) => !sg.winner_user_id);

  const [picks, setPicks] = useState<Record<string, string | null>>(
    Object.fromEntries(unpicked.map((sg) => [sg.id, null]))
  );

  const handleSelect = (sideGameId: string, playerId: string | null) => {
    haptics.light();
    setPicks((prev) => ({ ...prev, [sideGameId]: playerId }));
  };

  const handleConfirm = () => {
    haptics.success();
    onConfirm(
      Object.entries(picks).map(([sideGameId, winnerUserId]) => ({
        sideGameId,
        winnerUserId,
      }))
    );
  };

  if (unpicked.length === 0) return null;

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={sgStyles.modalOverlay}>
        <View style={[sgStyles.modalContent, { backgroundColor: c.cardBg }]}>
          <View style={sgStyles.modalHeader}>
            <Text style={[sgStyles.modalTitle, { color: c.gold, fontFamily: GEO }]}>PICK WINNERS</Text>
            <Pressable onPress={() => { haptics.light(); onClose(); }} hitSlop={12}>
              <Ionicons name="close" size={24} color={c.textMuted} />
            </Pressable>
          </View>

          <Text style={[sgStyles.pickSubtitle, { color: c.textMuted }]}>
            Select a winner for each side game, or skip if no one qualified.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {unpicked.map((sg) => {
              const cfg = SIDE_GAME_TYPE_CONFIG[sg.type as WeeklySideGameType] ?? SIDE_GAME_TYPE_CONFIG.custom;
              return (
                <View key={sg.id} style={[sgStyles.pickCard, { backgroundColor: c.elevated, borderColor: c.border }]}>
                  <View style={sgStyles.pickCardHeader}>
                    <Text style={sgStyles.pickEmoji}>{cfg.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[sgStyles.pickLabel, { color: c.text }]}>
                        {sg.label}{sg.hole_number ? ` (Hole ${sg.hole_number})` : ''}
                      </Text>
                      <Text style={[sgStyles.pickPoints, { color: c.gold, fontFamily: GEO }]}>{sg.points} pts</Text>
                    </View>
                  </View>

                  <View style={sgStyles.pickPlayerGrid}>
                    {players.map((p) => {
                      const isSelected = picks[sg.id] === p.playerId;
                      return (
                        <Pressable
                          key={p.playerId}
                          onPress={() => handleSelect(sg.id, isSelected ? null : p.playerId)}
                          style={[
                            sgStyles.pickPlayerChip,
                            { backgroundColor: isSelected ? c.gold + '22' : c.cardBg, borderColor: isSelected ? c.gold : c.border },
                          ]}
                        >
                          <Avatar id={p.playerId} name={p.name} size={24} />
                          <Text style={[sgStyles.pickPlayerName, { color: isSelected ? c.gold : c.text }]} numberOfLines={1}>
                            {p.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {/* Skip option */}
                    <Pressable
                      onPress={() => handleSelect(sg.id, null)}
                      style={[
                        sgStyles.pickPlayerChip,
                        { backgroundColor: picks[sg.id] === null ? c.urgent + '15' : c.cardBg, borderColor: picks[sg.id] === null ? c.urgent + '44' : c.border },
                      ]}
                    >
                      <Ionicons name="close-circle-outline" size={24} color={c.textMuted} />
                      <Text style={[sgStyles.pickPlayerName, { color: c.textMuted }]}>Skip</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Pressable onPress={handleConfirm} style={[sgStyles.addBtn, { backgroundColor: c.gold }]}>
            <Ionicons name="checkmark-circle" size={20} color="#000000" />
            <Text style={[sgStyles.addBtnText, { fontFamily: GEO }]}>Confirm Winners</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function getWeekResults(weekNumber: number) {
  const results = DEMO_PLAYERS.map((player, idx) => {
    const weekResults = DEMO_WEEK_RESULTS[player.playerId];
    const points = weekResults && weekResults[weekNumber - 1] != null ? weekResults[weekNumber - 1] : 0;
    const grossScores = DEMO_GROSS_SCORES[String(weekNumber)];
    const score = grossScores ? grossScores[idx] : 80 + idx * 2;
    const toPar = score - COURSE_PAR;
    const prevPos = DEMO_PREV_POSITIONS[String(weekNumber)]?.[idx + 1] ?? 0;
    return { ...player, points, score, toPar, prevPos };
  });

  // Sort by points descending
  results.sort((a, b) => b.points - a.points);

  // Assign ranks and compute delta
  return results.map((r, i) => {
    const rank = i + 1;
    let delta = 0;
    if (r.prevPos > 0) {
      delta = r.prevPos - rank; // positive = improved
    }
    return { ...r, rank, delta };
  });
}

export default function WeekDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{
    season_id: string;
    week_number: string;
    format?: string;
    is_major?: string;
    major_name?: string;
    multiplier?: string;
    date_range?: string;
    multi_round?: string;
    rounds_allowed?: string;
    best_rounds?: string;
    participation_bonus?: string;
    participation_points?: string;
  }>();

  const weekNumber = parseInt(params.week_number ?? '1', 10);
  const format = params.format ?? 'stableford';
  const isMajor = params.is_major === '1';
  const majorName = params.major_name ?? null;
  const multiplier = parseInt(params.multiplier ?? '1', 10);
  const dateRange = params.date_range ?? null;

  // Multi-round and participation config
  const multiRound = params.multi_round === '1';
  const roundsAllowed = parseInt(params.rounds_allowed ?? '1', 10);
  const bestRounds = parseInt(params.best_rounds ?? '1', 10);
  const hasParticipation = params.participation_bonus === '1';
  const participationPts = parseInt(params.participation_points ?? '0', 10);

  const results = getWeekResults(weekNumber);
  const highlights = DEMO_HIGHLIGHTS[weekNumber] ?? DEMO_HIGHLIGHTS[1];
  const impact = DEMO_IMPACT[weekNumber] ?? DEMO_IMPACT[1];
  const formatExplanation = FORMAT_EXPLANATIONS[format] ?? null;

  const [formatExpanded, setFormatExpanded] = useState(false);

  // Side games state
  const [sideGames, setSideGames] = useState<WeeklySideGame[]>(DEMO_SIDE_GAMES[weekNumber] ?? []);
  const [showAddSideGame, setShowAddSideGame] = useState(false);
  const [showPickWinners, setShowPickWinners] = useState(false);
  const isCommissioner = true; // Demo: current user is commissioner
  const weekCompleted = weekNumber <= 3; // Demo: weeks 1-3 are completed
  const hasUnpickedWinners = sideGames.some((sg) => !sg.winner_user_id) && weekCompleted;

  const handleAddSideGame = useCallback((game: {
    type: WeeklySideGameType;
    points: number;
    hole_number: number | null;
    customLabel: string;
    customDesc: string;
  }) => {
    const cfg = SIDE_GAME_TYPE_CONFIG[game.type];
    const newGame: WeeklySideGame = {
      id: `sg_${Date.now()}`,
      week_id: `w${weekNumber}`,
      type: game.type,
      label: game.type === 'custom' && game.customLabel ? game.customLabel : cfg.label,
      description: game.type === 'custom' && game.customDesc ? game.customDesc : cfg.description,
      points: game.points,
      hole_number: game.hole_number,
      winner_user_id: null,
      winner_name: null,
      created_at: new Date().toISOString(),
    };
    setSideGames((prev) => [...prev, newGame]);
    setShowAddSideGame(false);
  }, [weekNumber]);

  const handleConfirmWinners = useCallback((picks: { sideGameId: string; winnerUserId: string | null }[]) => {
    setSideGames((prev) => prev.map((sg) => {
      const pick = picks.find((p) => p.sideGameId === sg.id);
      if (!pick || !pick.winnerUserId) return sg;
      const player = DEMO_PLAYERS.find((p) => p.playerId === pick.winnerUserId);
      return { ...sg, winner_user_id: pick.winnerUserId, winner_name: player?.name ?? 'Unknown' };
    }));
    setShowPickWinners(false);
    haptics.success();
  }, []);

  const handleRemoveSideGame = useCallback((id: string) => {
    Alert.alert('Remove Side Game', 'Are you sure you want to remove this side game?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          haptics.light();
          setSideGames((prev) => prev.filter((sg) => sg.id !== id));
        },
      },
    ]);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={greenHeaderGradient} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { fontFamily: GEO }]}>
              Week {weekNumber}
            </Text>
            <Text style={styles.headerSubtitle}>
              {FORMAT_LABELS[format] ?? format}
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Major badge */}
        {isMajor && majorName && (
          <View style={styles.majorRow}>
            <View style={[styles.majorBadge, { backgroundColor: '#C9A22733' }]}>
              <Ionicons name="trophy" size={12} color="#C9A227" />
              <Text style={[styles.majorBadgeText, { color: '#C9A227', fontFamily: GEO }]}>MAJOR</Text>
            </View>
            <Text style={[styles.majorName, { color: '#C9A227', fontFamily: GEO }]}>{majorName}</Text>
          </View>
        )}

        {/* Multiplier badge */}
        {multiplier > 1 && (
          <View style={styles.multiplierRow}>
            <View style={[styles.multiplierBadge, { backgroundColor: '#C9A22722' }]}>
              <Ionicons name="star" size={12} color="#C9A227" />
              <Text style={[styles.multiplierText, { color: '#C9A227', fontFamily: GEO }]}>
                {multiplier}× Points
              </Text>
            </View>
          </View>
        )}

        {/* Date range */}
        {dateRange && (
          <Text style={styles.dateRange}>{dateRange}</Text>
        )}
      </LinearGradient>
      <GoldDivider />

      {/* Body */}
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* Format Explanation */}
        {formatExplanation && (
          <Pressable
            onPress={() => { haptics.light(); setFormatExpanded(!formatExpanded); }}
            style={[styles.formatCard, { backgroundColor: theme.isDark ? c.elevated : '#F5F1EB', borderColor: c.border }]}
          >
            <View style={styles.formatCardHeader}>
              <Ionicons name="information-circle-outline" size={18} color={c.teal} />
              <Text style={[styles.formatCardTitle, { color: c.teal }]}>Format Explanation</Text>
              <Ionicons name={formatExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.textMuted} />
            </View>
            {formatExpanded && (
              <Text style={[styles.formatCardBody, { color: c.textMuted }]}>
                {formatExplanation}
              </Text>
            )}
          </Pressable>
        )}

        {/* Table header */}
        <View style={[styles.tableHeader, { backgroundColor: theme.isDark ? c.elevated : '#006747' }]}>
          <Text style={[styles.thRank, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>#</Text>
          <Text style={[styles.thPlayer, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>Player</Text>
          <Text style={[styles.thScore, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>Score</Text>
          <Text style={[styles.thToPar, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>To Par</Text>
          <Text style={[styles.thDelta, { color: theme.isDark ? c.textMuted : '#FFFFFF' }]}>{'\u0394'}</Text>
          <Text style={[styles.thPoints, { color: theme.isDark ? c.gold : '#FFFFFF', fontFamily: GEO }]}>PTS</Text>
        </View>

        {results.map((r, i) => {
          const isWinner = i === 0;
          return (
            <View
              key={r.playerId}
              style={[
                styles.resultRow,
                {
                  borderBottomColor: c.border,
                  backgroundColor: isWinner
                    ? (theme.isDark ? '#C9A22710' : '#C9A22712')
                    : (theme.isDark ? undefined : (i % 2 === 0 ? '#FFFFFF' : '#F8F7F5')),
                },
              ]}
            >
              <Text
                style={[
                  styles.rrRank,
                  {
                    color: isWinner ? c.gold : i < 3 ? c.teal : c.textMuted,
                    fontFamily: GEO,
                  },
                ]}
              >
                {r.rank}
              </Text>

              <View style={styles.rrPlayer}>
                <Avatar id={r.playerId} name={r.name} size={28} />
                <View>
                  <Text
                    style={[
                      styles.rrName,
                      { color: isWinner ? '#C9A227' : c.text },
                    ]}
                    numberOfLines={1}
                  >
                    {r.name}
                  </Text>
                  <Text style={[styles.rrHcp, { color: c.textMuted }]}>{r.handicap} hcp</Text>
                </View>
              </View>

              <Text style={[styles.rrScore, { color: c.textMuted, fontFamily: GEO }]}>
                {r.score}
              </Text>

              <Text
                style={[
                  styles.rrToPar,
                  {
                    color: r.toPar < 0 ? '#006747' : r.toPar > 0 ? '#C41E3A' : c.textMuted,
                    fontFamily: GEO,
                  },
                ]}
              >
                {r.toPar === 0 ? 'E' : (r.toPar > 0 ? `+${r.toPar}` : r.toPar)}
              </Text>

              <Text
                style={[
                  styles.rrDelta,
                  {
                    color: r.delta > 0 ? '#006747' : r.delta < 0 ? '#C41E3A' : c.textMuted,
                    fontFamily: GEO,
                  },
                ]}
              >
                {r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${Math.abs(r.delta)}` : '—'}
              </Text>

              <Text style={[styles.rrPoints, { color: c.gold, fontFamily: GEO }]}>
                {r.points}
              </Text>
            </View>
          );
        })}

        {/* Multi-Round Breakdown (if enabled) */}
        {multiRound && (
          <View style={[styles.multiRoundCard, { backgroundColor: theme.isDark ? c.elevated : '#F5F1EB', borderColor: c.border }]}>
            <View style={styles.multiRoundHeader}>
              <Ionicons name="layers-outline" size={16} color={c.teal} />
              <Text style={[styles.multiRoundTitle, { color: c.teal, fontFamily: GEO }]}>
                BEST {bestRounds} OF {roundsAllowed} ROUNDS
              </Text>
            </View>
            <Text style={[styles.multiRoundDesc, { color: c.textMuted }]}>
              Players logged up to {roundsAllowed} rounds this week. Top {bestRounds} count toward standings.
            </Text>

            {/* Demo: show McGowan's rounds as example */}
            <View style={[styles.multiRoundExample, { borderTopColor: c.border }]}>
              <Text style={[styles.multiRoundExLabel, { color: c.textMuted }]}>McGowan's rounds:</Text>
              {[
                { score: 74, points: 25, counted: true },
                { score: 78, points: 16, counted: bestRounds >= 2 },
                ...(roundsAllowed >= 3 ? [{ score: 82, points: 10, counted: false }] : []),
              ].map((r, i) => (
                <View key={i} style={styles.multiRoundRow}>
                  <Ionicons
                    name={r.counted ? 'checkmark-circle' : 'close-circle-outline'}
                    size={16}
                    color={r.counted ? c.teal : c.textMuted}
                  />
                  <Text style={[styles.multiRoundScore, { color: r.counted ? c.text : c.textMuted, fontFamily: GEO }]}>
                    {r.score}
                  </Text>
                  <Text style={[styles.multiRoundPts, { color: r.counted ? c.gold : c.textMuted, fontFamily: GEO }]}>
                    {r.points} pts
                  </Text>
                  {!r.counted && <Text style={[styles.multiRoundDropped, { color: c.textMuted }]}>dropped</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Points Breakdown (if participation enabled) */}
        {hasParticipation && (
          <View style={[styles.participationCard, { backgroundColor: theme.isDark ? c.elevated : '#FFFFFF', borderColor: c.teal + '33' }]}>
            <View style={styles.participationHeader}>
              <Ionicons name="hand-left-outline" size={16} color={c.teal} />
              <Text style={[styles.participationTitle, { color: c.teal, fontFamily: GEO }]}>POINTS BREAKDOWN</Text>
            </View>
            <View style={styles.participationRow}>
              <Text style={[styles.participationLabel, { color: c.textMuted }]}>Position points</Text>
              <Text style={[styles.participationVal, { color: c.gold, fontFamily: GEO }]}>
                {results[0]?.points ?? 0}
              </Text>
            </View>
            <View style={[styles.participationRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
              <Text style={[styles.participationLabel, { color: c.textMuted }]}>Participation bonus</Text>
              <Text style={[styles.participationVal, { color: c.teal, fontFamily: GEO }]}>
                +{participationPts}
              </Text>
            </View>
            <View style={[styles.participationRow, { borderTopWidth: 1, borderTopColor: c.gold + '44' }]}>
              <Text style={[styles.participationLabel, { color: c.text, fontWeight: '700' }]}>Total</Text>
              <Text style={[styles.participationVal, { color: c.gold, fontFamily: GEO, fontSize: 18 }]}>
                {(results[0]?.points ?? 0) + participationPts}
              </Text>
            </View>
          </View>
        )}

        {/* Side Games */}
        {(sideGames.length > 0 || isCommissioner) && (
          <View style={[sgStyles.sideGamesSection, { backgroundColor: theme.isDark ? c.elevated : '#F5F1EB' }]}>
            <View style={sgStyles.sideGamesHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="trophy" size={16} color={c.gold} />
                <Text style={[sgStyles.sideGamesTitle, { color: c.gold, fontFamily: GEO }]}>SIDE GAMES</Text>
              </View>
              {isCommissioner && !weekCompleted && (
                <Pressable
                  onPress={() => { haptics.light(); setShowAddSideGame(true); }}
                  style={[sgStyles.addSideGameBtn, { backgroundColor: c.gold + '18', borderColor: c.gold + '44' }]}
                >
                  <Ionicons name="add" size={16} color={c.gold} />
                  <Text style={[sgStyles.addSideGameBtnText, { color: c.gold }]}>Add</Text>
                </Pressable>
              )}
            </View>

            {sideGames.length === 0 && (
              <Text style={[sgStyles.noGames, { color: c.textMuted }]}>
                No side games this week. {isCommissioner ? 'Tap "Add" to create one.' : ''}
              </Text>
            )}

            {sideGames.map((sg) => {
              const cfg = SIDE_GAME_TYPE_CONFIG[sg.type as WeeklySideGameType] ?? SIDE_GAME_TYPE_CONFIG.custom;
              const hasWinner = !!sg.winner_user_id;
              return (
                <View key={sg.id} style={[sgStyles.sideGameRow, { borderBottomColor: c.border }]}>
                  <Text style={sgStyles.sideGameEmoji}>{cfg.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[sgStyles.sideGameLabel, { color: c.text }]}>
                      {sg.label}{sg.hole_number ? ` (Hole ${sg.hole_number})` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={[sgStyles.sideGamePoints, { color: c.gold, fontFamily: GEO }]}>{sg.points} pts</Text>
                      <Text style={[sgStyles.sideGameSep, { color: c.textMuted }]}>{'\u2014'}</Text>
                      {hasWinner ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="trophy" size={12} color={c.gold} />
                          <Text style={[sgStyles.sideGameWinner, { color: c.gold }]}>{sg.winner_name}</Text>
                        </View>
                      ) : (
                        <Text style={[sgStyles.sideGameTbd, { color: c.textMuted }]}>TBD</Text>
                      )}
                    </View>
                  </View>
                  {isCommissioner && !sg.winner_user_id && !weekCompleted && (
                    <Pressable onPress={() => handleRemoveSideGame(sg.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={c.textMuted} />
                    </Pressable>
                  )}
                </View>
              );
            })}

            {/* Commissioner prompt to pick winners */}
            {isCommissioner && hasUnpickedWinners && (
              <Pressable
                onPress={() => { haptics.light(); setShowPickWinners(true); }}
                style={[sgStyles.pickWinnersBtn, { backgroundColor: c.gold + '18', borderColor: c.gold + '44' }]}
              >
                <Ionicons name="ribbon" size={16} color={c.gold} />
                <Text style={[sgStyles.pickWinnersBtnText, { color: c.gold, fontFamily: GEO }]}>
                  Pick Side Game Winners
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Week Highlights */}
        <View style={[styles.highlightsCard, { backgroundColor: theme.isDark ? c.elevated : '#F5F1EB' }]}>
          <Text style={[styles.highlightsTitle, { color: c.gold, fontFamily: GEO }]}>WEEK HIGHLIGHTS</Text>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightEmoji}>{'🦅'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.highlightLabel, { color: c.textMuted }]}>Round Highlight</Text>
              <Text style={[styles.highlightValue, { color: c.text }]}>{highlights.roundHighlight}</Text>
            </View>
          </View>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightEmoji}>{'🐦'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.highlightLabel, { color: c.textMuted }]}>Most Birdies</Text>
              <Text style={[styles.highlightValue, { color: c.text }]}>{highlights.mostBirdies}</Text>
            </View>
          </View>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightEmoji}>{'🔄'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.highlightLabel, { color: c.textMuted }]}>Biggest Comeback</Text>
              <Text style={[styles.highlightValue, { color: c.text }]}>{highlights.biggestComeback}</Text>
            </View>
          </View>
        </View>

        {/* Season Impact */}
        <View style={[styles.impactCard, { backgroundColor: theme.isDark ? c.elevated : '#FFFFFF', borderColor: c.gold + '33' }]}>
          <Ionicons name="trending-up" size={18} color={c.gold} />
          <Text style={[styles.impactTitle, { color: c.gold, fontFamily: GEO }]}>SEASON IMPACT</Text>
          <Text style={[styles.impactText, { color: c.text }]}>{impact}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      <AddSideGameModal
        visible={showAddSideGame}
        onClose={() => setShowAddSideGame(false)}
        onAdd={handleAddSideGame}
      />
      <PickWinnersModal
        visible={showPickWinners}
        sideGames={sideGames}
        players={DEMO_PLAYERS}
        onClose={() => setShowPickWinners(false)}
        onConfirm={handleConfirmWinners}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: STATUS_BAR_H + 8, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#FFFFFF99', marginTop: 2 },

  majorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'center' },
  majorBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  majorBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  majorName: { fontSize: 16, fontWeight: '700' },

  multiplierRow: { marginTop: 8, alignItems: 'center' },
  multiplierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4 },
  multiplierText: { fontSize: 13, fontWeight: '700' },

  dateRange: { textAlign: 'center', fontSize: 12, color: '#FFFFFF99', marginTop: 6 },

  body: { flex: 1 },

  // Format explanation card
  formatCard: { marginHorizontal: 16, marginTop: 16, padding: 14, borderWidth: 1 },
  formatCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formatCardTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  formatCardBody: { fontSize: 13, lineHeight: 19, marginTop: 10 },

  // Table
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 16 },
  thRank: { width: 28, fontSize: 11, fontWeight: '600' },
  thPlayer: { flex: 1, fontSize: 11, fontWeight: '600' },
  thScore: { width: 44, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  thToPar: { width: 44, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  thDelta: { width: 32, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  thPoints: { width: 44, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rrRank: { width: 28, fontSize: 16, fontWeight: '700' },
  rrPlayer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rrName: { fontSize: 14, fontWeight: '600' },
  rrHcp: { fontSize: 10, marginTop: 1 },
  rrScore: { width: 44, fontSize: 14, textAlign: 'center' },
  rrToPar: { width: 44, fontSize: 13, textAlign: 'center', fontWeight: '600' },
  rrDelta: { width: 32, fontSize: 12, textAlign: 'center' },
  rrPoints: { width: 44, fontSize: 16, fontWeight: '700', textAlign: 'right' },

  // Highlights
  highlightsCard: { marginHorizontal: 16, marginTop: 20, padding: 16 },
  highlightsTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  highlightEmoji: { fontSize: 18, width: 26 },
  highlightLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' as const },
  highlightValue: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  // Season Impact
  impactCard: { marginHorizontal: 16, marginTop: 12, padding: 14, borderWidth: 1 },
  impactTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 6, marginBottom: 6 },
  impactText: { fontSize: 14, lineHeight: 20 },

  // Multi-Round Breakdown
  multiRoundCard: { marginHorizontal: 16, marginTop: 20, padding: 16, borderWidth: 1 },
  multiRoundHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  multiRoundTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  multiRoundDesc: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  multiRoundExample: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4 },
  multiRoundExLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' as const },
  multiRoundRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  multiRoundScore: { fontSize: 16, fontWeight: '700', width: 36 },
  multiRoundPts: { fontSize: 13, fontWeight: '600', width: 48 },
  multiRoundDropped: { fontSize: 11, fontStyle: 'italic' },

  // Participation Breakdown
  participationCard: { marginHorizontal: 16, marginTop: 12, padding: 14, borderWidth: 1 },
  participationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  participationTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  participationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  participationLabel: { fontSize: 13 },
  participationVal: { fontSize: 15, fontWeight: '700' },
});

// ─── Side Game Styles ────────────────────────────────────────────────
const sgStyles = StyleSheet.create({
  // Section
  sideGamesSection: { marginHorizontal: 16, marginTop: 20, padding: 16 },
  sideGamesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sideGamesTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  noGames: { fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  addSideGameBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  addSideGameBtnText: { fontSize: 12, fontWeight: '600' },

  // Side game row
  sideGameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  sideGameEmoji: { fontSize: 20, width: 28 },
  sideGameLabel: { fontSize: 14, fontWeight: '600' },
  sideGamePoints: { fontSize: 13, fontWeight: '700' },
  sideGameSep: { fontSize: 12 },
  sideGameWinner: { fontSize: 13, fontWeight: '600' },
  sideGameTbd: { fontSize: 13, fontStyle: 'italic' },

  // Pick winners button
  pickWinnersBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 12, borderWidth: 1 },
  pickWinnersBtnText: { fontSize: 13, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },

  // Add side game modal
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' as const, marginBottom: 8 },
  fieldDesc: { fontSize: 12, lineHeight: 17, marginTop: 8, fontStyle: 'italic' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, width: '48%' as any },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'center' },
  stepperBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 32, fontWeight: '700', minWidth: 60, textAlign: 'center' },
  holePicker: { maxHeight: 50 },
  holeChip: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginRight: 6 },
  holeChipText: { fontSize: 14, fontWeight: '700' },
  textInput: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  textInputPlaceholder: { fontSize: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 16 },
  addBtnText: { fontSize: 16, fontWeight: '700', color: '#000000' },

  // Pick winners modal
  pickSubtitle: { fontSize: 13, marginBottom: 16 },
  pickCard: { padding: 14, marginBottom: 12, borderWidth: 1 },
  pickCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pickEmoji: { fontSize: 24 },
  pickLabel: { fontSize: 15, fontWeight: '600' },
  pickPoints: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  pickPlayerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickPlayerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  pickPlayerName: { fontSize: 12, fontWeight: '500' },
});
