import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import {
  SCORING_FORMATS,
  SIDE_GAMES,
  type ScoringFormat,
  type SideGame,
} from '../../data/scoring';


// ─── Question schemas ────────────────────────────────────────────────
// One question per step. Spec is fixed: 3 questions for formats, 3 for
// side games. Adjust copy here without touching the recommendation
// lookup tables (keys are stable).

type Question<TAnswerId extends string = string> = {
  key: string;
  prompt: string;
  options: { id: TAnswerId; label: string }[];
};

const FORMAT_QUESTIONS: Question[] = [
  {
    key: 'competitive',
    prompt: 'How competitive is the group?',
    options: [
      { id: 'casual', label: 'Casual' },
      { id: 'mixed', label: 'Mixed' },
      { id: 'serious', label: 'Serious' },
    ],
  },
  {
    key: 'team',
    prompt: 'Team or individual?',
    options: [
      { id: 'individual', label: 'Each for themselves' },
      { id: 'pairs', label: 'Pairs' },
      { id: 'bigger', label: 'Bigger teams' },
    ],
  },
  {
    key: 'scoring',
    prompt: 'Simple or interesting scoring?',
    options: [
      { id: 'simple', label: 'Just count strokes' },
      { id: 'dynamic', label: 'Something more dynamic' },
    ],
  },
];

const SIDE_GAME_QUESTIONS: Question[] = [
  {
    key: 'stakes',
    prompt: 'How fun-vs-serious?',
    options: [
      { id: 'low', label: 'Low-stakes' },
      { id: 'medium', label: 'Medium' },
      { id: 'real', label: 'Real money on the line' },
    ],
  },
  {
    key: 'complexity',
    prompt: 'Simple or complex?',
    options: [
      { id: 'easy', label: 'Easy to track' },
      { id: 'strategic', label: 'Strategic depth ok' },
    ],
  },
  {
    key: 'group',
    prompt: 'What kind of group?',
    options: [
      { id: 'friends', label: 'All friends' },
      { id: 'mixed', label: 'Mix of skill levels' },
      { id: 'strangers', label: 'Strangers / work group' },
    ],
  },
];

// ─── Recommendation lookup tables ────────────────────────────────────
// Pure data, no heuristic magic. Each tuple of answers maps to a single
// recommendation + rationale string. Tune individual mappings without
// touching the recommendFormat / recommendSideGame functions below.
//
// Keys are `${answer1}|${answer2}|${answer3}` in the order the questions
// are asked.

type FormatRec = { format: ScoringFormat; rationale: string };
type SideGameRec = { game: SideGame; rationale: string };

const FORMAT_LOOKUP: Record<string, FormatRec> = {
  // ─── Individual play ───
  'casual|individual|simple': {
    format: 'stroke_play',
    rationale: 'Cleanest format — every stroke counts, lowest total wins.',
  },
  'casual|individual|dynamic': {
    format: 'stableford',
    rationale: 'Points-based scoring keeps a blow-up hole from killing the round. Forgiving and fast.',
  },
  'mixed|individual|simple': {
    format: 'stroke_play',
    rationale: 'Universal format — works whether someone shoots 75 or 105.',
  },
  'mixed|individual|dynamic': {
    format: 'stableford',
    rationale: 'Per-hole points reward a good hole and limit damage on a bad one. Fits mixed handicaps.',
  },
  'serious|individual|simple': {
    format: 'stroke_play',
    rationale: 'Tournament default — a true measure of who played best.',
  },
  'serious|individual|dynamic': {
    format: 'modified_stableford',
    rationale: 'Aggressive points reward going for the green. Punishes the safe play just enough.',
  },

  // ─── Pairs ───
  'casual|pairs|simple': {
    format: 'best_ball',
    rationale: 'One partner can save the team on a tough hole — keeps the pressure off both.',
  },
  'casual|pairs|dynamic': {
    format: 'best_ball',
    rationale: 'Every hole is its own battle, lower partner score wins.',
  },
  'mixed|pairs|simple': {
    format: 'best_ball',
    rationale: 'Better-ball lets the stronger player carry the team without burying the partner.',
  },
  'mixed|pairs|dynamic': {
    format: 'match_play',
    rationale: 'Per-hole pressure resets every tee — bad holes don\'t snowball.',
  },
  'serious|pairs|simple': {
    format: 'match_play',
    rationale: 'Head-to-head is the partner-format default for serious players.',
  },
  'serious|pairs|dynamic': {
    format: 'low_high',
    rationale: '2v2 with two scores per hole — both partners feel pressure on every stroke.',
  },

  // ─── Bigger teams ───
  'casual|bigger|simple': {
    format: 'scramble',
    rationale: 'Everyone tees off, pick the best, repeat. Forgiving and fast — even with a beginner in the group.',
  },
  'casual|bigger|dynamic': {
    format: 'shamble',
    rationale: 'Best drive, then play your own ball — scramble safety with individual play.',
  },
  'mixed|bigger|simple': {
    format: 'fourball',
    rationale: 'Two-person teams within the foursome. Best individual score per hole counts.',
  },
  'mixed|bigger|dynamic': {
    format: 'wolf',
    rationale: 'The Wolf rotates — partner up or go solo for double. Every hole has a decision.',
  },
  'serious|bigger|simple': {
    format: 'fourball',
    rationale: 'The Ryder Cup partner-format default. Every player\'s round still matters.',
  },
  'serious|bigger|dynamic': {
    format: 'wolf',
    rationale: 'Strategic foursome format with rotating partnerships and Lone Wolf double-or-nothing.',
  },
};

const SIDE_GAME_LOOKUP: Record<string, SideGameRec> = {
  // ─── Low stakes ───
  'low|easy|friends': {
    game: 'snake',
    rationale: 'Light pressure on the greens — whoever 3-putts last pays. More about pride than money.',
  },
  'low|easy|mixed': {
    game: 'greenies',
    rationale: 'Closest-to-pin on par 3s. Easy to explain, low stakes, no handicap required.',
  },
  'low|easy|strangers': {
    game: 'close_shave',
    rationale: 'Closest to pin on a designated par 3 — simplest side bet there is.',
  },
  'low|strategic|friends': {
    game: 'dots',
    rationale: 'Design your own dot list together — strategic and social.',
  },
  'low|strategic|mixed': {
    game: 'bingo_bango_bongo',
    rationale: 'Three points per hole equalizes mixed handicaps — high handicappers get points just for being away first.',
  },
  'low|strategic|strangers': {
    game: 'bingo_bango_bongo',
    rationale: 'Strategic depth without favoring the low handicapper. Keeps everyone in it.',
  },

  // ─── Medium stakes ───
  'medium|easy|friends': {
    game: 'skins',
    rationale: 'Classic side bet — every halved hole grows the pot for the next.',
  },
  'medium|easy|mixed': {
    game: 'greenies',
    rationale: 'Par 3 only, easy to track, fits any group regardless of handicap.',
  },
  'medium|easy|strangers': {
    game: 'skins',
    rationale: 'Universal — easy to explain in one sentence, works between players who don\'t know each other.',
  },
  'medium|strategic|friends': {
    game: 'nassau',
    rationale: 'Three bets in one — front 9, back 9, overall. Survives a bad start.',
  },
  'medium|strategic|mixed': {
    game: 'bingo_bango_bongo',
    rationale: 'Strategic depth without favoring the scratch player. Keeps mid-handicappers competitive.',
  },
  'medium|strategic|strangers': {
    game: 'nassau',
    rationale: 'Standard side bet — assumes everyone knows the rules. Three bets running simultaneously.',
  },

  // ─── Real money ───
  'real|easy|friends': {
    game: 'skins',
    rationale: 'Carry-overs make every halved hole bigger — pots can grow fast with real money.',
  },
  'real|easy|mixed': {
    game: 'skins',
    rationale: 'Carry-over math is universal regardless of skill level.',
  },
  'real|easy|strangers': {
    game: 'nassau',
    rationale: 'Front 9 / back 9 / total — everyone knows the rules.',
  },
  'real|strategic|friends': {
    game: 'hammer',
    rationale: 'Doubling at any point — high reward for confident players who want to swing the round on a single hole.',
  },
  'real|strategic|mixed': {
    game: 'nassau',
    rationale: 'Three bets running, presses available — depth without runaway escalation.',
  },
  'real|strategic|strangers': {
    game: 'nassau',
    rationale: 'Standard for cash play with strangers — three bets running, presses available for depth without escalation.',
  },
};

const FORMAT_FALLBACK: FormatRec = {
  format: 'stroke_play',
  rationale: 'Stroke Play — clean head-to-head measure of who played best across the round.',
};

const SIDE_GAME_FALLBACK: SideGameRec = {
  game: 'skins',
  rationale: 'Skins — classic side bet, easy to track, carry-overs keep every hole interesting.',
};

function recommendFormat(answers: Record<string, string>): FormatRec {
  const key = `${answers.competitive}|${answers.team}|${answers.scoring}`;
  return FORMAT_LOOKUP[key] ?? FORMAT_FALLBACK;
}

function recommendSideGame(answers: Record<string, string>): SideGameRec {
  const key = `${answers.stakes}|${answers.complexity}|${answers.group}`;
  return SIDE_GAME_LOOKUP[key] ?? SIDE_GAME_FALLBACK;
}

// ─── Component ───────────────────────────────────────────────────────

export interface HelpMeChooseProps {
  visible: boolean;
  mode: 'format' | 'sideGame';
  onComplete: (recommendation: ScoringFormat | SideGame, rationale: string) => void;
  onCancel: () => void;
}

export function HelpMeChoose({ visible, mode, onComplete, onCancel }: HelpMeChooseProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const questions = mode === 'format' ? FORMAT_QUESTIONS : SIDE_GAME_QUESTIONS;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showRec, setShowRec] = useState(false);

  // Modal entrance animation
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  // Recommendation reveal animation
  const recOpacity = useRef(new Animated.Value(0)).current;
  const recTranslate = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (visible) {
      // Fresh state every open
      setStep(0);
      setAnswers({});
      setShowRec(false);
      cardScale.setValue(0.96);
      overlayOpacity.setValue(0);
      recOpacity.setValue(0);
      recTranslate.setValue(8);
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, cardScale, overlayOpacity, recOpacity, recTranslate]);

  useEffect(() => {
    if (showRec) {
      recOpacity.setValue(0);
      recTranslate.setValue(8);
      Animated.parallel([
        Animated.spring(recOpacity, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(recTranslate, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [showRec, recOpacity, recTranslate]);

  const handleAnswer = (q: Question, optionId: string) => {
    haptics.light();
    const next = { ...answers, [q.key]: optionId };
    setAnswers(next);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setShowRec(true);
    }
  };

  const recommendation = useMemo(() => {
    if (!showRec) return null;
    if (mode === 'format') {
      const rec = recommendFormat(answers);
      const info = SCORING_FORMATS.find((f) => f.key === rec.format);
      return {
        key: rec.format as ScoringFormat | SideGame,
        label: info?.label ?? rec.format,
        rationale: rec.rationale,
      };
    }
    const rec = recommendSideGame(answers);
    const info = SIDE_GAMES.find((g) => g.key === rec.game);
    return {
      key: rec.game as ScoringFormat | SideGame,
      label: info?.label ?? rec.game,
      rationale: rec.rationale,
    };
  }, [showRec, mode, answers]);

  const handleAccept = () => {
    if (!recommendation) return;
    haptics.success();
    onComplete(recommendation.key, recommendation.rationale);
  };

  const handleShowOthers = () => {
    haptics.light();
    onCancel();
  };

  const handleClose = () => {
    haptics.light();
    onCancel();
  };

  const currentQuestion = questions[step];
  const useThisLabel = mode === 'format' ? 'Use this format' : 'Use this game';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Animated.View style={[s.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={s.backdrop} onPress={handleClose} />
        <Animated.View
          style={[
            s.card,
            {
              backgroundColor: c.elevated,
              borderColor: c.border,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {!showRec ? (
              <>
                {/* Progress indicator */}
                <Text style={[s.progress, { color: c.textMuted, fontFamily: GEO }]}>
                  {`Q${step + 1} / ${questions.length}`}
                </Text>

                {/* Question prompt */}
                <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
                  {currentQuestion.prompt}
                </Text>

                {/* Options stacked vertically */}
                <View style={s.optionsCol}>
                  {currentQuestion.options.map((opt) => (
                    <Pressable
                      key={opt.id}
                      onPress={() => handleAnswer(currentQuestion, opt.id)}
                      style={({ pressed }) => [
                        s.option,
                        {
                          backgroundColor: c.elevated,
                          borderColor: c.border,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[s.optionText, { color: c.text, fontFamily: GEO }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : recommendation ? (
              <Animated.View
                style={{
                  opacity: recOpacity,
                  transform: [{ translateY: recTranslate }],
                }}
              >
                <Text style={[s.recHeader, { color: c.gold, fontFamily: GEO }]}>WE RECOMMEND</Text>
                <Text style={[s.recTitle, { color: c.text, fontFamily: GEO }]}>
                  {recommendation.label}
                </Text>
                <View style={[s.divider, { backgroundColor: c.border }]} />
                <Text style={[s.recRationale, { color: c.text }]}>
                  {recommendation.rationale}
                </Text>
              </Animated.View>
            ) : null}
          </ScrollView>

          {/* Footer actions */}
          {!showRec ? (
            <Pressable onPress={handleClose} style={s.cancelLink}>
              <Text style={[s.cancelLinkText, { color: c.textMuted }]}>Cancel</Text>
            </Pressable>
          ) : (
            <View>
              <Pressable
                onPress={handleAccept}
                style={({ pressed }) => [
                  s.primaryBtn,
                  { backgroundColor: '#006747', opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[s.primaryBtnText, { color: '#C9A227', fontFamily: GEO }]}>
                  {useThisLabel}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleShowOthers}
                style={({ pressed }) => [
                  s.secondaryBtn,
                  { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[s.secondaryBtnText, { color: c.textMuted }]}>
                  Show me other options
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderWidth: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 16,
  },

  /* Question state */
  progress: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  prompt: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 10,
    lineHeight: 28,
  },
  optionsCol: {
    marginTop: 20,
    gap: 8,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cancelLink: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLinkText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  /* Recommendation state */
  recHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  recTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 8,
  },
  divider: {
    height: 1,
    marginTop: 16,
    marginBottom: 14,
  },
  recRationale: {
    fontSize: 14,
    lineHeight: 20,
  },

  /* Footer buttons */
  primaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
