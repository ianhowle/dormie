import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { sounds } from '../lib/sounds';
import { useToast } from '../components/Toast';
import { useNetworkStatus } from '../lib/networkStatus';
import { useDemoMode } from '../contexts/DemoModeContext';
import {
  saveActiveRound,
  clearActiveRound,
  serializeScores,
  deserializeScores,
  getActiveRound,
  queueOfflineRound,
  type ActiveRoundState,
} from '../lib/roundStorage';
import { roundsService } from '../services/rounds.service';
import { coursesService } from '../services/courses.service';
import { seasonsService } from '../services/seasons.service';
import { processSeasonRound, resolveSeasonWeekId } from '../services/scoring.service';
import { MOCK_GROUP_PLAYERS } from '../data/leaderboard';
import { MOCK_UPCOMING_TRIPS } from '../data/trips';

import type {
  LinkedSeason, CompetitionTab, PlayerConfig, HoleScore, HoleData,
  HammerState, HammerResult, WolfHoleState, BBBHolePoints,
  ScoringEvent, LowHighOptions, LowHighHoleResult, LowHighPoints,
  SixSixSixScoringMethod, SixSixSixSegment, SixSixSixResult,
} from './types';
import {
  buildHoles, calcCourseHandicap, isGIR, SIDE_GAME_DISPLAY, pName,
} from './calculations';
import { checkDormieMoments as checkDormieMomentsUtil } from './moments';
import { createShuffledDeck, evaluateBestHand, type Card as PokerCardT } from '../services/poker.service';
import { generateScoringEvents as genScoringEventsUtil, detectToastEvents as detectToastEventsUtil } from './sideGames';

import type { SideGameEvent } from '../components/SideGameToast';
import type { SideGameEventSlice } from '../data/scoring';
import { formatMatchState, deriveSinglesSideScore, type MatchPlayState } from '../data/scoring';
import type { PlayerHoleResult } from '../components/HoleTransitionBanner';
import type { MomentType } from '../components/DormieMoment';

export function useScoringState() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user } = useAuth();
  const { checkAndDisable: disableDemoIfNeeded } = useDemoMode();
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
    seasonName: string;
    seasonWeek: string;
    seasonFormat: string;
    seasonMultiplier: string;
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

  // Match Play 1v1 (Stage 1 — singles only; 2v2/team match lands in Stage 4
  // alongside MatchPlaySetupModal). Mirrors the format-detection pattern used
  // by Best Ball / Low-High / 6-6-6 below: string-match on the format label.
  const isMatchPlay = formatLabel.toLowerCase().includes('match play') && players.length === 2;

  // Stage 2 — Match play setup state. Side model is MatchSide { playerIds: string[] }
  // per the architecture; Stage 4 extends it to multi-player team sides. For 1v1, each
  // side has exactly one player. matchScoreMode + matchPerspective are user-overridable
  // in the placeholder setup modal — they replace the Stage-1 hardcoded reads (raw
  // URL scoreMode + perspective 'A') inside the matchPlayState useMemo below.
  const [matchSides, setMatchSides] = useState<{
    sideA: { playerIds: string[] };
    sideB: { playerIds: string[] };
  }>(() => ({
    sideA: { playerIds: players[0] ? [players[0].id] : [] },
    sideB: { playerIds: players[1] ? [players[1].id] : [] },
  }));
  const [matchScoreMode, setMatchScoreMode] = useState<'gross' | 'net'>(
    scoreMode === 'net' ? 'net' : 'gross',
  );
  // Default perspective: whichever side contains the user (id '1'); fall back to A.
  const [matchPerspective, setMatchPerspective] = useState<'A' | 'B'>(() => {
    if (players[0]?.id === '1') return 'A';
    if (players[1]?.id === '1') return 'B';
    return 'A';
  });
  const [showMatchPlaySetup, setShowMatchPlaySetup] = useState(isMatchPlay);

  // Feature 4: Best Ball 2v2
  const isBestBall = formatLabel.toLowerCase().includes('best ball') && players.length === 4;
  const [bestBallTeams, setBestBallTeams] = useState<{ team1: string[]; team2: string[] }>({
    team1: players.length >= 4 ? [players[0].id, players[1].id] : [],
    team2: players.length >= 4 ? [players[2].id, players[3].id] : [],
  });
  const [showBestBallSetup, setShowBestBallSetup] = useState(isBestBall);

  // Low Ball / High Ball 2v2
  const isLowHigh = (formatLabel.toLowerCase().includes('low ball') || formatLabel.toLowerCase().includes('low/high') || formatLabel.toLowerCase().includes('low ball / high')) && players.length === 4;
  const [lowHighTeams, setLowHighTeams] = useState<{ team1: string[]; team2: string[] }>({
    team1: players.length >= 4 ? [players[0].id, players[1].id] : [],
    team2: players.length >= 4 ? [players[2].id, players[3].id] : [],
  });
  const [lowHighOptions, setLowHighOptions] = useState<LowHighOptions>({
    tieHandling: 'halve', birdieBonus: false, includeTotal: false,
  });
  const [showLowHighSetup, setShowLowHighSetup] = useState(isLowHigh);

  // 6-6-6: rotating partners every 6 holes
  const isSixSixSix = formatLabel.includes('6-6-6') && players.length === 4;
  const [sixOrder, setSixOrder] = useState<string[]>(() => players.slice(0, 4).map((p) => p.id));
  const [sixScoringMethod, setSixScoringMethod] = useState<SixSixSixScoringMethod>('low_ball');
  const [showSixSetup, setShowSixSetup] = useState(isSixSixSix);
  const [sixSegmentBanner, setSixSegmentBanner] = useState<{ visible: boolean; segmentIdx: number }>({ visible: false, segmentIdx: 0 });

  // 3-Putt Poker state
  const isThreePuttPoker = sideGameKeys.includes('three_putt_poker');
  const [pokerDeck, setPokerDeck] = useState<PokerCardT[]>(() => createShuffledDeck());
  const [pokerDeckIndex, setPokerDeckIndex] = useState(0);
  const [pokerPerPlayer, setPokerPerPlayer] = useState<Record<string, { cards: PokerCardT[]; onePutts: number; threePutts: number; chipIns: number }>>({});
  const [pokerPot, setPokerPot] = useState(0);
  const [pokerWorstPutter, setPokerWorstPutter] = useState<string | null>(null);
  const [pokerDealtHoles, setPokerDealtHoles] = useState<Set<string>>(new Set()); // "playerId-holeNumber"
  const pokerAnte = 1;
  const pokerThreePuttPenalty = 1;

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
  // Persisted side-game events from confirmed toasts: gameKey → playerId → holeNumber → value.
  // Tier B counter engines (sandies/bark/poleys) read this; handlers translate event.playerName → playerId on write.
  const [sideGameEventSlice, setSideGameEventSlice] = useState<SideGameEventSlice>(new Map());

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

  // ─── Mount-only restore from AsyncStorage ──────────────────────────
  // If a saved active round matches the round currently being opened,
  // rehydrate allScores + currentHoleIdx so an ErrorBoundary "Try Again"
  // or any remount mid-round recovers the scorecard the user entered.
  //
  // Identity gate — must restore ONLY when the saved round really is the
  // one being opened:
  //   1. Non-empty courseId match (avoids cross-course bleed)
  //   2. Player ID set match (sorted, length+element equal)
  //   3. Staleness <= 24h (orphaned saves expire safely)
  //
  // Known limitation: starting a new round at the same course with the
  // same player roster within 24h of an unfinished saved round will
  // inherit prior scores. Full fix requires the wizard to call
  // clearActiveRound() before launching a new round (out of scope here).
  // The existing post-round finalize at L841/L864 already clears on
  // normal completion, so this trap only fires when the user force-kills
  // mid-round AND bypasses the Home tab's Resume affordance.
  useEffect(() => {
    let cancelled = false;
    if (!courseId) return; // No identity signal — run as fresh round.

    // Parse URL player IDs once, up front. Malformed → skip restore.
    let urlPlayerIds: string[];
    try {
      const parsed = JSON.parse(params.players ?? '[]') as Array<{ id?: string }>;
      urlPlayerIds = parsed.map((p) => p?.id ?? '').filter(Boolean).sort();
    } catch {
      return;
    }
    if (urlPlayerIds.length === 0) return;

    getActiveRound().then((round) => {
      if (cancelled || !round) return;
      if (!round.courseId || round.courseId !== courseId) return;

      const savedPlayerIds = (round.players ?? [])
        .map((p: { id?: string }) => p?.id ?? '')
        .filter(Boolean)
        .sort();
      if (savedPlayerIds.length !== urlPlayerIds.length) return;
      if (savedPlayerIds.some((id, i) => id !== urlPlayerIds[i])) return;

      const startedAtMs = Date.parse(round.startedAt);
      if (!Number.isFinite(startedAtMs)) return;
      if (Date.now() - startedAtMs > 24 * 60 * 60 * 1000) return;

      // Atomic guard: don't clobber state that a user keystroke may have
      // populated during the async window.
      setAllScores((prev) => prev.size === 0 ? deserializeScores(round.allScores) : prev);
      setCurrentHoleIdx((prev) => prev === 0 ? round.currentHoleIdx : prev);
    }).catch(() => {
      // AsyncStorage read failure: silently fall through as fresh round.
    });

    return () => { cancelled = true; };
  }, []); // mount only — closure captures courseId + params at mount time

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
    const result = checkDormieMomentsUtil(holeNumber, allScores, players, holes, sideGameKeys, isMatchPlay);
    if (result) {
      setDormieMoment({
        visible: true,
        type: result.type,
        playerName: result.playerName,
        detail: result.detail,
      });
    }
  }, [allScores, holes, players, sideGameKeys, isMatchPlay]);

  // Item 32: Detect side game toast events
  const detectToastEventsLocal = useCallback((holeNumber: number) => {
    const newEvents = detectToastEventsUtil(holeNumber, allScores, holes, players, sideGameKeys);
    if (newEvents.length > 0) {
      setSideGameToastEvents((prev) => [...prev, ...newEvents]);
    }
  }, [allScores, holes, players, sideGameKeys]);

  // Item 33: Build transition banner data
  const showTransitionBanner = useCallback((holeNumber: number) => {
    const holeDataItem = holes.find((h) => h.number === holeNumber);
    if (!holeDataItem) return;
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
        gir: isGIR(s.gross, s.putts, holeDataItem.par),
      });
    });

    setTransitionBanner({
      visible: true,
      holeNumber: holeDataItem.number,
      par: holeDataItem.par,
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

    // Side-game toast detection is deferred — see the PuttDistModal branch below.
    // When PuttDistModal will open, detection runs in handlePuttDistSelect after the
    // modal closes; otherwise it runs in the else-branch a few lines down. This
    // prevents PuttDistModal and ManualInputModal from trying to present at the
    // same time (React Native does not reliably stack native modals).

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

        // BBB Triple Crown: same player earns bingo + bango + bongo on one hole
        if (bingo && existing.bango && bongo && bingo === existing.bango && bingo === bongo) {
          const triplePlayer = players.find((p) => p.id === bingo);
          if (triplePlayer) {
            haptics.heavy();
            sounds.chime();
            setDormieMoment({
              visible: true,
              type: 'BBB_TRIPLE_CROWN',
              playerName: triplePlayer.id === '1' ? 'You' : triplePlayer.name,
              detail: `Bingo · Bango · Bongo — Hole ${currentHole.number}`,
            });
          }
        }

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

    // Low/High: Clean Sweep detection (both low and high to same team)
    if (isLowHigh) {
      const holeScores = allScores.get(currentHole.number);
      if (holeScores) {
        const t1 = lowHighTeams.team1.map((pid) => holeScores.get(pid)?.gross).filter((v): v is number => typeof v === 'number');
        const t2 = lowHighTeams.team2.map((pid) => holeScores.get(pid)?.gross).filter((v): v is number => typeof v === 'number');
        if (t1.length >= 2 && t2.length >= 2) {
          const t1Low = Math.min(...t1), t1High = Math.max(...t1);
          const t2Low = Math.min(...t2), t2High = Math.max(...t2);
          const lowWin = t1Low < t2Low ? 'team1' : t2Low < t1Low ? 'team2' : 'halved';
          const highWin = t1High < t2High ? 'team1' : t2High < t1High ? 'team2' : 'halved';
          if (lowWin !== 'halved' && lowWin === highWin) {
            haptics.heavy();
            sounds.chime();
            setDormieMoment({
              visible: true,
              type: 'CLEAN_SWEEP',
              playerName: lowWin === 'team1' ? 'Team 1' : 'Team 2',
              detail: `Top to bottom on Hole ${currentHole.number}`,
            });
          }
        }
      }
    }

    // 6-6-6: segment rotation banner after holes 6 and 12
    if (isSixSixSix && (currentHole.number === 6 || currentHole.number === 12) && currentHoleIdx < holes.length - 1) {
      const nextSeg = currentHole.number === 6 ? 1 : 2;
      haptics.heavy();
      sounds.chime();
      setSixSegmentBanner({ visible: true, segmentIdx: nextSeg });
    }

    // Item 33: Show hole transition banner
    showTransitionBanner(currentHole.number);

    // Feature 3: Check if putt distance prompt needed
    const playersWithPutts = players.filter((p) => {
      const s = getPlayerScore(p.id);
      return s.putts > 0;
    });

    const willOpenPuttDistModal = playersWithPutts.length > 0 && currentHoleIdx < holes.length - 1;
    if (willOpenPuttDistModal) {
      // PuttDistModal will open — defer side-game toast detection to handlePuttDistSelect
      // so ManualInputModal can't try to present while PuttDistModal is still up.
      setPuttDistPrompt({ show: true, playerIdx: 0, holeNumber: currentHole.number });
    } else {
      // No PuttDistModal — safe to fire side-game detection now.
      detectToastEventsLocal(currentHole.number);
      if (currentHoleIdx < holes.length - 1) {
        setCurrentHoleIdx(currentHoleIdx + 1);
      }
    }
  }, [players, currentHoleScores, updatePlayerScore, getPlayerScore, generateEvents, checkDormieMoments, detectToastEventsLocal, sideGameKeys, currentHole, allScores, bbbHolePoints, wolfHoleDecisions, showTransitionBanner, currentHoleIdx, holes.length, isLowHigh, lowHighTeams, isSixSixSix]);

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
      // Capture before reset — setPuttDistPrompt below clears holeNumber.
      const completedHoleNumber = puttDistPrompt.holeNumber;
      setPuttDistPrompt({ show: false, playerIdx: 0, holeNumber: 1 });
      // PuttDistModal is closing — now fire the side-game detection that was
      // deferred from handleNext. The two modals are now strictly serial.
      detectToastEventsLocal(completedHoleNumber);
      if (currentHoleIdx < holes.length - 1) {
        setCurrentHoleIdx(currentHoleIdx + 1);
      }
    }
  }, [players, getPlayerScore, puttDistPrompt.playerIdx, puttDistPrompt.holeNumber, currentHoleIdx, holes.length, detectToastEventsLocal]);

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

  // Post-round handler (saves to Supabase or queues offline)
  const handlePostRound = useCallback(async () => {
    if (!user) { router.dismissAll(); return; }
    try {
      const holeScores: { hole: number; gross: number; putts?: number; fir?: boolean }[] = [];
      holes.forEach((h) => {
        const sc = allScores.get(h.number)?.get(user.id);
        if (sc) holeScores.push({ hole: h.number, gross: sc.gross, putts: sc.putts, ...(sc.fir !== null ? { fir: sc.fir } : {}) });
      });
      const grossTotal = holeScores.reduce((sum, h) => sum + h.gross, 0);
      const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
      let netTotal: number | null = null;
      if (scoreMode === 'net') {
        const playerStrokes = handicapStrokes.get(user.id);
        if (playerStrokes) netTotal = grossTotal - Array.from(playerStrokes.values()).reduce((a, b) => a + b, 0);
      }
      // course_id is now nullable — for virtual/async rounds we may not
      // have a persisted Course record. We still denormalize name/slope/rating
      // onto the round itself so handicap calc works regardless.
      let finalCourseId: string | null = courseId || null;
      if (finalCourseId && finalCourseId.startsWith('custom-')) {
        // Custom courses aren't real Course records — treat as virtual.
        finalCourseId = null;
      }
      if (!finalCourseId && courseName && courseName !== 'Course') {
        // Try to persist the course so trip/season links still work. If it
        // fails (e.g., RLS or offline), fall back to a virtual round.
        try {
          const course = await coursesService.ensureCourse({
            name: courseName,
            location: courseName,
            slope: courseSlope,
            rating: courseRating,
            par: coursePar,
          });
          finalCourseId = course.id;
        } catch {
          finalCourseId = null;
        }
      }
      const wolfData = sideGameKeys.includes('wolf')
        ? Array.from(wolfHoleDecisions.entries()).map(([hole, d]) => ({ hole, ...d }))
        : null;
      const bbbData = sideGameKeys.includes('bingo_bango_bongo')
        ? Array.from(bbbHolePoints.entries()).map(([hole, pts]) => ({ hole, ...pts }))
        : null;
      // Resolve the actual season_weeks row id for the round record
      let firstWeekId: string | null = null;
      if (linkedSeasons.length > 0) {
        try {
          firstWeekId = await resolveSeasonWeekId(linkedSeasons[0].seasonId, linkedSeasons[0].weekNumber);
        } catch {}
      }
      const savedRound = await roundsService.create({
        user_id: user.id,
        course_id: finalCourseId,
        gross_score: grossTotal,
        net_score: netTotal,
        hole_scores: holeScores,
        source: 'app',
        played_at: new Date().toISOString(),
        course_name: courseName || null,
        course_slope: courseSlope || null,
        course_rating: courseRating || null,
        course_source: 'golfapi',
        ...(tripId ? { trip_id: tripId } : {}),
        ...(firstWeekId ? { season_week_id: firstWeekId } : {}),
        ...(wolfData ? { wolf_data: wolfData } : {}),
        ...(bbbData ? { bbb_data: bbbData } : {}),
      } as any);
      if (linkedSeasons.length > 0) {
        const coursePars = holes.map((h) => h.par);
        for (const ls of linkedSeasons) {
          try {
            const weekId = await resolveSeasonWeekId(ls.seasonId, ls.weekNumber);
            await processSeasonRound({
              roundId: savedRound.id,
              userId: user.id,
              seasonWeekId: weekId,
              seasonId: ls.seasonId,
              holeScores,
              coursePars,
            });
          } catch (err) {
            console.error('[scoring] Season write failed for season', ls.seasonId, err);
            showToast({ message: `Season "${ls.seasonName}" scoring failed — your round is saved but may not appear in standings.`, type: 'error', icon: 'alert-circle' });
          }
        }
      }
      // Auto-settle side game wagers to the ledger
      if (sideGameKeys.length > 0 && players.length >= 2) {
        try {
          const { ledgerService } = await import('../services/ledger.service');
          if (sideGameKeys.includes('nassau')) {
            const front = holes.filter((h) => h.number <= 9);
            const back = holes.filter((h) => h.number > 9);
            const segments = [front, back, holes];
            for (const seg of segments) {
              if (seg.length === 0) continue;
              let best = Infinity;
              let winnerId = '';
              players.forEach((p) => {
                let total = 0;
                seg.forEach((h) => { const s = allScores.get(h.number)?.get(p.id); if (s) total += s.gross; });
                if (total > 0 && total < best) { best = total; winnerId = p.id; }
              });
              if (winnerId) {
                const losers = players.filter((p) => p.id !== winnerId).map((p) => ({ userId: p.id, amount: 5 }));
                await ledgerService.autoSettleNassau({ roundId: savedRound.id, winners: [winnerId], losers });
              }
            }
          }
          if (sideGameKeys.includes('skins')) {
            const skinWins = new Map<string, number>();
            players.forEach((p) => skinWins.set(p.id, 0));
            let carryover = 0;
            holes.forEach((h) => {
              const hs = allScores.get(h.number);
              if (!hs || hs.size < players.length) { carryover++; return; }
              let best = Infinity;
              let winners: string[] = [];
              hs.forEach((s, pid) => { if (s.gross < best) { best = s.gross; winners = [pid]; } else if (s.gross === best) winners.push(pid); });
              if (winners.length === 1) { skinWins.set(winners[0], (skinWins.get(winners[0]) ?? 0) + 1 + carryover); carryover = 0; }
              else carryover++;
            });
            const totalSkins = Array.from(skinWins.values()).reduce((a, b) => a + b, 0);
            if (totalSkins > 0) {
              const skinsWinners = Array.from(skinWins.entries()).filter(([, c]) => c > 0).map(([pid]) => pid);
              const skinsLosers = players.filter((p) => !skinsWinners.includes(p.id)).map((p) => ({ userId: p.id, amount: totalSkins * 2 / (players.length - skinsWinners.length) }));
              if (skinsLosers.length > 0) {
                await ledgerService.autoSettleSkins({ roundId: savedRound.id, winners: skinsWinners, losers: skinsLosers });
              }
            }
          }
        } catch (err) {
          console.error('[scoring] Ledger auto-settle failed', err);
        }
      }
      haptics.success();
      sounds.chime();
      showToast({ message: 'Round saved', type: 'success', icon: 'checkmark-circle' });
      disableDemoIfNeeded().catch(() => {});
      setShowConfetti(true);
      try {
        if (finalCourseId) {
          const previousRounds = await roundsService.fetchByCourse(finalCourseId, user.id);
          const sorted = [...previousRounds].sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
          const previousBest = sorted.slice(1).reduce((best, r) => Math.min(best, r.gross_score), Infinity);
          if (previousBest !== Infinity && grossTotal < previousBest) { setPrevBest(previousBest); setShowPersonalBest(true); }
        }
      } catch {}
      await clearActiveRound();
      const { Alert } = await import('react-native');
      Alert.alert('Score Posted', `Your ${grossTotal} (${grossTotal - totalPar >= 0 ? '+' : ''}${grossTotal - totalPar}) is on the board.`);
      router.dismissAll();
    } catch (err) {
      const offlineHoleScores: { hole: number; gross: number; putts?: number; fir?: boolean }[] = [];
      holes.forEach((h) => {
        const sc = allScores.get(h.number)?.get(user.id);
        if (sc) offlineHoleScores.push({ hole: h.number, gross: sc.gross, putts: sc.putts, ...(sc.fir !== null ? { fir: sc.fir } : {}) });
      });
      const offlineRound = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        userId: user.id, courseId, courseName,
        courseSlope, courseRating,
        grossScore: offlineHoleScores.reduce((sum, h) => sum + h.gross, 0),
        netScore: null, holeScores: offlineHoleScores, source: 'app' as const,
        playedAt: new Date().toISOString(), queuedAt: new Date().toISOString(),
        tripId: tripId ?? undefined,
        seasonWeekId: linkedSeasons.length > 0 ? linkedSeasons[0].seasonId : undefined,
        linkedSeasons: linkedSeasons.length > 0 ? linkedSeasons : undefined,
        coursePars: holes.map((h) => h.par),
      };
      await queueOfflineRound(offlineRound);
      await clearActiveRound();
      showToast({ message: 'Round saved locally. It will sync when you\u2019re back online.', type: 'info', icon: 'cloud-offline-outline' });
      router.dismissAll();
    }
  }, [user, holes, allScores, scoreMode, handicapStrokes, courseId, courseName, courseSlope, courseRating, coursePar, tripId, linkedSeasons, router, showToast]);

  // Match Play 1v1 live state (Stage 1 + Stage 2 wiring). When the round is
  // Match Play with exactly 2 players, resolve each side's player from
  // matchSides, derive each side's per-hole score (gross or net per the
  // user's matchScoreMode choice), and aggregate via formatMatchState.
  // Perspective comes from the user's matchPerspective choice (defaults to
  // whichever side contains the user). Returns null when not applicable so
  // consumers can early-out.
  const matchPlayState = useMemo<MatchPlayState | null>(() => {
    if (!isMatchPlay) return null;
    const playerA = players.find((p) => p.id === matchSides.sideA.playerIds[0]);
    const playerB = players.find((p) => p.id === matchSides.sideB.playerIds[0]);
    if (!playerA || !playerB) return null;

    let holesWonA = 0;
    let holesWonB = 0;
    let holesPlayed = 0;

    holes.forEach((h) => {
      const holeScores = allScores.get(h.number);
      if (!holeScores) return;
      const grossA = holeScores.get(playerA.id)?.gross;
      const grossB = holeScores.get(playerB.id)?.gross;
      if (grossA === undefined || grossB === undefined) return;

      const strokesA = matchScoreMode === 'net'
        ? (handicapStrokes.get(playerA.id)?.get(h.number) ?? 0)
        : 0;
      const strokesB = matchScoreMode === 'net'
        ? (handicapStrokes.get(playerB.id)?.get(h.number) ?? 0)
        : 0;

      const sideA = deriveSinglesSideScore(grossA, strokesA);
      const sideB = deriveSinglesSideScore(grossB, strokesB);
      if (sideA === null || sideB === null) return;

      holesPlayed++;
      if (sideA < sideB) holesWonA++;
      else if (sideB < sideA) holesWonB++;
      // halved: neither counter increments; holesPlayed still does.
    });

    return formatMatchState(holesWonA, holesWonB, holesPlayed, holes.length, matchPerspective);
  }, [isMatchPlay, players, matchSides, matchScoreMode, matchPerspective, allScores, handicapStrokes, holes]);

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

  // Low Ball / High Ball per-hole results + points
  const lowHighResults = useMemo(() => {
    const map = new Map<number, LowHighHoleResult>();
    if (!isLowHigh) return map;
    holes.forEach((h) => {
      const holeScores = allScores.get(h.number);
      if (!holeScores) return;
      const t1 = lowHighTeams.team1.map((pid) => holeScores.get(pid)?.gross).filter((v): v is number => typeof v === 'number');
      const t2 = lowHighTeams.team2.map((pid) => holeScores.get(pid)?.gross).filter((v): v is number => typeof v === 'number');
      if (t1.length < 2 || t2.length < 2) return;
      const t1Low = Math.min(...t1), t1High = Math.max(...t1);
      const t2Low = Math.min(...t2), t2High = Math.max(...t2);
      const lowBallWinner: 'team1' | 'team2' | 'halved' =
        t1Low < t2Low ? 'team1' : t2Low < t1Low ? 'team2' : 'halved';
      const highBallWinner: 'team1' | 'team2' | 'halved' =
        t1High < t2High ? 'team1' : t2High < t1High ? 'team2' : 'halved';
      const result: LowHighHoleResult = { lowBallWinner, highBallWinner };
      if (lowHighOptions.includeTotal) {
        const t1Sum = t1.reduce((a, b) => a + b, 0);
        const t2Sum = t2.reduce((a, b) => a + b, 0);
        result.totalWinner = t1Sum < t2Sum ? 'team1' : t2Sum < t1Sum ? 'team2' : 'halved';
      }
      if (lowHighOptions.birdieBonus && lowBallWinner !== 'halved') {
        const winnerLow = lowBallWinner === 'team1' ? t1Low : t2Low;
        if (winnerLow < h.par) result.birdieBonus = true;
      }
      map.set(h.number, result);
    });
    return map;
  }, [isLowHigh, allScores, holes, lowHighTeams, lowHighOptions]);

  const lowHighPoints: LowHighPoints = useMemo(() => {
    const acc = { team1: 0, team2: 0, lowT1: 0, lowT2: 0, highT1: 0, highT2: 0, totalT1: 0, totalT2: 0, carryover: 0 };
    if (!isLowHigh) return acc;
    let pendingLow = 0, pendingHigh = 0;
    const award = (winner: 'team1' | 'team2' | 'halved', bucket: 'low' | 'high', pts: number) => {
      if (winner === 'halved') {
        if (lowHighOptions.tieHandling === 'halve') {
          acc.team1 += pts / 2; acc.team2 += pts / 2;
          if (bucket === 'low') { acc.lowT1 += pts / 2; acc.lowT2 += pts / 2; }
          else { acc.highT1 += pts / 2; acc.highT2 += pts / 2; }
        } else if (lowHighOptions.tieHandling === 'carryover') {
          if (bucket === 'low') pendingLow += pts; else pendingHigh += pts;
        }
        return;
      }
      if (winner === 'team1') {
        acc.team1 += pts;
        if (bucket === 'low') acc.lowT1 += pts; else acc.highT1 += pts;
      } else {
        acc.team2 += pts;
        if (bucket === 'low') acc.lowT2 += pts; else acc.highT2 += pts;
      }
    };
    holes.forEach((h) => {
      const r = lowHighResults.get(h.number);
      if (!r) return;
      const lowPts = (r.birdieBonus ? 2 : 1) + pendingLow;
      if (r.lowBallWinner !== 'halved') {
        award(r.lowBallWinner, 'low', lowPts);
        pendingLow = 0;
      } else {
        award(r.lowBallWinner, 'low', r.birdieBonus ? 2 : 1);
        if (lowHighOptions.tieHandling !== 'carryover') pendingLow = 0;
      }

      const highPts = 1 + pendingHigh;
      if (r.highBallWinner !== 'halved') {
        award(r.highBallWinner, 'high', highPts);
        pendingHigh = 0;
      } else {
        award(r.highBallWinner, 'high', 1);
        if (lowHighOptions.tieHandling !== 'carryover') pendingHigh = 0;
      }

      if (lowHighOptions.includeTotal && r.totalWinner) {
        if (r.totalWinner === 'team1') { acc.team1 += 1; acc.totalT1 += 1; }
        else if (r.totalWinner === 'team2') { acc.team2 += 1; acc.totalT2 += 1; }
        else if (lowHighOptions.tieHandling === 'halve') {
          acc.team1 += 0.5; acc.team2 += 0.5; acc.totalT1 += 0.5; acc.totalT2 += 0.5;
        }
      }
    });
    acc.carryover = pendingLow + pendingHigh;
    return acc;
  }, [isLowHigh, holes, lowHighResults, lowHighOptions]);

  // 6-6-6: partnerships by segment
  const sixPartnerships = useCallback((segmentIdx: number): { team1: [string, string]; team2: [string, string] } => {
    const [A, B, C, D] = sixOrder;
    if (segmentIdx === 0) return { team1: [A, B], team2: [C, D] };
    if (segmentIdx === 1) return { team1: [A, C], team2: [B, D] };
    return { team1: [A, D], team2: [B, C] };
  }, [sixOrder]);

  const currentSixSegmentIdx = useMemo(() => {
    const holeNum = currentHole?.number ?? 1;
    if (holeNum <= 6) return 0;
    if (holeNum <= 12) return 1;
    return 2;
  }, [currentHole]);

  const sixSixSixResult: SixSixSixResult = useMemo(() => {
    const dots: Record<string, number> = {};
    sixOrder.forEach((pid) => { dots[pid] = 0; });
    const segments: SixSixSixSegment[] = [0, 1, 2].map((segIdx) => {
      const { team1, team2 } = sixPartnerships(segIdx);
      const holeResults: Record<number, 'team1' | 'team2' | 'halved'> = {};
      let t1Wins = 0, t2Wins = 0;
      const startHole = segIdx * 6 + 1;
      const endHole = startHole + 5;
      holes.forEach((h) => {
        if (h.number < startHole || h.number > endHole) return;
        const holeScores = allScores.get(h.number);
        if (!holeScores) return;
        const t1s = team1.map((pid) => holeScores.get(pid)?.gross).filter((v): v is number => typeof v === 'number');
        const t2s = team2.map((pid) => holeScores.get(pid)?.gross).filter((v): v is number => typeof v === 'number');
        if (t1s.length < 2 || t2s.length < 2) return;
        let t1Val = 0, t2Val = 0;
        if (sixScoringMethod === 'low_ball') {
          t1Val = Math.min(...t1s); t2Val = Math.min(...t2s);
        } else if (sixScoringMethod === 'combined') {
          t1Val = t1s.reduce((a, b) => a + b, 0); t2Val = t2s.reduce((a, b) => a + b, 0);
        } else {
          // match_play: low + high both count; net points settle winner
          const t1Low = Math.min(...t1s), t1High = Math.max(...t1s);
          const t2Low = Math.min(...t2s), t2High = Math.max(...t2s);
          let t1Pts = 0, t2Pts = 0;
          if (t1Low < t2Low) t1Pts++; else if (t2Low < t1Low) t2Pts++;
          if (t1High < t2High) t1Pts++; else if (t2High < t1High) t2Pts++;
          t1Val = -t1Pts; t2Val = -t2Pts;
        }
        let winner: 'team1' | 'team2' | 'halved';
        if (t1Val < t2Val) { winner = 'team1'; t1Wins++; team1.forEach((pid) => { dots[pid] = (dots[pid] ?? 0) + 1; }); }
        else if (t2Val < t1Val) { winner = 'team2'; t2Wins++; team2.forEach((pid) => { dots[pid] = (dots[pid] ?? 0) + 1; }); }
        else winner = 'halved';
        holeResults[h.number] = winner;
      });
      let winner: 'team1' | 'team2' | 'halved' | null = null;
      const scoredHoles = Object.keys(holeResults).length;
      if (scoredHoles >= 6) {
        winner = t1Wins > t2Wins ? 'team1' : t2Wins > t1Wins ? 'team2' : 'halved';
      }
      return { team1, team2, holeResults, team1Wins: t1Wins, team2Wins: t2Wins, winner };
    });
    return { segments, dots };
  }, [sixOrder, holes, allScores, sixScoringMethod, sixPartnerships]);

  // 3-Putt Poker: seed pot with ante
  const anteSeededRef = useRef(false);
  useEffect(() => {
    if (!isThreePuttPoker || anteSeededRef.current) return;
    anteSeededRef.current = true;
    setPokerPot((p) => p + players.length * pokerAnte);
  }, [isThreePuttPoker, players.length]);

  // 3-Putt Poker: deal cards + update pot based on hole scores
  useEffect(() => {
    if (!isThreePuttPoker) return;
    let deckIdx = pokerDeckIndex;
    let deckUsed = false;
    const nextPerPlayer = { ...pokerPerPlayer };
    const nextDealt = new Set(pokerDealtHoles);
    let potDelta = 0;
    let newWorstPutter = pokerWorstPutter;
    const dealtCards: PokerCardT[] = [];

    holes.forEach((h) => {
      const holeScores = allScores.get(h.number);
      if (!holeScores) return;
      players.forEach((p) => {
        const key = `${p.id}-${h.number}`;
        if (nextDealt.has(key)) return;
        const s = holeScores.get(p.id);
        if (!s) return;
        nextDealt.add(key);
        if (!nextPerPlayer[p.id]) {
          nextPerPlayer[p.id] = { cards: [], onePutts: 0, threePutts: 0, chipIns: 0 };
        }
        const putts = s.putts;
        const chipIn = putts === 0 && s.gross > 0; // holed out without putting
        let cardsToDeal = 0;
        if (chipIn) { cardsToDeal = 2; nextPerPlayer[p.id].chipIns++; }
        else if (putts === 1) { cardsToDeal = 1; nextPerPlayer[p.id].onePutts++; }
        if (putts >= 3) {
          nextPerPlayer[p.id].threePutts++;
          const extraPutts = putts - 2;
          potDelta += extraPutts * pokerThreePuttPenalty;
          newWorstPutter = p.id;
        }
        for (let i = 0; i < cardsToDeal; i++) {
          if (deckIdx < pokerDeck.length) {
            const card = pokerDeck[deckIdx++];
            nextPerPlayer[p.id].cards = [...nextPerPlayer[p.id].cards, card];
            dealtCards.push(card);
            deckUsed = true;
          }
        }
      });
    });

    if (deckUsed || potDelta !== 0 || newWorstPutter !== pokerWorstPutter) {
      setPokerPerPlayer(nextPerPlayer);
      setPokerDealtHoles(nextDealt);
      if (deckUsed) setPokerDeckIndex(deckIdx);
      if (potDelta !== 0) setPokerPot((p) => p + potDelta);
      if (newWorstPutter !== pokerWorstPutter) setPokerWorstPutter(newWorstPutter);

      // Cinematic moment detection for winning hands
      Object.entries(nextPerPlayer).forEach(([pid, st]) => {
        if (st.cards.length >= 5) {
          const ev = evaluateBestHand(st.cards);
          if (ev && (ev.rank === 'royal_flush' || ev.rank === 'straight_flush' || ev.rank === 'four_of_kind')) {
            const player = players.find((p) => p.id === pid);
            const momentType =
              ev.rank === 'royal_flush' ? 'ROYAL_FLUSH' :
              ev.rank === 'straight_flush' ? 'STRAIGHT_FLUSH' :
              'FOUR_OF_KIND';
            setDormieMoment((prev) => {
              if (prev.visible) return prev;
              return {
                visible: true,
                type: momentType as any,
                playerName: player ? (player.id === '1' ? 'You' : player.name) : 'Player',
                detail: ev.label,
              };
            });
          }
        }
      });
    }
  }, [isThreePuttPoker, allScores, holes, players, pokerDeck, pokerDeckIndex, pokerPerPlayer, pokerDealtHoles, pokerWorstPutter]);

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

  // Feature 12: Unread feed count
  const unreadFeedCount = scoringEvents.length - lastReadEventCount;

  // Feature 14: Players to show based on view mode
  const visiblePlayers = viewMode === 'solo' ? [players[soloPlayerIdx]] : players;

  return {
    // Theme & navigation
    theme,
    c,
    router,
    user,

    // Parsed params
    courseName,
    coursePar,
    courseSlope,
    courseRating,
    courseTee,
    courseId,
    holeRange,
    scoreMode,
    formatLabel,
    sideGameKeys,
    passedHoleData,
    roundType,
    seasonName,
    seasonWeek,
    seasonFormat,
    seasonMultiplier,
    linkedSeasons,
    tripId,
    matchupOpponent,
    linkedTrip,

    // Computed from params
    competitionTabs,
    players,
    holes,
    handicapStrokes,

    // Core scoring state
    currentHoleIdx,
    setCurrentHoleIdx,
    allScores,
    setAllScores,
    showSummary,
    setShowSummary,

    // Hammer
    hammerState,
    setHammerState,
    showHammerModal,
    setShowHammerModal,
    hammerResults,
    setHammerResults,

    // Putt distance
    puttDistPrompt,
    setPuttDistPrompt,
    puttDist,
    setPuttDist,

    // Match Play 1v1 (Stage 1 — singles + Stage 2 — placeholder setup)
    isMatchPlay,
    matchPlayState,
    matchSides,
    setMatchSides,
    matchScoreMode,
    setMatchScoreMode,
    matchPerspective,
    setMatchPerspective,
    showMatchPlaySetup,
    setShowMatchPlaySetup,

    // Best Ball
    isBestBall,
    bestBallTeams,
    setBestBallTeams,
    showBestBallSetup,
    setShowBestBallSetup,

    // Low Ball / High Ball
    isLowHigh,
    lowHighTeams,
    setLowHighTeams,
    lowHighOptions,
    setLowHighOptions,
    showLowHighSetup,
    setShowLowHighSetup,
    lowHighResults,
    lowHighPoints,

    // 6-6-6
    isSixSixSix,
    sixOrder,
    setSixOrder,
    sixScoringMethod,
    setSixScoringMethod,
    showSixSetup,
    setShowSixSetup,
    sixSegmentBanner,
    setSixSegmentBanner,
    currentSixSegmentIdx,
    sixPartnerships,
    sixSixSixResult,

    // 3-Putt Poker
    isThreePuttPoker,
    pokerPerPlayer,
    pokerPot,
    pokerWorstPutter,

    // Hole notes
    holeNotes,
    setHoleNotes,
    showNoteModal,
    setShowNoteModal,
    noteText,
    setNoteText,

    // Confirmation
    showConfirmation,
    setShowConfirmation,

    // Leaderboard
    showLeaderboard,
    setShowLeaderboard,
    activeCompTab,
    setActiveCompTab,

    // Live feed
    scoringEvents,
    setScoringEvents,
    showFeed,
    setShowFeed,
    lastReadEventCount,
    setLastReadEventCount,

    // Side game running panel
    showRunningPanel,
    setShowRunningPanel,

    // View mode
    viewMode,
    setViewMode,
    soloPlayerIdx,
    setSoloPlayerIdx,

    // Side game ticker
    sideGameTickerExpanded,
    setSideGameTickerExpanded,

    // Dormie Moment
    dormieMoment,
    setDormieMoment,

    // Confetti & personal best
    showConfetti,
    setShowConfetti,
    showPersonalBest,
    setShowPersonalBest,
    prevBest,
    setPrevBest,
    showToast,

    // Side game toast
    sideGameToastEvents,
    setSideGameToastEvents,
    sideGameEventSlice,
    setSideGameEventSlice,

    // Wolf
    wolfOrder,
    wolfHoleDecisions,
    setWolfHoleDecisions,
    showWolfModal,
    setShowWolfModal,
    wolfPickStep,
    setWolfPickStep,

    // BBB
    bbbHolePoints,
    setBBBHolePoints,
    showBangoPrompt,
    setShowBangoPrompt,
    bangoHoleNumber,
    setBangoHoleNumber,

    // Transition banner
    transitionBanner,
    setTransitionBanner,

    // Derived / computed
    currentHole,
    isOffline,
    currentHoleScores,
    currentWolfIdx,
    currentWolfId,
    currentWolfDecision,
    holesScored,
    isLastHole,
    bestBallTeamScores,
    leaderboardData,
    unreadFeedCount,
    visiblePlayers,

    // Callbacks
    getPlayerScore,
    updatePlayerScore,
    getRunningTotal,
    generateEvents,
    checkDormieMoments,
    detectToastEventsLocal,
    showTransitionBanner,
    handleNext,
    handlePuttDistSelect,
    handlePrev,
    handleFinish,
    handlePostRound,

    // Mock data references (used by UI for season/trip views)
    MOCK_GROUP_PLAYERS,
    MOCK_UPCOMING_TRIPS,
  };
}
