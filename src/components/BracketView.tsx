import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO, SANS } from '../theme/fonts';
import type {
  BracketMatch,
  BracketSize,
} from '../data/seasons-detail';
import { getBracketRounds, getBracketRoundLabel } from '../data/seasons-detail';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Match Card ──────────────────────────────────────────────────────

function MatchCard({
  match,
  isChampionship,
}: {
  match: BracketMatch;
  isChampionship: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isCompleted = match.status === 'completed';
  const isBye = match.status === 'bye';
  const isInProgress = match.status === 'in_progress';

  const p1IsWinner = isCompleted && match.winner_id === match.player1_id;
  const p2IsWinner = isCompleted && match.winner_id === match.player2_id;

  const championshipBorder = isChampionship ? { borderColor: c.gold, borderWidth: 1.5 } : {};

  return (
    <View
      style={[
        styles.matchCard,
        { backgroundColor: theme.isDark ? c.elevated : c.cardBg },
        championshipBorder,
      ]}
    >
      {isChampionship && (
        <View style={[styles.champLabel, { backgroundColor: c.gold }]}>
          <Ionicons name="trophy" size={8} color="#000" />
          <Text style={styles.champLabelText}>FINAL</Text>
        </View>
      )}

      {/* Player 1 */}
      <View
        style={[
          styles.matchPlayer,
          { borderBottomColor: theme.isDark ? c.border : c.borderLight },
          p1IsWinner && { backgroundColor: c.gold + '12' },
        ]}
      >
        {match.player1_seed != null && (
          <Text style={[styles.seed, { color: c.textMuted }]}>{match.player1_seed}</Text>
        )}
        <Text
          style={[
            styles.playerName,
            {
              color: p1IsWinner ? c.gold : match.player1_name ? c.text : c.textMuted,
              fontWeight: p1IsWinner ? '700' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {match.player1_name ?? 'TBD'}
        </Text>
        {match.player1_score != null && (
          <Text
            style={[
              styles.score,
              { color: p1IsWinner ? c.gold : c.textMuted, fontFamily: GEO },
            ]}
          >
            {match.player1_score}
          </Text>
        )}
        {p1IsWinner && <Ionicons name="checkmark" size={12} color={c.gold} />}
      </View>

      {/* Player 2 */}
      <View
        style={[
          styles.matchPlayer,
          p2IsWinner && { backgroundColor: c.gold + '12' },
        ]}
      >
        {match.player2_seed != null && (
          <Text style={[styles.seed, { color: c.textMuted }]}>{match.player2_seed}</Text>
        )}
        <Text
          style={[
            styles.playerName,
            {
              color: p2IsWinner ? c.gold : match.player2_name ? c.text : c.textMuted,
              fontWeight: p2IsWinner ? '700' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {isBye && !match.player2_name ? 'BYE' : (match.player2_name ?? 'TBD')}
        </Text>
        {match.player2_score != null && (
          <Text
            style={[
              styles.score,
              { color: p2IsWinner ? c.gold : c.textMuted, fontFamily: GEO },
            ]}
          >
            {match.player2_score}
          </Text>
        )}
        {p2IsWinner && <Ionicons name="checkmark" size={12} color={c.gold} />}
      </View>

      {/* Status badge */}
      {isInProgress && (
        <View style={[styles.statusBadge, { backgroundColor: c.teal + '22' }]}>
          <Text style={[styles.statusText, { color: c.teal }]}>IN PROGRESS</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main BracketView ────────────────────────────────────────────────

export type BracketViewProps = {
  matches: BracketMatch[];
  bracketSize: BracketSize;
  isDoubleElimination?: boolean;
  compact?: boolean;
};

export default function BracketView({
  matches,
  bracketSize,
  isDoubleElimination = false,
  compact = false,
}: BracketViewProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const totalRounds = getBracketRounds(bracketSize);

  // Group matches by round
  const winnersMatches = matches.filter((m) => !m.is_losers_bracket);
  const losersMatches = matches.filter((m) => m.is_losers_bracket);

  const roundGroups: BracketMatch[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    roundGroups.push(
      winnersMatches
        .filter((m) => m.round === r)
        .sort((a, b) => a.position - b.position),
    );
  }

  const columnWidth = compact ? 140 : 160;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.bracketContainer}>
        {/* Winners bracket */}
        {isDoubleElimination && (
          <Text style={[styles.bracketLabel, { color: c.gold }]}>WINNERS BRACKET</Text>
        )}

        <View style={styles.roundsRow}>
          {roundGroups.map((roundMatches, roundIdx) => {
            const round = roundIdx + 1;
            const isChampionshipRound = round === totalRounds;
            const label = getBracketRoundLabel(round, totalRounds);

            return (
              <View key={round} style={[styles.roundColumn, { width: columnWidth }]}>
                <Text style={[styles.roundLabel, { color: c.textMuted }]}>{label}</Text>
                <View style={styles.matchesColumn}>
                  {roundMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isChampionship={isChampionshipRound}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        {/* Losers bracket (double elimination) */}
        {isDoubleElimination && losersMatches.length > 0 && (
          <>
            <View style={[styles.bracketDivider, { backgroundColor: c.border }]} />
            <Text style={[styles.bracketLabel, { color: c.textMuted }]}>LOSERS BRACKET</Text>
            <View style={styles.roundsRow}>
              {Array.from(new Set(losersMatches.map((m) => m.round)))
                .sort((a, b) => a - b)
                .map((round) => {
                  const matches = losersMatches
                    .filter((m) => m.round === round)
                    .sort((a, b) => a.position - b.position);
                  return (
                    <View key={`losers_${round}`} style={[styles.roundColumn, { width: columnWidth }]}>
                      <Text style={[styles.roundLabel, { color: c.textMuted }]}>
                        Losers R{round}
                      </Text>
                      <View style={styles.matchesColumn}>
                        {matches.map((match) => (
                          <MatchCard key={match.id} match={match} isChampionship={false} />
                        ))}
                      </View>
                    </View>
                  );
                })}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Mini Bracket Preview (for wizard) ───────────────────────────────

export function BracketPreview({ size }: { size: BracketSize }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const totalRounds = getBracketRounds(size);

  return (
    <View style={styles.previewContainer}>
      {Array.from({ length: totalRounds }, (_, roundIdx) => {
        const matchCount = size / Math.pow(2, roundIdx + 1);
        const isChampionship = roundIdx === totalRounds - 1;
        const label = getBracketRoundLabel(roundIdx + 1, totalRounds);

        return (
          <View key={roundIdx} style={styles.previewRound}>
            <Text style={[styles.previewRoundLabel, { color: c.textMuted }]}>
              {label}
            </Text>
            {Array.from({ length: matchCount }, (_, matchIdx) => (
              <View
                key={matchIdx}
                style={[
                  styles.previewMatch,
                  {
                    backgroundColor: theme.isDark ? c.elevated : c.cardBg,
                    borderColor: isChampionship ? c.gold : c.border,
                    borderWidth: isChampionship ? 1.5 : 1,
                  },
                ]}
              >
                <View style={[styles.previewSlot, { borderBottomColor: c.border }]}>
                  <Text style={[styles.previewSlotText, { color: c.textMuted }]}>
                    {isChampionship ? 'W SF1' : `Seed ${matchIdx * 2 + 1}`}
                  </Text>
                </View>
                <View style={styles.previewSlot}>
                  <Text style={[styles.previewSlotText, { color: c.textMuted }]}>
                    {isChampionship ? 'W SF2' : `Seed ${matchIdx * 2 + 2}`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Full bracket
  bracketContainer: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  bracketLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: SANS,
    marginBottom: 12,
    marginLeft: 4,
  },
  roundsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  roundColumn: {
    marginRight: 8,
  },
  roundLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: SANS,
  },
  matchesColumn: {
    justifyContent: 'space-around',
    flex: 1,
    gap: 8,
  },
  matchCard: {
    overflow: 'hidden',
  },
  champLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  champLabelText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#000',
    fontFamily: SANS,
  },
  matchPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  seed: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: GEO,
    width: 14,
    textAlign: 'center',
  },
  playerName: {
    fontSize: 12,
    flex: 1,
    fontFamily: SANS,
  },
  score: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: SANS,
  },
  bracketDivider: {
    height: 1,
    marginVertical: 16,
  },

  // Mini preview
  previewContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  previewRound: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  previewRoundLabel: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: SANS,
    textAlign: 'center',
  },
  previewMatch: {
    width: '100%',
    overflow: 'hidden',
  },
  previewSlot: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewSlotText: {
    fontSize: 8,
    fontFamily: SANS,
  },
});
