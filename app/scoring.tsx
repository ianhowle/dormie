import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  StatusBar,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
const DormieMoment = lazy(() => import('../src/components/DormieMoment').then(m => ({ default: m.DormieMoment })));
import { SideGameToast } from '../src/components/SideGameToast';
import { HoleTransitionBanner } from '../src/components/HoleTransitionBanner';
import { Confetti } from '../src/components/Confetti';
import { PersonalBestBanner } from '../src/components/PersonalBestBanner';
import type { SideGameEvent } from '../src/components/SideGameToast';
import type { PlayerHoleResult } from '../src/components/HoleTransitionBanner';
import type { MomentType } from '../src/components/DormieMoment';
import { useAuth } from '../src/lib/auth';
import { haptics } from '../src/lib/haptics';
import { sounds } from '../src/lib/sounds';
import { queueOfflineAction } from '../src/lib/offline';
import { scoreCellLabel } from '../src/lib/accessibility';
import { useToast } from '../src/components/Toast';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { useNetworkStatus } from '../src/lib/networkStatus';
import {
  saveActiveRound,
  clearActiveRound,
  serializeScores,
  queueOfflineRound,
  type ActiveRoundState,
} from '../src/lib/roundStorage';
import { roundsService } from '../src/services/rounds.service';
import { coursesService } from '../src/services/courses.service';
import { seasonsService } from '../src/services/seasons.service';
import { scoreColor, formatToPar as fmtToPar, toParColor as toParColorUtil, scoreName as scoreNameUtil } from '../src/lib/scoring-utils';
import { MOCK_GROUP_PLAYERS } from '../src/data/leaderboard';
import { MOCK_UPCOMING_TRIPS } from '../src/data/trips';

// ─── Extracted scoring logic ─────────────────────────────────────────
import type {
  LinkedSeason, CompetitionTab, PlayerConfig, HoleScore, HoleData,
  HammerState, HammerResult, WolfHoleState, BBBHolePoints,
  ScoringEvent,
} from '../src/scoring/types';
import {
  buildHoles, calcCourseHandicap, isGIR, SIDE_GAME_DISPLAY, pName,
} from '../src/scoring/calculations';
import { checkDormieMoments as checkDormieMomentsUtil } from '../src/scoring/moments';
import { generateScoringEvents as genScoringEventsUtil, detectToastEvents as detectToastEventsUtil } from '../src/scoring/sideGames';

// ─── Extracted components ────────────────────────────────────────────
import { HoleHeader } from '../src/components/scoring/HoleHeader';
import { PlayerScoreInput } from '../src/components/scoring/ScoreGrid';
import { PlayerTabs } from '../src/components/scoring/PlayerTabs';
import { HoleNavigator, NavButtons } from '../src/components/scoring/HoleNavigator';
import {
  SideGameTicker,
  RunningSkinsPanel, RunningDotsPanel, RunningNassauPanel,
  RunningSnakePanel, RunningWolfPanel, RunningBBBPanel,
} from '../src/components/scoring/SideGameTicker';
import { WolfModal } from '../src/components/scoring/WolfModal';
import { BBBPrompt } from '../src/components/scoring/BBBPrompt';
import { LogHoleTags } from '../src/components/scoring/LogHoleTags';
import { RoundContextBanner } from '../src/components/scoring/RoundContextBanner';
const PostRoundSummary = lazy(() => import('../src/components/scoring/PostRoundSummary'));
import { scoringStyles as st, postRoundStyles as ps } from '../src/components/scoring/styles';

// ─── Helpers (kept inline as they're small) ──────────────────────────
const scoreName = scoreNameUtil;
const formatToPar = fmtToPar;

function scoreNameColor(
  score: number,
  par: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  const diff = score - par;
  if (diff <= -2) return c.gold;
  if (diff === -1) return c.teal;
  if (diff === 0) return c.text;
  if (diff === 1) return c.urgent;
  return '#C41E3A';
}

function toParColor(
  diff: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  if (diff < 0) return c.teal;
  if (diff === 0) return c.gold;
  return c.urgent;
}

// ─── Hole result banner (small, kept inline) ─────────────────────────
function HoleResultBanner({
  players,
  holeScores,
  holePar,
}: {
  players: PlayerConfig[];
  holeScores: Map<string, HoleScore>;
  holePar: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (holeScores.size < players.length) return null;

  let bestScore = Infinity;
  let winners: string[] = [];
  holeScores.forEach((s, pid) => {
    if (s.gross < bestScore) {
      bestScore = s.gross;
      winners = [pid];
    } else if (s.gross === bestScore) {
      winners.push(pid);
    }
  });

  const isTie = winners.length > 1;
  const winnerName = isTie
    ? 'Halved'
    : (players.find((p) => p.id === winners[0])?.id === '1'
        ? 'You won'
        : `${players.find((p) => p.id === winners[0])?.name?.split(' ')[0] ?? 'Player'} wins`);

  const diff = bestScore - holePar;
  const scoreLabel = isTie ? '' : ` with ${scoreName(bestScore, holePar).toLowerCase()}`;

  return (
    <View style={[st.resultBanner, { backgroundColor: `${c.teal}12`, borderColor: c.teal }]}>
      <Ionicons
        name={isTie ? 'swap-horizontal' : 'trophy'}
        size={16}
        color={c.teal}
      />
      <Text style={[st.resultText, { color: c.teal }]}>
        {winnerName}{scoreLabel}
      </Text>
    </View>
  );
}
// ─── Main screen ──────────────────────────────────────────────────────
function ScoringScreenInner() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    courseName: string;
    coursePar: string;
    courseSlope: string;
    courseRating: string;
    courseTee: string;
    players: string;
    format: string;
    holeRange: string;
    scoreMode: string;
    sideGames: string;
    courseId: string;
    roundType: string;
    holeData: string;
    // Feature 24: Season params
    seasonName: string;
    seasonWeek: string;
    seasonFormat: string;
    seasonMultiplier: string;
    // Multi-competition params
    linkedSeasons: string;
    tripId: string;
    matchupOpponent: string;
  }>();

  const courseName = params.courseName ?? 'Course';
  const coursePar = Number(params.coursePar) || 72;
  const courseSlope = Number(params.courseSlope) || 113;
  const courseRating = Number(params.courseRating) || 72;
  const courseTee = params.courseTee ?? '';
  const courseId = params.courseId ?? '';
  const holeRange = params.holeRange ?? 'full18';
  const scoreMode = params.scoreMode ?? 'gross';
  const formatLabel = params.format ?? 'Total Strokes';
  const sideGameKeys: string[] = useMemo(() => {
    try { return JSON.parse(params.sideGames ?? '[]'); } catch { return []; }
  }, [params.sideGames]);

  // Parse per-hole data from score setup screen
  const passedHoleData: HoleData[] | null = useMemo(() => {
    if (!params.holeData) return null;
    try {
      const parsed = JSON.parse(params.holeData);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return null;
  }, [params.holeData]);

  // Item 35: Round type
  const roundType = params.roundType ?? 'Casual';

  // Feature 24 / Item 36: Season params (with mock data fallback)
  const seasonName = params.seasonName || 'Spring Championship';
  const seasonWeek = params.seasonWeek || '7';
  const seasonFormat = params.seasonFormat || 'Stableford';
  const seasonMultiplier = Number(params.seasonMultiplier) || 2;

  // Parse multi-competition params
  const linkedSeasons: LinkedSeason[] = useMemo(() => {
    if (!params.linkedSeasons) return [];
    try { return JSON.parse(params.linkedSeasons); } catch { return []; }
  }, [params.linkedSeasons]);

  const tripId = params.tripId ?? null;
  const matchupOpponent = params.matchupOpponent ?? null;
  const linkedTrip = tripId ? MOCK_UPCOMING_TRIPS.find((t) => t.id === tripId) : null;

  // Build competition tabs for scoreboard overlay
  const competitionTabs: CompetitionTab[] = useMemo(() => {
    const tabs: CompetitionTab[] = [];
    linkedSeasons.forEach((s) => {
      tabs.push({ key: `season-${s.seasonId}`, label: s.seasonName.length > 16 ? s.seasonName.slice(0, 14) + '…' : s.seasonName, type: 'season', data: s });
    });
    if (linkedTrip) tabs.push({ key: 'trip', label: linkedTrip.name, type: 'trip' });
    if (matchupOpponent) tabs.push({ key: 'matchup', label: 'Matchup', type: 'matchup' });
    tabs.push({ key: 'round', label: 'Round', type: 'round' });
    return tabs;
  }, [linkedSeasons, linkedTrip, matchupOpponent]);

  const players: PlayerConfig[] = useMemo(() => {
    try {
      return JSON.parse(params.players ?? '[]');
    } catch {
      return [{ id: '1', name: 'Ian McGowan', handicap: 8 }];
    }
  }, [params.players]);

  const holes = useMemo(() => {
    // Use per-hole data from score setup if available (has real pars, yardages, stroke indices)
    if (passedHoleData && passedHoleData.length > 0) {
      let hd = passedHoleData.map((h, i) => ({
        number: h.number ?? i + 1,
        par: h.par ?? 4,
        strokeIndex: h.strokeIndex ?? i + 1,
        yards: h.yards,
      }));
      if (holeRange === 'front9') hd = hd.filter((h) => h.number <= 9);
      else if (holeRange === 'back9') hd = hd.filter((h) => h.number > 9);
      return hd;
    }
    return buildHoles(coursePar, holeRange);
  }, [passedHoleData, coursePar, holeRange]);

  // Handicap strokes per player per hole
  const handicapStrokes = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    players.forEach((p) => {
      const courseHcp = calcCourseHandicap(p.handicap, courseSlope, courseRating, coursePar);
      const holeMap = new Map<number, number>();
      holes.forEach((h) => {
        // Allocate strokes: if courseHcp >= strokeIndex, get 1 stroke
        // If courseHcp >= 18 + strokeIndex, get 2 strokes
        let strokes = 0;
        if (courseHcp >= h.strokeIndex) strokes++;
        if (courseHcp >= 18 + h.strokeIndex) strokes++;
        holeMap.set(h.number, strokes);
      });
      map.set(p.id, holeMap);
    });
    return map;
  }, [players, holes, courseSlope, courseRating, coursePar]);

  // State
  const [currentHoleIdx, setCurrentHoleIdx] = useState(0);
  const [allScores, setAllScores] = useState<Map<number, Map<string, HoleScore>>>(new Map());
  const [showSummary, setShowSummary] = useState(false);

  // Feature 1: Hammer game
  const [hammerState, setHammerState] = useState<HammerState>({
    active: false, thrower: '', target: '', multiplier: 2, pending: false,
  });
  const [showHammerModal, setShowHammerModal] = useState(false);
  const [hammerResults, setHammerResults] = useState<Map<number, HammerResult>>(new Map());

  // Feature 3: Putt distance prompt
  const [puttDistPrompt, setPuttDistPrompt] = useState<{ show: boolean; playerIdx: number; holeNumber: number }>({ show: false, playerIdx: 0, holeNumber: 1 });
  const [puttDist, setPuttDist] = useState<Map<number, Map<string, string>>>(new Map());

  // Feature 4: Best Ball 2v2
  const isBestBall = formatLabel.toLowerCase().includes('best ball') && players.length === 4;
  const [bestBallTeams, setBestBallTeams] = useState<{ team1: string[]; team2: string[] }>({
    team1: players.length >= 4 ? [players[0].id, players[1].id] : [],
    team2: players.length >= 4 ? [players[2].id, players[3].id] : [],
  });
  const [showBestBallSetup, setShowBestBallSetup] = useState(isBestBall);

  // Feature 6: Hole notes
  const [holeNotes, setHoleNotes] = useState<Map<number, string>>(new Map());
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Feature 10: Scorecard confirmation
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Feature 11: Pinned floating scoreboard
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activeCompTab, setActiveCompTab] = useState('round');

  // Feature 12: Live feed
  const [scoringEvents, setScoringEvents] = useState<ScoringEvent[]>([]);
  const [showFeed, setShowFeed] = useState(false);
  const [lastReadEventCount, setLastReadEventCount] = useState(0);

  // Feature 13: Side game running panel
  const [showRunningPanel, setShowRunningPanel] = useState(false);

  // Feature 14: Scoring view mode toggle
  const [viewMode, setViewMode] = useState<'solo' | 'all'>('all');
  const [soloPlayerIdx, setSoloPlayerIdx] = useState(0);

  // Item 8: Side game ticker collapsed state
  const [sideGameTickerExpanded, setSideGameTickerExpanded] = useState(false);

  // Item 31: Dormie Moment state
  const [dormieMoment, setDormieMoment] = useState<{
    visible: boolean;
    type: MomentType;
    playerName: string;
    detail: string;
  }>({ visible: false, type: 'DORMIE', playerName: '', detail: '' });

  // Elite polish: confetti, personal best, toast
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPersonalBest, setShowPersonalBest] = useState(false);
  const [prevBest, setPrevBest] = useState<number | null>(null);
  const { showToast } = useToast();

  // Item 32: Side game toast events
  const [sideGameToastEvents, setSideGameToastEvents] = useState<SideGameEvent[]>([]);

  // Wolf state
  const wolfOrder = useMemo(() => players.map((p) => p.id), [players]);
  const [wolfHoleDecisions, setWolfHoleDecisions] = useState<Map<number, WolfHoleState>>(new Map());
  const [showWolfModal, setShowWolfModal] = useState(false);
  const [wolfPickStep, setWolfPickStep] = useState<'choose' | 'partner'>('choose');

  // BBB state
  const [bbbHolePoints, setBBBHolePoints] = useState<Map<number, BBBHolePoints>>(new Map());
  const [showBangoPrompt, setShowBangoPrompt] = useState(false);
  const [bangoHoleNumber, setBangoHoleNumber] = useState(0);

  // Item 33: Hole transition banner
  const [transitionBanner, setTransitionBanner] = useState<{
    visible: boolean;
    holeNumber: number;
    par: number;
    results: PlayerHoleResult[];
  }>({ visible: false, holeNumber: 1, par: 4, results: [] });

  const currentHole = holes[currentHoleIdx];

  // ─── Offline resilience ─────────────────────────────────────────────
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOffline = !isConnected || !isInternetReachable;

  // Auto-save round state to AsyncStorage after every hole change
  useEffect(() => {
    if (allScores.size === 0) return; // Don't save empty rounds
    const state: ActiveRoundState = {
      courseName,
      courseId,
      coursePar,
      courseSlope,
      courseRating,
      courseTee,
      players,
      formatLabel,
      scoreMode,
      holeRange,
      allScores: serializeScores(allScores),
      currentHoleIdx,
      totalHoles: holes.length,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tripId: tripId ?? undefined,
      linkedSeasons: linkedSeasons.length > 0 ? linkedSeasons : undefined,
      sideGames: sideGameKeys.length > 0 ? sideGameKeys : undefined,
      holeData: passedHoleData ?? undefined,
      roundType,
    };
    saveActiveRound(state);
  }, [allScores, currentHoleIdx]);

  // Get or create scores for current hole
  const currentHoleScores = useMemo(() => {
    return allScores.get(currentHole.number) ?? new Map<string, HoleScore>();
  }, [allScores, currentHole.number]);

  const getPlayerScore = useCallback(
    (playerId: string): HoleScore => {
      return (
        currentHoleScores.get(playerId) ?? {
          gross: currentHole.par,
          putts: 2,
          fir: currentHole.par >= 4 ? null : null,
        }
      );
    },
    [currentHoleScores, currentHole.par],
  );

  const updatePlayerScore = useCallback(
    (playerId: string, score: HoleScore) => {
      setAllScores((prev) => {
        const next = new Map(prev);
        const holeMap = new Map(next.get(currentHole.number) ?? new Map());
        holeMap.set(playerId, score);
        next.set(currentHole.number, holeMap);
        return next;
      });
    },
    [currentHole.number],
  );

  // Running totals
  const getRunningTotal = useCallback(
    (playerId: string) => {
      let total = 0;
      let par = 0;
      let count = 0;
      holes.forEach((h) => {
        const s = allScores.get(h.number)?.get(playerId);
        if (s) {
          total += s.gross;
          par += h.par;
          count++;
        }
      });
      return { total, par, count };
    },
    [allScores, holes],
  );

  // Wolf: current wolf for this hole
  const currentWolfIdx = useMemo(() => {
    if (!sideGameKeys.includes('wolf') || players.length < 3) return -1;
    return (currentHoleIdx % wolfOrder.length);
  }, [currentHoleIdx, wolfOrder, players.length, sideGameKeys]);

  const currentWolfId = currentWolfIdx >= 0 ? wolfOrder[currentWolfIdx] : null;
  const currentWolfDecision = wolfHoleDecisions.get(currentHole.number) ?? null;

  // Show wolf modal automatically when entering a new hole with wolf active
  const prevHoleRef = useRef(currentHole.number);
  useEffect(() => {
    if (prevHoleRef.current !== currentHole.number) {
      prevHoleRef.current = currentHole.number;
      if (sideGameKeys.includes('wolf') && currentWolfId && !wolfHoleDecisions.has(currentHole.number)) {
        setWolfPickStep('choose');
        setShowWolfModal(true);
      }
    }
  }, [currentHole.number, sideGameKeys, currentWolfId, wolfHoleDecisions]);

  // Show wolf modal on mount for hole 1
  const wolfInitRef = useRef(false);
  useEffect(() => {
    if (!wolfInitRef.current && sideGameKeys.includes('wolf') && currentWolfId && !wolfHoleDecisions.has(currentHole.number)) {
      wolfInitRef.current = true;
      setWolfPickStep('choose');
      setShowWolfModal(true);
    }
  }, [sideGameKeys, currentWolfId, currentHole.number, wolfHoleDecisions]);

  // Count scored holes
  const holesScored = useMemo(() => {
    let count = 0;
    holes.forEach((h) => {
      const holeMap = allScores.get(h.number);
      if (holeMap && holeMap.size >= players.length) count++;
    });
    return count;
  }, [allScores, holes, players.length]);

  const isLastHole = currentHoleIdx === holes.length - 1;

  // Feature 12: Generate scoring events when scores are entered
  const generateEvents = useCallback((holeNumber: number) => {
    const newEvents = genScoringEventsUtil(holeNumber, allScores, holes, players);
    if (newEvents.length > 0) {
      setScoringEvents((prev) => [...newEvents, ...prev]);
    }
  }, [allScores, holes, players]);

  // Item 31: Check dormie moment conditions
  const checkDormieMoments = useCallback((holeNumber: number) => {
    const result = checkDormieMomentsUtil(holeNumber, allScores, players, holes, sideGameKeys);
    if (result) {
      setDormieMoment({
        visible: true,
        type: result.type,
        playerName: result.playerName,
        detail: result.detail,
      });
    }
  }, [allScores, holes, players, sideGameKeys]);

  // Item 32: Detect side game toast events
  const detectToastEventsLocal = useCallback((holeNumber: number) => {
    const newEvents = detectToastEventsUtil(holeNumber, allScores, holes, players, sideGameKeys);
    if (newEvents.length > 0) {
      setSideGameToastEvents((prev) => [...prev, ...newEvents]);
    }
  }, [allScores, holes, players, sideGameKeys]);

  // Item 33: Build transition banner data
  const showTransitionBanner = useCallback((holeNumber: number) => {
    const holeData = holes.find((h) => h.number === holeNumber);
    if (!holeData) return;
    const holeScores = allScores.get(holeNumber);
    if (!holeScores) return;

    const results: PlayerHoleResult[] = [];
    players.forEach((p) => {
      const s = holeScores.get(p.id);
      if (!s) return;
      results.push({
        name: p.id === '1' ? 'You' : p.name.split(' ')[0],
        avatarColor: p.id === '1' ? '#006747' : '#C9A227',
        gross: s.gross,
        putts: s.putts,
        fir: s.fir,
        gir: isGIR(s.gross, s.putts, holeData.par),
      });
    });

    setTransitionBanner({
      visible: true,
      holeNumber: holeData.number,
      par: holeData.par,
      results,
    });
  }, [allScores, holes, players]);

  const handleNext = useCallback(() => {
    // Auto-save current hole scores if not yet saved
    players.forEach((p) => {
      if (!currentHoleScores.has(p.id)) {
        updatePlayerScore(p.id, getPlayerScore(p.id));
      }
    });

    // Haptic feedback on hole score submission
    haptics.medium();
    sounds.click();
    showToast({ message: 'Score submitted', type: 'success' });

    // Feature 12: Generate events
    generateEvents(currentHole.number);

    // Item 31: Check dormie moments
    checkDormieMoments(currentHole.number);

    // Item 32: Detect side game toasts
    detectToastEventsLocal(currentHole.number);

    // BBB auto-detection: bingo (first GIR) and bongo (first to score)
    if (sideGameKeys.includes('bingo_bango_bongo')) {
      const holeScores = allScores.get(currentHole.number);
      if (holeScores) {
        const existing = bbbHolePoints.get(currentHole.number) ?? { bingo: null, bango: null, bongo: null };
        let bingo = existing.bingo;
        let bongo = existing.bongo;

        // BINGO: first player with GIR
        if (!bingo) {
          players.forEach((p) => {
            if (bingo) return;
            const s = holeScores.get(p.id);
            if (s && isGIR(s.gross, s.putts, currentHole.par)) {
              bingo = p.id;
            }
          });
        }

        // BONGO: first player to have score entered (lowest gross as proxy for first to hole out)
        if (!bongo) {
          let bestGross = Infinity;
          let bongoId: string | null = null;
          holeScores.forEach((s, pid) => {
            if (s.gross < bestGross) { bestGross = s.gross; bongoId = pid; }
          });
          bongo = bongoId;
        }

        setBBBHolePoints((prev) => {
          const next = new Map(prev);
          next.set(currentHole.number, { bingo, bango: existing.bango, bongo });
          return next;
        });

        // Trigger bango prompt for "closest to pin"
        setBangoHoleNumber(currentHole.number);
        setShowBangoPrompt(true);
      }
    }

    // Wolf: check for Lone/Blind Wolf victory moments
    if (sideGameKeys.includes('wolf')) {
      const decision = wolfHoleDecisions.get(currentHole.number);
      const holeScores = allScores.get(currentHole.number);
      if (decision && holeScores && (decision.decision === 'lone' || decision.decision === 'blind')) {
        const wolfScore = holeScores.get(decision.wolfPlayerId);
        if (wolfScore) {
          const others: number[] = [];
          players.forEach((p) => {
            if (p.id !== decision.wolfPlayerId) {
              const s = holeScores.get(p.id);
              if (s) others.push(s.gross);
            }
          });
          const wolfWins = wolfScore.gross < Math.min(...others);
          if (wolfWins) {
            const wolfPlayer = players.find((p) => p.id === decision.wolfPlayerId);
            const wolfName = wolfPlayer ? (wolfPlayer.id === '1' ? 'You' : wolfPlayer.name) : 'Wolf';
            haptics.heavy();
            sounds.chime();
            setDormieMoment({
              visible: true,
              type: decision.decision === 'blind' ? 'BLIND_WOLF_WIN' : 'LONE_WOLF_VICTORY',
              playerName: wolfName,
              detail: decision.decision === 'blind'
                ? `Blind Wolf wins Hole ${currentHole.number}!`
                : `Lone Wolf wins Hole ${currentHole.number}!`,
            });
          }
        }
      }
    }

    // Item 33: Show hole transition banner
    showTransitionBanner(currentHole.number);

    // Feature 3: Check if putt distance prompt needed
    const playersWithPutts = players.filter((p) => {
      const s = getPlayerScore(p.id);
      return s.putts > 0;
    });

    if (playersWithPutts.length > 0 && currentHoleIdx < holes.length - 1) {
      setPuttDistPrompt({ show: true, playerIdx: 0, holeNumber: currentHole.number });
    } else if (currentHoleIdx < holes.length - 1) {
      setCurrentHoleIdx(currentHoleIdx + 1);
    }
  }, [players, currentHoleScores, updatePlayerScore, getPlayerScore, generateEvents, checkDormieMoments, detectToastEventsLocal, sideGameKeys, currentHole, allScores, bbbHolePoints, wolfHoleDecisions, showTransitionBanner, currentHoleIdx, holes.length]);

  const handlePuttDistSelect = useCallback((bucket: string) => {
    const playersWithPutts = players.filter((p) => {
      const s = getPlayerScore(p.id);
      return s.putts > 0;
    });
    const currentPlayer = playersWithPutts[puttDistPrompt.playerIdx];
    if (currentPlayer) {
      setPuttDist((prev) => {
        const next = new Map(prev);
        const holeMap = new Map(next.get(puttDistPrompt.holeNumber) ?? new Map());
        holeMap.set(currentPlayer.id, bucket);
        next.set(puttDistPrompt.holeNumber, holeMap);
        return next;
      });
    }
    // Move to next player or close
    if (puttDistPrompt.playerIdx < playersWithPutts.length - 1) {
      setPuttDistPrompt((prev) => ({ ...prev, playerIdx: prev.playerIdx + 1 }));
    } else {
      setPuttDistPrompt({ show: false, playerIdx: 0, holeNumber: 1 });
      if (currentHoleIdx < holes.length - 1) {
        setCurrentHoleIdx(currentHoleIdx + 1);
      }
    }
  }, [players, getPlayerScore, puttDistPrompt.playerIdx, puttDistPrompt.holeNumber, currentHoleIdx, holes.length]);

  const handlePrev = useCallback(() => {
    if (currentHoleIdx > 0) {
      setCurrentHoleIdx(currentHoleIdx - 1);
    }
  }, [currentHoleIdx]);

  const handleFinish = useCallback(() => {
    // Save current hole
    players.forEach((p) => {
      if (!currentHoleScores.has(p.id)) {
        updatePlayerScore(p.id, getPlayerScore(p.id));
      }
    });
    generateEvents(currentHole.number);
    // Feature 10: Show confirmation first
    setShowConfirmation(true);
  }, [players, currentHoleScores, updatePlayerScore, getPlayerScore, generateEvents, currentHole.number]);

  // Feature 4: Best Ball team scores
  const bestBallTeamScores = useMemo(() => {
    if (!isBestBall) return { team1: 0, team2: 0, team1Par: 0, team2Par: 0 };
    let t1 = 0, t2 = 0, par1 = 0, par2 = 0;
    holes.forEach((h) => {
      const holeScores = allScores.get(h.number);
      if (!holeScores) return;
      let best1 = Infinity, best2 = Infinity;
      bestBallTeams.team1.forEach((pid) => {
        const s = holeScores.get(pid);
        if (s && s.gross < best1) best1 = s.gross;
      });
      bestBallTeams.team2.forEach((pid) => {
        const s = holeScores.get(pid);
        if (s && s.gross < best2) best2 = s.gross;
      });
      if (best1 < Infinity) { t1 += best1; par1 += h.par; }
      if (best2 < Infinity) { t2 += best2; par2 += h.par; }
    });
    return { team1: t1, team2: t2, team1Par: par1, team2Par: par2 };
  }, [allScores, holes, bestBallTeams, isBestBall]);

  // Feature 11: Leaderboard data
  const leaderboardData = useMemo(() => {
    return players.map((p) => {
      const running = getRunningTotal(p.id);
      return { player: p, total: running.total, par: running.par, count: running.count };
    }).sort((a, b) => {
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return (a.total - a.par) - (b.total - b.par);
    });
  }, [players, getRunningTotal]);

  // Feature 10: Scorecard Confirmation
  if (showConfirmation) {
    const totalPar = holes.reduce((a, h) => a + h.par, 0);
    const front = holes.filter((h) => h.number <= 9);
    const back = holes.filter((h) => h.number > 9);

    return (
      <View style={[st.screen, { backgroundColor: c.bg }]}>
        <LinearGradient colors={[...greenHeaderGradient]} style={st.confirmHeader}>
          <View style={st.headerOverlay} />
          <Text style={[st.confirmTitle, { fontFamily: GEO }]}>CONFIRM SCORECARD</Text>
          <Text style={st.confirmSub}>Review all scores before saving</Text>
        </LinearGradient>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Header row */}
              <View style={[ps.scRow, { backgroundColor: '#1E4D2B' }]}>
                <Text style={[ps.scCellHole, ps.scHeaderText]}>HOLE</Text>
                {holes.map((h) => (
                  <Text key={h.number} style={[ps.scCell, ps.scHeaderText]}>{h.number}</Text>
                ))}
                <Text style={[ps.scCellTotal, ps.scHeaderText]}>TOT</Text>
              </View>
              {/* Par row */}
              <View style={[ps.scRow, { backgroundColor: c.elevated }]}>
                <Text style={[ps.scCellHole, ps.scParText, { color: c.textMuted }]}>Par</Text>
                {holes.map((h) => (
                  <Text key={h.number} style={[ps.scCell, ps.scParText, { color: c.textMuted }]}>{h.par}</Text>
                ))}
                <Text style={[ps.scCellTotal, ps.scParText, { color: c.textMuted }]}>{totalPar}</Text>
              </View>
              {/* Player rows */}
              {players.map((p, pi) => {
                const isMe = p.id === '1';
                let totalGross = 0;
                return (
                  <View key={p.id} style={[ps.scRow, { backgroundColor: isMe ? `${c.teal}08` : pi % 2 === 0 ? c.cardBg : c.surface }]}>
                    <Text style={[ps.scCellHole, ps.scPlayerLabel, { color: isMe ? c.teal : c.text }]} numberOfLines={1}>
                      {isMe ? 'You' : p.name.split(' ')[0]}
                    </Text>
                    {holes.map((h) => {
                      const s = allScores.get(h.number)?.get(p.id);
                      if (!s) return <Text key={h.number} style={[ps.scCell, { color: c.textMuted }]}>-</Text>;
                      totalGross += s.gross;
                      return (
                        <Pressable
                          key={h.number}
                          onPress={() => {
                            setShowConfirmation(false);
                            setCurrentHoleIdx(holes.findIndex((hole) => hole.number === h.number));
                          }}
                        >
                          <Text style={[
                            ps.scCell,
                            { color: scoreNameColor(s.gross, h.par, c), fontFamily: GEO },
                          ]}>
                            {s.gross}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Text style={[ps.scCellTotal, ps.scTotalText, { color: c.text, fontFamily: GEO }]}>
                      {totalGross || '-'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Front/Back totals */}
          {front.length > 0 && back.length > 0 && (
            <View style={[st.confirmTotalsRow, { borderColor: c.border }]}>
              {players.map((p) => {
                const isMe = p.id === '1';
                let frontTotal = 0, backTotal = 0, grandTotal = 0;
                front.forEach((h) => { const s = allScores.get(h.number)?.get(p.id); if (s) frontTotal += s.gross; });
                back.forEach((h) => { const s = allScores.get(h.number)?.get(p.id); if (s) backTotal += s.gross; });
                grandTotal = frontTotal + backTotal;
                return (
                  <View key={p.id} style={[st.confirmPlayerTotals, { borderColor: c.border }]}>
                    <Text style={[st.confirmPlayerName, { color: isMe ? c.teal : c.text }]}>
                      {isMe ? 'You' : p.name.split(' ')[0]}
                    </Text>
                    <View style={st.confirmNineTotals}>
                      <View style={st.confirmNineItem}>
                        <Text style={[st.confirmNineLabel, { color: c.textMuted }]}>OUT</Text>
                        <Text style={[st.confirmNineValue, { color: c.text, fontFamily: GEO }]}>{frontTotal || '-'}</Text>
                      </View>
                      <View style={st.confirmNineItem}>
                        <Text style={[st.confirmNineLabel, { color: c.textMuted }]}>IN</Text>
                        <Text style={[st.confirmNineValue, { color: c.text, fontFamily: GEO }]}>{backTotal || '-'}</Text>
                      </View>
                      <View style={st.confirmNineItem}>
                        <Text style={[st.confirmNineLabel, { color: c.gold }]}>TOT</Text>
                        <Text style={[st.confirmNineValue, { color: toParColor(grandTotal - totalPar, c), fontFamily: GEO, fontWeight: '700' }]}>
                          {grandTotal || '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <Pressable
              onPress={() => setShowConfirmation(false)}
              style={[st.navBtn, { backgroundColor: c.elevated, borderColor: c.border, flex: 1 }]}
            >
              <Ionicons name="chevron-back" size={18} color={c.text} />
              <Text style={[st.navBtnText, { color: c.text }]}>Edit Scores</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowConfirmation(false); setShowSummary(true); }}
              style={[st.navBtn, st.navFinish, { backgroundColor: '#1E4D2B', flex: 1 }]}
            >
              <Text style={[st.navBtnText, { color: '#C9A227', fontFamily: GEO }]}>Post Score</Text>
              <Ionicons name="checkmark-circle" size={18} color="#C9A227" />
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (showSummary) {
    return (
      <Suspense fallback={<View style={{ flex: 1, backgroundColor: c.bg }} />}>
      <PostRoundSummary
        players={players}
        holes={holes}
        allScores={allScores}
        scoreMode={scoreMode}
        handicapStrokes={handicapStrokes}
        courseName={courseName}
        formatLabel={formatLabel}
        sideGameKeys={sideGameKeys}
        wolfHoleDecisions={wolfHoleDecisions}
        bbbHolePoints={bbbHolePoints}
        onDone={async () => {
          if (!user) { router.dismissAll(); return; }
          try {
            // Build hole scores for the current user
            const holeScores: { hole: number; gross: number; putts?: number; fir?: boolean }[] = [];
            holes.forEach((h) => {
              const s = allScores.get(h.number)?.get(user.id);
              if (s) {
                holeScores.push({ hole: h.number, gross: s.gross, putts: s.putts, ...(s.fir !== null ? { fir: s.fir } : {}) });
              }
            });
            const grossTotal = holeScores.reduce((sum, h) => sum + h.gross, 0);
            const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
            // Compute net if applicable
            let netTotal: number | null = null;
            if (scoreMode === 'net') {
              const playerStrokes = handicapStrokes.get(user.id);
              if (playerStrokes) {
                netTotal = grossTotal - Array.from(playerStrokes.values()).reduce((a, b) => a + b, 0);
              }
            }
            // Ensure course exists
            let finalCourseId = courseId;
            if (!finalCourseId) {
              const course = await coursesService.ensureCourse({ name: courseName, location: courseName });
              finalCourseId = course.id;
            }
            const savedRound = await roundsService.create({
              user_id: user.id,
              course_id: finalCourseId,
              gross_score: grossTotal,
              net_score: netTotal,
              hole_scores: holeScores,
              source: 'app',
              played_at: new Date().toISOString(),
              ...(tripId ? { trip_id: tripId } : {}),
              ...(linkedSeasons.length > 0 ? { season_week_id: linkedSeasons[0].seasonId } : {}),
            });

            // Auto-submit season scores for linked seasons
            if (linkedSeasons.length > 0) {
              for (const ls of linkedSeasons) {
                try {
                  let points = grossTotal;
                  if (ls.format?.toLowerCase().includes('stableford') && holeScores.length > 0) {
                    const { calculateStablefordPoints } = await import('../src/data/scoring');
                    points = holeScores.reduce((sum, h) => {
                      const holePar = holes.find(hole => hole.number === h.hole)?.par ?? 4;
                      return sum + calculateStablefordPoints(h.gross, holePar, 0);
                    }, 0);
                  }
                  await seasonsService.submitScore({
                    season_week_id: ls.seasonId,
                    user_id: user.id,
                    points,
                    round_id: savedRound.id,
                  });
                } catch {}
              }
            }

            // Elite polish: haptic, toast, confetti on round save
            haptics.success();
            sounds.chime();
            showToast({ message: 'Round saved', type: 'success', icon: 'checkmark-circle' });
            setShowConfetti(true);

            // Personal best detection: check previous rounds at this course
            try {
              const previousRounds = await roundsService.fetchByCourse(finalCourseId, user.id);
              // Exclude the round we just saved (most recent one) by skipping the first match
              const sorted = [...previousRounds].sort((a, b) =>
                new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
              );
              const previousBest = sorted.slice(1) // skip the most recent (just saved)
                .reduce((best, r) => Math.min(best, r.gross_score), Infinity);
              if (previousBest !== Infinity && grossTotal < previousBest) {
                setPrevBest(previousBest);
                setShowPersonalBest(true);
              }
            } catch {
              // Personal best check is non-critical
            }

            // Clear active round from local storage on success
            await clearActiveRound();

            Alert.alert('Score Posted', `Your ${grossTotal} (${grossTotal - totalPar >= 0 ? '+' : ''}${grossTotal - totalPar}) is on the board.`);
            router.dismissAll();
          } catch (err) {
            // Offline: queue round locally for sync when back online
            const offlineRound = {
              id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
              userId: user.id,
              courseId,
              courseName,
              grossScore: holeScores.reduce((sum, h) => sum + h.gross, 0),
              netScore: netTotal,
              holeScores,
              source: 'app' as const,
              playedAt: new Date().toISOString(),
              queuedAt: new Date().toISOString(),
              tripId: tripId ?? undefined,
              seasonWeekId: linkedSeasons.length > 0 ? linkedSeasons[0].seasonId : undefined,
              linkedSeasons: linkedSeasons.length > 0 ? linkedSeasons : undefined,
            };
            await queueOfflineRound(offlineRound);
            await clearActiveRound();
            showToast({ message: 'Round saved locally. It will sync when you\u2019re back online.', type: 'info', icon: 'cloud-offline-outline' });
            router.dismissAll();
          }
        }}
      />
      </Suspense>
    );
  }

  // Feature 12: Unread feed count
  const unreadFeedCount = scoringEvents.length - lastReadEventCount;

  // Feature 14: Players to show based on view mode
  const visiblePlayers = viewMode === 'solo' ? [players[soloPlayerIdx]] : players;

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />

      {/* Offline banner */}
      {isOffline && (
        <View style={{ backgroundColor: '#C9A227', paddingVertical: 6, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Ionicons name="cloud-offline-outline" size={14} color="#141210" />
          <Text style={{ color: '#141210', fontSize: 13, fontWeight: '600' }}>
            Offline — your round is saved locally
          </Text>
        </View>
      )}

      <HoleHeader
        courseName={courseName}
        holeNumber={currentHole.number}
        holePar={currentHole.par}
        format={formatLabel}
        totalHoles={holes.length}
        holesScored={holesScored}
        onLeaderboard={() => setShowLeaderboard(true)}
        onFeed={() => { setShowFeed(!showFeed); setLastReadEventCount(scoringEvents.length); }}
        unreadFeedCount={unreadFeedCount > 0 ? unreadFeedCount : 0}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(viewMode === 'solo' ? 'all' : 'solo')}
        holeYardage={currentHole.yards}
        holeHcp={currentHole.strokeIndex}
        onPrevHole={() => { if (currentHoleIdx > 0) setCurrentHoleIdx(currentHoleIdx - 1); }}
        onNextHole={() => { if (currentHoleIdx < holes.length - 1) setCurrentHoleIdx(currentHoleIdx + 1); }}
        canPrevHole={currentHoleIdx > 0}
        canNextHole={currentHoleIdx < holes.length - 1}
        competitionCount={competitionTabs.length}
        roundType={roundType}
      />

      <HoleNavigator
        holes={holes}
        currentIdx={currentHoleIdx}
        scores={allScores}
        onSelect={setCurrentHoleIdx}
        holeNotes={holeNotes}
      />

      {/* Item 36: Season Round Link Banner — only show when seasons are linked */}
      {linkedSeasons.length > 0 && linkedSeasons.map((ls) => (
        <View key={ls.seasonId} style={st.seasonBanner}>
          <View style={st.seasonBannerContent}>
            <Text style={[st.seasonBannerName, { fontFamily: GEO }]}>
              {ls.seasonName} {'\u00B7'} Week {ls.weekNumber} {'\u00B7'} {ls.format} {'\u00B7'} {ls.multiplier}x
            </Text>
          </View>
        </View>
      ))}

      {/* Item 8: Collapsible Side Game Ticker */}
      {sideGameKeys.length > 0 && (
        <>
        <GoldDivider />
        <Pressable
          onPress={() => setSideGameTickerExpanded(!sideGameTickerExpanded)}
          style={[st.sideGameTicker, theme.isDark ? tickerShadowDark : tickerShadowLight]}
        >
          {!sideGameTickerExpanded ? (
            <View style={st.sideGameTickerCollapsed}>
              <Text style={st.sideGameTickerText}>
                {sideGameKeys.includes('dots') ? `Dots: ${(() => {
                  let d = 0;
                  holes.forEach((h) => {
                    const s = allScores.get(h.number)?.get('1');
                    if (s) {
                      const diff = s.gross - h.par;
                      if (diff <= -2) d += 2;
                      else if (diff === -1) d += 1;
                      else if (diff >= 2) d -= 1;
                    }
                  });
                  return d >= 0 ? `+${d}` : `${d}`;
                })()}` : ''}
                {sideGameKeys.includes('dots') && sideGameKeys.includes('skins') ? ' | ' : ''}
                {sideGameKeys.includes('skins') ? `Skins: ${(() => {
                  let wins = 0;
                  let carry = 0;
                  holes.forEach((h) => {
                    const hs = allScores.get(h.number);
                    if (!hs || hs.size < players.length) { carry++; return; }
                    let best = Infinity;
                    let w: string[] = [];
                    hs.forEach((s, pid) => { if (s.gross < best) { best = s.gross; w = [pid]; } else if (s.gross === best) w.push(pid); });
                    if (w.length === 1 && w[0] === '1') { wins += 1 + carry; carry = 0; }
                    else if (w.length === 1) carry = 0;
                    else carry++;
                  });
                  return wins;
                })()}` : ''}
                {(sideGameKeys.includes('dots') || sideGameKeys.includes('skins')) && sideGameKeys.includes('snake') ? ' | ' : ''}
                {sideGameKeys.includes('snake') ? `Snake: ${(() => {
                  let holder: string | null = null;
                  holes.forEach((h) => {
                    const hs = allScores.get(h.number);
                    if (!hs) return;
                    hs.forEach((s, pid) => { if (s.putts >= 3) holder = pid; });
                  });
                  if (!holder) return 'None';
                  const hp = players.find((p) => p.id === holder);
                  return hp ? (hp.id === '1' ? 'You' : hp.name.split(' ')[0]) : 'None';
                })()}` : ''}
                {sideGameKeys.length > 0 && !sideGameKeys.includes('dots') && !sideGameKeys.includes('skins') && !sideGameKeys.includes('snake')
                  ? sideGameKeys.map((k) => SIDE_GAME_DISPLAY[k] ?? k).join(' | ')
                  : ''}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
            </View>
          ) : (
            <View style={st.sideGameTickerExpanded}>
              <View style={st.sideGameTickerExpandedHeader}>
                <Text style={[st.sideGameTickerTitle, { fontFamily: GEO }]}>SIDE GAMES</Text>
                <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.6)" />
              </View>
              {sideGameKeys.map((key) => (
                <Text key={key} style={st.sideGameTickerLine}>
                  {SIDE_GAME_DISPLAY[key] ?? key}: Active
                </Text>
              ))}
            </View>
          )}
        </Pressable>
        <GoldDivider />
        </>
      )}

      {/* Wolf: Current Wolf Banner */}
      {sideGameKeys.includes('wolf') && currentWolfId && (
        <Pressable
          onPress={() => { setWolfPickStep('choose'); setShowWolfModal(true); }}
          style={[st.wolfBanner, { backgroundColor: c.elevated, borderColor: c.border }]}
        >
          <Ionicons name="paw" size={16} color={c.gold} />
          <Text style={[st.wolfBannerText, { color: c.text }]}>
            Wolf: {(() => {
              const wp = players.find((p) => p.id === currentWolfId);
              return wp ? (wp.id === '1' ? 'You' : wp.name.split(' ')[0]) : '';
            })()}
            {currentWolfDecision?.decision === 'lone' ? ' (Lone Wolf)' :
             currentWolfDecision?.decision === 'blind' ? ' (Blind Wolf)' :
             currentWolfDecision?.decision === 'partner' ? ` + ${(() => {
               const pp = players.find((p) => p.id === currentWolfDecision.partnerId);
               return pp ? (pp.id === '1' ? 'You' : pp.name.split(' ')[0]) : '';
             })()}` : ' — Tap to decide'}
          </Text>
          {!currentWolfDecision && (
            <Ionicons name="chevron-forward" size={14} color={c.gold} />
          )}
        </Pressable>
      )}

      {/* Feature 4: Best Ball Team Banner */}
      {isBestBall && !showBestBallSetup && (
        <View style={[st.bestBallBanner, { backgroundColor: c.elevated, borderColor: c.border }]}>
          <View style={st.bestBallTeam}>
            <Text style={[st.bestBallTeamLabel, { color: c.teal }]}>Team 1</Text>
            <Text style={[st.bestBallTeamScore, { color: toParColor(bestBallTeamScores.team1 - bestBallTeamScores.team1Par, c), fontFamily: GEO }]}>
              {bestBallTeamScores.team1 > 0 ? formatToPar(bestBallTeamScores.team1, bestBallTeamScores.team1Par) : '-'}
            </Text>
          </View>
          <Text style={[st.bestBallVs, { color: c.textMuted }]}>vs</Text>
          <View style={st.bestBallTeam}>
            <Text style={[st.bestBallTeamLabel, { color: c.gold }]}>Team 2</Text>
            <Text style={[st.bestBallTeamScore, { color: toParColor(bestBallTeamScores.team2 - bestBallTeamScores.team2Par, c), fontFamily: GEO }]}>
              {bestBallTeamScores.team2 > 0 ? formatToPar(bestBallTeamScores.team2, bestBallTeamScores.team2Par) : '-'}
            </Text>
          </View>
        </View>
      )}

      {/* Feature 12: Live Feed */}
      {showFeed ? (
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.feedContainer}
        >
          <Text style={[st.feedTitle, { color: c.gold, fontFamily: GEO }]}>LIVE FEED</Text>
          {scoringEvents.length === 0 ? (
            <Text style={[st.feedEmpty, { color: c.textMuted }]}>No events yet — start scoring!</Text>
          ) : (
            scoringEvents.slice(0, 10).map((ev, i) => (
              <View key={i} style={[st.feedItem, { borderColor: c.border }]}>
                <Ionicons name="golf-outline" size={14} color={c.teal} />
                <Text style={[st.feedItemText, { color: c.text }]}>{ev.text}</Text>
                <Text style={[st.feedItemTime, { color: c.textMuted }]}>
                  {ev.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.scoringBody}
          accessibilityHint="Swipe left or right to change holes"
        >
          {/* Feature 6: Hole notes button */}
          <View style={st.holeToolsRow}>
            <Pressable
              onPress={() => {
                setNoteText(holeNotes.get(currentHole.number) ?? '');
                setShowNoteModal(true);
              }}
              style={[st.holeToolBtn, { borderColor: c.border }]}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={holeNotes.has(currentHole.number) && (holeNotes.get(currentHole.number) ?? '').length > 0 ? c.gold : c.textMuted}
              />
              <Text style={[st.holeToolLabel, { color: c.textMuted }]}>Notes</Text>
            </Pressable>
          </View>

          {/* Feature 14: Solo mode player navigation */}
          {viewMode === 'solo' && players.length > 1 && (
            <PlayerTabs
              players={players}
              soloPlayerIdx={soloPlayerIdx}
              onSoloPlayerChange={setSoloPlayerIdx}
              runningToPar={(() => { const r = getRunningTotal(players[soloPlayerIdx].id); return r.total - r.par; })()}
              holesPlayed={(() => { const r = getRunningTotal(players[soloPlayerIdx].id); return r.count; })()}
            />
          )}

          {/* Player score inputs */}
          {visiblePlayers.map((p) => {
            const running = getRunningTotal(p.id);
            const netStrokes = handicapStrokes.get(p.id)?.get(currentHole.number) ?? 0;
            return (
              <PlayerScoreInput
                key={p.id}
                player={p}
                holePar={currentHole.par}
                score={getPlayerScore(p.id)}
                runningTotal={running.total}
                runningPar={running.par}
                netStrokes={netStrokes}
                scoreMode={scoreMode}
                onChange={(s) => updatePlayerScore(p.id, s)}
                compact={viewMode === 'all' && players.length > 2}
              />
            );
          })}

          {/* Item 9: Tag Logging Section */}
          <View style={st.tagSection}>
            <Text style={[st.tagSectionTitle, { fontFamily: GEO }]}>LOG THIS HOLE</Text>
            <View style={st.tagRow}>
              {(['Sand', 'Trees', 'Water', 'Penalty', 'Up & Down'] as const).map((tag) => {
                const myScore = getPlayerScore('1');
                const tags = myScore.tags ?? [];
                const isSelected = tags.includes(tag);
                // Side game indicator
                let indicator = '';
                if (tag === 'Sand' && sideGameKeys.includes('dots') && isSelected) indicator = '-1 dot';
                if (tag === 'Trees' && sideGameKeys.includes('bark') && isSelected) indicator = 'Barkie?';

                return (
                  <Pressable
                    key={tag}
                    onPress={() => {
                      const currentScore = getPlayerScore('1');
                      const currentTags = currentScore.tags ?? [];
                      const newTags = currentTags.includes(tag)
                        ? currentTags.filter((t) => t !== tag)
                        : [...currentTags, tag];
                      updatePlayerScore('1', { ...currentScore, tags: newTags });
                    }}
                    style={({ pressed }) => [
                      st.tagPill,
                      {
                        backgroundColor: isSelected ? `${c.teal}20` : c.elevated,
                        borderColor: isSelected ? c.teal : c.border,
                      },
                      pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text style={[st.tagPillText, { color: isSelected ? c.teal : c.textMuted }]}>
                      {tag}
                    </Text>
                    {indicator.length > 0 && (
                      <Text style={[st.tagIndicator, { color: c.gold, fontFamily: GEO }]}>
                        {indicator}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Hole result */}
          {players.length > 1 && (
            <HoleResultBanner
              players={players}
              holeScores={currentHoleScores}
              holePar={currentHole.par}
            />
          )}

          {/* Feature 1: Hammer button */}
          {sideGameKeys.includes('hammer') && (
            <Pressable
              onPress={() => {
                if (players.length >= 2) {
                  setHammerState((prev) => ({
                    ...prev,
                    active: true,
                    thrower: players[0].id,
                    target: players[1].id,
                    pending: true,
                  }));
                  setShowHammerModal(true);
                }
              }}
              style={({ pressed }) => [st.hammerBtn, { backgroundColor: c.gold }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="hammer-outline" size={18} color="#1E4D2B" />
              <Text style={[st.hammerBtnText, { fontFamily: GEO }]}>Throw Hammer</Text>
              {hammerState.active && hammerState.multiplier > 2 && (
                <View style={st.hammerMultiplierBadge}>
                  <Text style={[st.hammerMultiplierText, { fontFamily: GEO }]}>{hammerState.multiplier}x</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Feature 13: Side Game Running Panel */}
          {sideGameKeys.length > 0 && (
            <View style={[st.runningPanelWrap, { borderColor: c.border }]}>
              <Pressable
                onPress={() => setShowRunningPanel(!showRunningPanel)}
                style={[st.runningPanelToggle, { backgroundColor: c.elevated }]}
              >
                <Text style={[st.runningPanelToggleText, { color: c.text }]}>
                  Side Games {showRunningPanel ? '\u25B2' : '\u25BC'}
                </Text>
              </Pressable>
              {showRunningPanel && (
                <View style={[st.runningPanelContent, { backgroundColor: c.cardBg }]}>
                  {sideGameKeys.includes('skins') && (
                    <RunningSkinsPanel players={players} holes={holes} allScores={allScores} currentHoleNumber={currentHole.number} />
                  )}
                  {sideGameKeys.includes('dots') && (
                    <RunningDotsPanel players={players} holes={holes} allScores={allScores} />
                  )}
                  {sideGameKeys.includes('nassau') && (
                    <RunningNassauPanel players={players} holes={holes} allScores={allScores} />
                  )}
                  {sideGameKeys.includes('snake') && (
                    <RunningSnakePanel players={players} holes={holes} allScores={allScores} />
                  )}
                  {sideGameKeys.includes('wolf') && (
                    <RunningWolfPanel players={players} holes={holes} allScores={allScores} wolfHoleDecisions={wolfHoleDecisions} currentHoleNumber={currentHole.number} />
                  )}
                  {sideGameKeys.includes('bingo_bango_bongo') && (
                    <RunningBBBPanel players={players} bbbHolePoints={bbbHolePoints} />
                  )}
                </View>
              )}
            </View>
          )}

          {/* Nav buttons */}
          <NavButtons
            canPrev={currentHoleIdx > 0}
            canNext={currentHoleIdx < holes.length - 1}
            isLast={isLastHole}
            onPrev={handlePrev}
            onNext={handleNext}
            onFinish={handleFinish}
          />

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Feature 1: Hammer Modal */}
      <Modal visible={showHammerModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
            <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>HAMMER THROWN!</Text>
            <Text style={[st.modalText, { color: c.text }]}>
              {players.find((p) => p.id === hammerState.thrower)?.name ?? 'Player'} doubles the bet
            </Text>
            <Text style={[st.hammerMultiplierDisplay, { color: c.gold, fontFamily: GEO }]}>
              Current: {hammerState.multiplier}x
            </Text>
            <View style={st.modalBtnRow}>
              <Pressable
                onPress={() => {
                  // Accept: multiplier doubles, hammer can be re-thrown
                  setHammerState((prev) => ({
                    ...prev,
                    multiplier: Math.min(8, prev.multiplier * 2),
                    pending: false,
                  }));
                  setShowHammerModal(false);
                }}
                style={({ pressed }) => [st.modalBtn, { backgroundColor: c.teal }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
              >
                <Text style={st.modalBtnText}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  // Fold: concede hole
                  setHammerResults((prev) => {
                    const next = new Map(prev);
                    next.set(currentHole.number, {
                      thrower: hammerState.thrower,
                      target: hammerState.target,
                      multiplier: hammerState.multiplier,
                      accepted: false,
                    });
                    return next;
                  });
                  setHammerState((prev) => ({ ...prev, pending: false }));
                  setShowHammerModal(false);
                }}
                style={({ pressed }) => [st.modalBtn, { backgroundColor: c.urgent }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
              >
                <Text style={st.modalBtnText}>Fold</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wolf Decision Modal */}
      <Modal visible={showWolfModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
            {(() => {
              const wolfPlayer = currentWolfId ? players.find((p) => p.id === currentWolfId) : null;
              const wolfName = wolfPlayer ? (wolfPlayer.id === '1' ? 'You' : wolfPlayer.name.split(' ')[0]) : 'Wolf';
              return (
                <>
                  <Ionicons name="paw" size={28} color={c.gold} style={{ alignSelf: 'center', marginBottom: 8 }} />
                  <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>WOLF — HOLE {currentHole.number}</Text>
                  <Text style={[st.modalText, { color: c.text, textAlign: 'center', marginBottom: 16 }]}>
                    {wolfName} {wolfPlayer?.id === '1' ? 'are' : 'is'} the Wolf
                  </Text>

                  {wolfPickStep === 'choose' && (
                    <View style={{ gap: 10 }}>
                      <Pressable
                        onPress={() => setWolfPickStep('partner')}
                        style={({ pressed }) => [st.modalBtn, { backgroundColor: c.teal }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={st.modalBtnText}>Pick a Partner</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (currentWolfId) {
                            setWolfHoleDecisions((prev) => {
                              const next = new Map(prev);
                              next.set(currentHole.number, { wolfPlayerId: currentWolfId, decision: 'lone', partnerId: null });
                              return next;
                            });
                          }
                          setShowWolfModal(false);
                          haptics.medium();
                        }}
                        style={({ pressed }) => [st.modalBtn, { backgroundColor: c.urgent }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={st.modalBtnText}>Lone Wolf (3x risk)</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (currentWolfId) {
                            setWolfHoleDecisions((prev) => {
                              const next = new Map(prev);
                              next.set(currentHole.number, { wolfPlayerId: currentWolfId, decision: 'blind', partnerId: null });
                              return next;
                            });
                          }
                          setShowWolfModal(false);
                          haptics.heavy();
                        }}
                        style={({ pressed }) => [st.modalBtn, { backgroundColor: '#1A1A2A', borderWidth: 1, borderColor: c.gold }, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={[st.modalBtnText, { color: c.gold }]}>Blind Wolf (4x risk)</Text>
                      </Pressable>
                    </View>
                  )}

                  {wolfPickStep === 'partner' && (
                    <View style={{ gap: 10 }}>
                      <Text style={[st.modalText, { color: c.textMuted, fontSize: 12, marginBottom: 4 }]}>Choose your partner:</Text>
                      {players.filter((p) => p.id !== currentWolfId).map((p) => (
                        <Pressable
                          key={p.id}
                          onPress={() => {
                            if (currentWolfId) {
                              setWolfHoleDecisions((prev) => {
                                const next = new Map(prev);
                                next.set(currentHole.number, { wolfPlayerId: currentWolfId, decision: 'partner', partnerId: p.id });
                                return next;
                              });
                            }
                            setShowWolfModal(false);
                            haptics.light();
                          }}
                          style={({ pressed }) => [st.modalBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.7 }]}
                        >
                          <Text style={[st.modalBtnText, { color: c.text }]}>
                            {p.id === '1' ? 'You' : p.name.split(' ')[0]}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable
                        onPress={() => setWolfPickStep('choose')}
                        style={({ pressed }) => [{ paddingVertical: 8, alignItems: 'center' } as any, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={{ color: c.textMuted, fontSize: 13 }}>Back</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* BBB Bango Prompt — closest to pin */}
      <Modal visible={showBangoPrompt} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
            <Ionicons name="flag" size={28} color={c.gold} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>BANGO — HOLE {bangoHoleNumber}</Text>
            <Text style={[st.modalText, { color: c.text, textAlign: 'center', marginBottom: 16 }]}>
              Who was closest to the pin?
            </Text>
            <View style={{ gap: 10 }}>
              {players.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setBBBHolePoints((prev) => {
                      const next = new Map(prev);
                      const existing = next.get(bangoHoleNumber) ?? { bingo: null, bango: null, bongo: null };
                      next.set(bangoHoleNumber, { ...existing, bango: p.id });
                      return next;
                    });
                    setShowBangoPrompt(false);
                    haptics.light();

                    // Check BBB Triple Crown
                    const hp = bbbHolePoints.get(bangoHoleNumber);
                    if (hp && hp.bingo === p.id && hp.bongo === p.id) {
                      haptics.heavy();
                      sounds.chime();
                      setDormieMoment({
                        visible: true,
                        type: 'BBB_TRIPLE_CROWN',
                        playerName: p.id === '1' ? 'You' : p.name,
                        detail: `All three points on Hole ${bangoHoleNumber}!`,
                      });
                    }
                  }}
                  style={({ pressed }) => [st.modalBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[st.modalBtnText, { color: c.text }]}>
                    {p.id === '1' ? 'You' : p.name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setShowBangoPrompt(false)}
                style={({ pressed }) => [{ paddingVertical: 8, alignItems: 'center' } as any, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ color: c.textMuted, fontSize: 13 }}>Skip</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feature 3: Putt Distance Prompt */}
      <Modal visible={puttDistPrompt.show} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            {(() => {
              const playersWithPutts = players.filter((p) => {
                const s = getPlayerScore(p.id);
                return s.putts > 0;
              });
              const currentPlayer = playersWithPutts[puttDistPrompt.playerIdx];
              return (
                <>
                  <Text style={[st.modalTitle, { color: c.teal, fontFamily: GEO }]}>FIRST PUTT DISTANCE</Text>
                  <Text style={[st.modalText, { color: c.text }]}>
                    {currentPlayer ? (currentPlayer.id === '1' ? 'Your' : `${currentPlayer.name.split(' ')[0]}'s`) : ''} first putt on Hole {puttDistPrompt.holeNumber}
                  </Text>
                  <View style={st.puttDistGrid}>
                    {['Inside 5ft', '5-15ft', '15-30ft', 'Outside 30ft'].map((bucket) => (
                      <Pressable
                        key={bucket}
                        onPress={() => handlePuttDistSelect(bucket)}
                        style={[st.puttDistBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
                      >
                        <Text style={[st.puttDistBtnText, { color: c.text }]}>{bucket}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Feature 4: Best Ball Team Setup Modal */}
      <Modal visible={showBestBallSetup && isBestBall} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.teal, width: '90%' }]}>
            <Text style={[st.modalTitle, { color: c.teal, fontFamily: GEO }]}>BEST BALL TEAMS</Text>
            <Text style={[st.modalText, { color: c.textMuted }]}>Tap a player to move between teams</Text>
            <View style={st.bestBallSetupRow}>
              <View style={st.bestBallColumn}>
                <Text style={[st.bestBallColumnTitle, { color: c.teal }]}>Team 1</Text>
                {bestBallTeams.team1.map((pid) => {
                  const p = players.find((pl) => pl.id === pid);
                  if (!p) return null;
                  return (
                    <Pressable
                      key={pid}
                      onPress={() => {
                        if (bestBallTeams.team1.length <= 1) return;
                        setBestBallTeams((prev) => ({
                          team1: prev.team1.filter((id) => id !== pid),
                          team2: [...prev.team2, pid],
                        }));
                      }}
                      style={[st.bestBallPlayerChip, { backgroundColor: `${c.teal}20`, borderColor: c.teal }]}
                    >
                      <Avatar id={p.id} size={22} name={p.name} />
                      <Text style={[st.bestBallPlayerName, { color: c.text }]}>{p.id === '1' ? 'You' : p.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={st.bestBallColumn}>
                <Text style={[st.bestBallColumnTitle, { color: c.gold }]}>Team 2</Text>
                {bestBallTeams.team2.map((pid) => {
                  const p = players.find((pl) => pl.id === pid);
                  if (!p) return null;
                  return (
                    <Pressable
                      key={pid}
                      onPress={() => {
                        if (bestBallTeams.team2.length <= 1) return;
                        setBestBallTeams((prev) => ({
                          team1: [...prev.team1, pid],
                          team2: prev.team2.filter((id) => id !== pid),
                        }));
                      }}
                      style={[st.bestBallPlayerChip, { backgroundColor: `${c.gold}20`, borderColor: c.gold }]}
                    >
                      <Avatar id={p.id} size={22} name={p.name} />
                      <Text style={[st.bestBallPlayerName, { color: c.text }]}>{p.id === '1' ? 'You' : p.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Pressable
              onPress={() => setShowBestBallSetup(false)}
              style={[st.modalBtn, { backgroundColor: c.teal, marginTop: 16, alignSelf: 'center' }]}
            >
              <Text style={st.modalBtnText}>Start Round</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Feature 6: Hole Notes Modal */}
      <Modal visible={showNoteModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>HOLE {currentHole.number} NOTES</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Hit 3-wood off tee, pin was back-left..."
              placeholderTextColor={c.textMuted}
              multiline
              style={[st.noteInput, { color: c.text, backgroundColor: c.elevated, borderColor: c.border }]}
            />
            <View style={st.modalBtnRow}>
              <Pressable
                onPress={() => setShowNoteModal(false)}
                style={[st.modalBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }]}
              >
                <Text style={[st.modalBtnText, { color: c.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setHoleNotes((prev) => {
                    const next = new Map(prev);
                    if (noteText.trim().length > 0) {
                      next.set(currentHole.number, noteText.trim());
                    } else {
                      next.delete(currentHole.number);
                    }
                    return next;
                  });
                  setShowNoteModal(false);
                }}
                style={[st.modalBtn, { backgroundColor: c.teal }]}
              >
                <Text style={st.modalBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feature 11 / Item 10: Multi-Competition Scoreboard Modal */}
      <Modal visible={showLeaderboard} transparent animationType="fade">
        <View style={[st.leaderboardScreen, { backgroundColor: '#1E4D2B' }]}>
          <View style={st.leaderboardHeader}>
            <Pressable onPress={() => setShowLeaderboard(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[st.leaderboardTitle, { color: '#C9A227', fontFamily: GEO }]}>LIVE LEADERBOARD</Text>
              <Text style={st.leaderboardCourse}>{courseName}</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* Competition tab pills */}
          {competitionTabs.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.compTabRow}>
              {competitionTabs.map((tab) => {
                const active = activeCompTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveCompTab(tab.key)}
                    style={[st.compTabPill, { backgroundColor: active ? 'rgba(201,162,39,0.12)' : 'transparent', borderBottomWidth: active ? 2 : 0, borderBottomColor: '#C9A227' }]}
                  >
                    <Text style={[st.compTabPillText, { color: active ? '#C9A227' : 'rgba(255,255,255,0.45)', fontFamily: GEO }]} numberOfLines={1}>
                      {tab.label.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <GoldDivider />

          {/* ── ROUND VIEW (default) ── */}
          {(activeCompTab === 'round' || !competitionTabs.find((t) => t.key === activeCompTab)) && (
            <>
              <View style={st.broadcastHeaderRow}>
                <Text style={st.broadcastColPos}>POS</Text>
                <Text style={st.broadcastColName}>PLAYER</Text>
                <Text style={st.broadcastColThru}>THRU</Text>
                <Text style={st.broadcastColTotal}>TOTAL</Text>
                <Text style={st.broadcastColPar}>TO PAR</Text>
              </View>
              <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: 0 }}>
                {leaderboardData.map((row, i) => {
                  const isMe = row.player.id === '1';
                  const diff = row.total - row.par;
                  return (
                    <View key={row.player.id} style={[st.lbRow, { backgroundColor: isMe ? 'rgba(0,103,71,0.15)' : i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }]}>
                      <Text style={[st.lbPos, { fontFamily: GEO }]}>{i + 1}</Text>
                      <Avatar id={row.player.id} size={28} name={row.player.name} />
                      <View style={st.lbNameWrap}>
                        <Text style={[st.lbName, isMe && { color: '#006747', fontWeight: '700' }]}>
                          {isMe ? 'You' : row.player.name}
                        </Text>
                      </View>
                      <Text style={[st.lbThru, { width: 36, textAlign: 'center' }]}>{row.count}</Text>
                      <Text style={[st.lbTotal, { fontFamily: GEO }]}>{row.total || '-'}</Text>
                      <Text style={[st.lbToPar, { color: diff < 0 ? '#006747' : diff === 0 ? '#C9A227' : '#C41E3A', fontFamily: GEO }]}>
                        {row.total > 0 ? formatToPar(row.total, row.par) : '-'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* ── SEASON VIEW ── */}
          {competitionTabs.find((t) => t.key === activeCompTab && t.type === 'season') && (() => {
            const tab = competitionTabs.find((t) => t.key === activeCompTab)!;
            const season = tab.data!;
            const myRunning = getRunningTotal('1');
            const myGross = myRunning.total;
            const myPar = myRunning.par;
            const totalPar = holes.reduce((a, h) => a + h.par, 0);

            // Calculate projected points based on format
            let projectedPoints = 0;
            if (season.format === 'Stableford') {
              // Stableford: 0=double+, 1=bogey, 2=par, 3=birdie, 4=eagle, 5=albatross
              let stablefordTotal = 0;
              holes.forEach((h) => {
                const score = allScores.get(h.number)?.get('1');
                if (score) {
                  const diff = score.gross - h.par;
                  if (diff <= -3) stablefordTotal += 5;
                  else if (diff === -2) stablefordTotal += 4;
                  else if (diff === -1) stablefordTotal += 3;
                  else if (diff === 0) stablefordTotal += 2;
                  else if (diff === 1) stablefordTotal += 1;
                }
              });
              projectedPoints = stablefordTotal * (season.multiplier || 1);
            } else {
              // Stroke Play: points based on score vs par
              const diff = myGross - myPar;
              projectedPoints = Math.max(0, 36 - diff) * (season.multiplier || 1);
            }

            // Mock season standings with projected movement
            const standingsPlayers = MOCK_GROUP_PLAYERS.slice(0, 6).map((p, i) => ({
              id: p.id,
              name: p.name,
              points: [185, 172, 168, 155, 142, 130][i] ?? 100,
              position: i + 1,
            }));
            // Add projected points to "You" and re-sort
            const projected = standingsPlayers.map((p) => ({
              ...p,
              projPoints: p.id === '1' ? p.points + projectedPoints : p.points + Math.floor(Math.random() * 20 + 10),
            })).sort((a, b) => b.projPoints - a.projPoints).map((p, i) => ({ ...p, projPosition: i + 1 }));

            return (
              <ScrollView bounces={false} contentContainerStyle={{ padding: 16 }}>
                {/* Season header info */}
                <View style={st.seasonViewHeader}>
                  <Text style={[st.seasonViewTitle, { fontFamily: GEO }]}>{season.seasonName}</Text>
                  <Text style={st.seasonViewMeta}>
                    Week {season.weekNumber} · {season.format} · {season.multiplier}x
                  </Text>
                </View>

                {/* Your projected points */}
                <View style={st.seasonProjectedCard}>
                  <Text style={st.seasonProjectedLabel}>YOUR PROJECTED POINTS</Text>
                  <Text style={[st.seasonProjectedValue, { fontFamily: GEO }]}>
                    +{projectedPoints}
                  </Text>
                  {season.format === 'Stableford' && (
                    <Text style={st.seasonProjectedSub}>
                      Running Stableford: {(() => {
                        let total = 0;
                        holes.forEach((h) => {
                          const score = allScores.get(h.number)?.get('1');
                          if (score) {
                            const d = score.gross - h.par;
                            if (d <= -3) total += 5;
                            else if (d === -2) total += 4;
                            else if (d === -1) total += 3;
                            else if (d === 0) total += 2;
                            else if (d === 1) total += 1;
                          }
                        });
                        return total;
                      })()} pts thru {holesScored}
                    </Text>
                  )}
                  {season.format === 'Stroke Play' && myGross > 0 && (
                    <Text style={st.seasonProjectedSub}>
                      {myGross} ({myGross - myPar >= 0 ? '+' : ''}{myGross - myPar}) thru {holesScored}
                    </Text>
                  )}
                </View>

                {/* Season standings with projected movement */}
                <Text style={st.seasonStandingsTitle}>SEASON STANDINGS</Text>
                <View style={st.broadcastHeaderRow}>
                  <Text style={st.broadcastColPos}>POS</Text>
                  <Text style={st.broadcastColName}>PLAYER</Text>
                  <Text style={[st.broadcastColThru, { width: 50 }]}>PTS</Text>
                  <Text style={[st.broadcastColTotal, { width: 50 }]}>PROJ</Text>
                  <Text style={[st.broadcastColPar, { width: 36 }]}>{' '}</Text>
                </View>
                {projected.map((p) => {
                  const isMe = p.id === '1';
                  const moved = p.position - p.projPosition;
                  return (
                    <View key={p.id} style={[st.lbRow, { backgroundColor: isMe ? 'rgba(0,103,71,0.15)' : 'transparent' }]}>
                      <Text style={[st.lbPos, { fontFamily: GEO }]}>{p.position}</Text>
                      <Avatar id={p.id} size={28} name={p.name} />
                      <View style={st.lbNameWrap}>
                        <Text style={[st.lbName, isMe && { color: '#006747', fontWeight: '700' }]}>
                          {isMe ? 'You' : p.name.split(' ')[0]}
                        </Text>
                      </View>
                      <Text style={[st.lbTotal, { fontFamily: GEO, width: 50 }]}>{p.points}</Text>
                      <Text style={[st.lbTotal, { fontFamily: GEO, width: 50, color: '#C9A227' }]}>{p.projPoints}</Text>
                      <View style={{ width: 36, alignItems: 'center' }}>
                        {moved > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="arrow-up" size={12} color="#006747" />
                            <Text style={{ color: '#006747', fontSize: 11, fontFamily: GEO, fontWeight: '700' }}>{moved}</Text>
                          </View>
                        )}
                        {moved < 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="arrow-down" size={12} color="#C41E3A" />
                            <Text style={{ color: '#C41E3A', fontSize: 11, fontFamily: GEO, fontWeight: '700' }}>{Math.abs(moved)}</Text>
                          </View>
                        )}
                        {moved === 0 && (
                          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>—</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            );
          })()}

          {/* ── MATCHUP VIEW ── */}
          {activeCompTab === 'matchup' && matchupOpponent && (() => {
            const opponentPlayer = players.find((p) => p.id === matchupOpponent) ?? players.find((p) => p.id !== '1');
            const opponentName = opponentPlayer?.name ?? 'Opponent';
            const opponentId = opponentPlayer?.id ?? '2';

            // Calculate match status
            let myUp = 0;
            let holesPlayed = 0;
            const holeResults: { hole: number; myScore: number | null; oppScore: number | null; result: 'win' | 'loss' | 'halve' | 'pending' }[] = [];

            holes.forEach((h) => {
              const myScore = allScores.get(h.number)?.get('1');
              const oppScore = allScores.get(h.number)?.get(opponentId);
              if (myScore && oppScore) {
                holesPlayed++;
                const diff = myScore.gross - oppScore.gross;
                if (diff < 0) myUp++;
                else if (diff > 0) myUp--;
                holeResults.push({ hole: h.number, myScore: myScore.gross, oppScore: oppScore.gross, result: diff < 0 ? 'win' : diff > 0 ? 'loss' : 'halve' });
              } else {
                holeResults.push({ hole: h.number, myScore: myScore?.gross ?? null, oppScore: oppScore?.gross ?? null, result: 'pending' });
              }
            });

            const matchStatus = myUp === 0
              ? `ALL SQUARE thru ${holesPlayed}`
              : myUp > 0
                ? `${myUp} UP thru ${holesPlayed}`
                : `${Math.abs(myUp)} DOWN thru ${holesPlayed}`;

            return (
              <ScrollView bounces={false} contentContainerStyle={{ padding: 16 }}>
                {/* Matchup header */}
                <View style={st.matchupHeader}>
                  <View style={st.matchupPlayerCol}>
                    <Avatar id="1" size={40} name="Ian McGowan" />
                    <Text style={[st.matchupPlayerName, { fontFamily: GEO }]}>YOU</Text>
                  </View>
                  <View style={st.matchupVs}>
                    <Text style={[st.matchupVsText, { fontFamily: GEO }]}>VS</Text>
                  </View>
                  <View style={st.matchupPlayerCol}>
                    <Avatar id={opponentId} size={40} name={opponentName} />
                    <Text style={[st.matchupPlayerName, { fontFamily: GEO }]}>{opponentName.split(' ')[0].toUpperCase()}</Text>
                  </View>
                </View>

                {/* Match status */}
                <View style={[st.matchStatusBanner, { backgroundColor: myUp > 0 ? 'rgba(0,103,71,0.15)' : myUp < 0 ? 'rgba(196,30,58,0.15)' : 'rgba(201,162,39,0.15)' }]}>
                  <Text style={[st.matchStatusText, { color: myUp > 0 ? '#006747' : myUp < 0 ? '#C41E3A' : '#C9A227', fontFamily: GEO }]}>
                    {matchStatus}
                  </Text>
                </View>

                {/* Hole-by-hole comparison */}
                <View style={st.matchupGrid}>
                  <View style={st.matchupGridHeader}>
                    <Text style={[st.matchupGridCell, st.matchupGridHole]}>HOLE</Text>
                    <Text style={[st.matchupGridCell, st.matchupGridScore]}>YOU</Text>
                    <Text style={[st.matchupGridCell, st.matchupGridScore]}>{opponentName.split(' ')[0].toUpperCase()}</Text>
                    <Text style={[st.matchupGridCell, st.matchupGridResult]}>{' '}</Text>
                  </View>
                  {holeResults.map((hr) => (
                    <View key={hr.hole} style={[st.matchupGridRow, hr.result === 'win' && { backgroundColor: 'rgba(0,103,71,0.08)' }, hr.result === 'loss' && { backgroundColor: 'rgba(196,30,58,0.08)' }]}>
                      <Text style={[st.matchupGridCell, st.matchupGridHole, { fontFamily: GEO }]}>{hr.hole}</Text>
                      <Text style={[st.matchupGridCell, st.matchupGridScore, { fontFamily: GEO, color: hr.myScore ? '#E8E4DE' : 'rgba(255,255,255,0.3)' }]}>
                        {hr.myScore ?? '-'}
                      </Text>
                      <Text style={[st.matchupGridCell, st.matchupGridScore, { fontFamily: GEO, color: hr.oppScore ? '#E8E4DE' : 'rgba(255,255,255,0.3)' }]}>
                        {hr.oppScore ?? '-'}
                      </Text>
                      <View style={[st.matchupGridCell, st.matchupGridResult]}>
                        {hr.result === 'win' && <Ionicons name="checkmark-circle" size={14} color="#006747" />}
                        {hr.result === 'loss' && <Ionicons name="close-circle" size={14} color="#C41E3A" />}
                        {hr.result === 'halve' && <Text style={{ color: '#C9A227', fontSize: 10, fontFamily: GEO }}>AS</Text>}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Live status */}
                {!opponentPlayer && (
                  <View style={st.matchupWaiting}>
                    <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.4)" />
                    <Text style={st.matchupWaitingText}>Waiting for {opponentName} to post scores</Text>
                  </View>
                )}
              </ScrollView>
            );
          })()}

          {/* ── TRIP VIEW ── */}
          {activeCompTab === 'trip' && linkedTrip && (() => {
            // Mock trip leaderboard with running totals
            const tripPlayers = MOCK_GROUP_PLAYERS.filter((p) =>
              linkedTrip.playerIds.includes(p.id)
            ).map((p, i) => {
              const isMe = p.id === '1';
              const myRunning = isMe ? getRunningTotal('1') : null;
              const prevTotal = [232, 238, 241, 245, 250, 255][i] ?? 250;
              const todayScore = isMe && myRunning ? myRunning.total : (72 + Math.floor(Math.random() * 8));
              return {
                id: p.id,
                name: p.name,
                tripTotal: prevTotal + todayScore,
                todayScore,
                isMe,
              };
            }).sort((a, b) => a.tripTotal - b.tripTotal);

            const leaderTotal = tripPlayers[0]?.tripTotal ?? 0;
            const today = new Date();
            const start = new Date(linkedTrip.startDate);
            const dayNum = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

            return (
              <ScrollView bounces={false} contentContainerStyle={{ padding: 16 }}>
                {/* Trip header */}
                <View style={st.seasonViewHeader}>
                  <Text style={[st.seasonViewTitle, { fontFamily: GEO }]}>{linkedTrip.name}</Text>
                  <Text style={st.seasonViewMeta}>
                    Day {dayNum} · {linkedTrip.destination}
                  </Text>
                </View>

                {/* Trip leaderboard */}
                <View style={st.broadcastHeaderRow}>
                  <Text style={st.broadcastColPos}>POS</Text>
                  <Text style={st.broadcastColName}>PLAYER</Text>
                  <Text style={st.broadcastColThru}>TODAY</Text>
                  <Text style={st.broadcastColTotal}>TOTAL</Text>
                  <Text style={st.broadcastColPar}>BACK</Text>
                </View>
                {tripPlayers.map((p, i) => {
                  const back = p.tripTotal - leaderTotal;
                  return (
                    <View key={p.id} style={[st.lbRow, { backgroundColor: p.isMe ? 'rgba(0,103,71,0.15)' : i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }]}>
                      <Text style={[st.lbPos, { fontFamily: GEO }]}>{i + 1}</Text>
                      <Avatar id={p.id} size={28} name={p.name} />
                      <View style={st.lbNameWrap}>
                        <Text style={[st.lbName, p.isMe && { color: '#006747', fontWeight: '700' }]}>
                          {p.isMe ? 'You' : p.name.split(' ')[0]}
                        </Text>
                      </View>
                      <Text style={[st.lbThru, { width: 36, textAlign: 'center', fontFamily: GEO }]}>{p.todayScore}</Text>
                      <Text style={[st.lbTotal, { fontFamily: GEO }]}>{p.tripTotal}</Text>
                      <Text style={[st.lbToPar, { color: back === 0 ? '#C9A227' : '#C41E3A', fontFamily: GEO }]}>
                        {back === 0 ? 'LEAD' : `+${back}`}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* Item 31: Dormie Moment overlay */}
      {dormieMoment.visible && (
        <Suspense fallback={null}>
          <DormieMoment
            visible={dormieMoment.visible}
            type={dormieMoment.type}
            playerName={dormieMoment.playerName}
            detail={dormieMoment.detail}
            onDismiss={() => setDormieMoment((prev) => ({ ...prev, visible: false }))}
          />
        </Suspense>
      )}

      {/* Item 32: Side Game Toast */}
      {sideGameToastEvents.length > 0 && (
        <SideGameToast
          events={sideGameToastEvents}
          onConfirm={(eventId, value) => {
            setSideGameToastEvents((prev) => prev.filter((e) => e.id !== eventId));
          }}
          onDismiss={(eventId) => {
            setSideGameToastEvents((prev) => prev.filter((e) => e.id !== eventId));
          }}
        />
      )}

      {/* Item 33: Hole Transition Banner */}
      <HoleTransitionBanner
        visible={transitionBanner.visible}
        holeNumber={transitionBanner.holeNumber}
        par={transitionBanner.par}
        results={transitionBanner.results}
        onDismiss={() => setTransitionBanner((prev) => ({ ...prev, visible: false }))}
      />

      {/* Elite polish: Confetti on round completion */}
      <Confetti visible={showConfetti} onDone={() => setShowConfetti(false)} />

      {/* Elite polish: Personal Best Banner */}
      <PersonalBestBanner
        visible={showPersonalBest}
        courseName={courseName}
        previousBest={prevBest}
        onDone={() => setShowPersonalBest(false)}
      />
    </View>
  );
}

export default function ScoringScreen() {
  return (
    <ErrorBoundary>
      <ScoringScreenInner />
    </ErrorBoundary>
  );
}

