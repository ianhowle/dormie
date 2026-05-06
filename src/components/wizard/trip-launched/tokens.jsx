// =============================================================
// DormieMomentTripLaunched — Locked Token Specification
// =============================================================
// Hand-off-to-Claude-Code source of truth. Every constant in this
// file is a contract: implementations in React Native should mirror
// these exact values.
// =============================================================

const TL = {
  // ─── COLORS ────────────────────────────────────────────────
  bg:               '#000000',
  stage:            '#0D0A06',
  surface:          '#151312',

  augustaGreen:     '#006747',
  mastersGreen:     '#1E4D2B',
  greenDeep:        '#0D2818',

  // Default Ryder Cup team accents (override via trip.teams[a|b].color)
  teamUsaRed:       '#7A2222',
  teamEuropeBlue:   '#1E3A5F',
  teamUsaGlow:      'rgba(122,34,34,0.20)',
  teamEuropeGlow:   'rgba(30,58,95,0.22)',
  captainPipColor:  '#D4AF37',

  brandGold:        '#C9A227',
  championshipGold: '#D4AF37',
  goldDeep:         '#B8860B',
  goldGlow:         'rgba(212,175,55,0.55)',

  text:             '#E8E4DE',
  textMuted:        '#8A857F',
  textTertiary:     '#6B6560',

  liveAmber:        '#F2A93B',
  pinstripe:        'rgba(255,255,255,0.03)',

  stageGradient:
    'linear-gradient(180deg, #1E4D2B 0%, #0D2818 38%, #0D0A06 78%, #000000 100%)',

  // ─── LAYOUT (390 × 844 viewport) ──────────────────────────
  viewportW:        390,
  viewportH:        844,
  letterboxBarH:    72,
  stageInset:       72,
  contentPadX:      28,
  contentSafeT:     32,

  cornerSize:       22,
  cornerInset:      14,
  cornerStroke:     1.5,

  // Destination — adaptive sizing by character count:
  //   ≤ 9   → 64pt single line   (Pinehurst, Hermitage)
  //   10–13 → 52pt single line   (Bandon Dunes, Pebble Beach)
  //   14–19 → 44pt up-to-2 lines (Whistling Straits, Streamsong Resort)
  //   20+   → 36pt up-to-2 lines (Tennessee Three-Course Tour)
  destinationFontSize:  64,
  destinationLineH:     1.0,
  destinationTracking:  -2.5,
  destinationItalic:    true,
  destinationBlockTop:    100,
  destinationBlockHeight: 110,

  // BASE positions; layoutShift adds vertical offset when destination
  // wraps (+36) and/or subtitle is present (+14).
  dateBlockTop:           220,
  hairlineTop:            280,
  avatarRailTop:          308,
  layoutShiftTwoLine:     36,
  layoutShiftSubtitle:    14,

  dateFontSize:         22,
  dateTracking:         -0.4,
  dateMarginTop:        12,
  dateSubtitleMarginTop: 14,

  hairlineH:            1,
  hairlineColor:        'rgba(201,162,39,0.5)',
  hairlineMarginTop:    24,
  hairlineWidth:        0.42,

  avatarSize:           44,
  avatarGap:            8,
  avatarBorderW:        1,
  avatarRailMarginTop:  36,
  avatarTopPadding:     12, // reserved for captain-pip space; uniform across all

  // Ryder Cup team-rail spacing (visible-gap targets ≥18px)
  ryderLabelOffset:     32, // distance from team label TOP to first avatar TOP
  ryderInterRailGap:    32, // gap between Team A row bottom and Team B label top

  // Captain pip
  captainPipSize:       7,
  captainPipOffsetTop:  -12,
  captainPipGlow:       6,

  sentenceFontSize:     18,
  sentenceTracking:     -0.2,
  sentenceItalic:       true,
  sentenceMarginTop:    24,

  youUnderlineThickness: 1.5,
  youUnderlineInset:     2,
  youUnderlineColor:     '#D4AF37',

  stakesFontSize:       10,
  stakesTracking:       2.4,
  stakesMarginTop:      28,

  ctaBaseline:          'letterbox',
  ctaFontSize:          12,
  ctaTracking:          2.8,
  ctaArrowExtension:    14,

  liveDotSize:          6,
  liveDotInsetT:        20,
  liveDotInsetR:        20,

  // ─── TYPE ──────────────────────────────────────────────────
  fontGeo:  'Georgia, "Times New Roman", serif',
  fontSans: '-apple-system, "SF Pro Text", "Inter", system-ui, sans-serif',
  weightDestination: 400,
  weightNameRoster:  700,
  weightStakes:      600,
  weightCta:         700,

  // ─── ANIMATION ─────────────────────────────────────────────
  totalDuration:    4800, // baseline; computeTotalDuration() returns actual
  beats: {
    arrival: {
      start: 0, end: 1000,
      letterboxIn:        { start:    0, end:  600, easing: 'cubicOut' },
      stageGradientFade:  { start:  100, end:  700, easing: 'cubicOut' },
      cornersDrawIn:      { start:  400, end:  900, easing: 'cubicInOut' },
      pinstripePulse:     { start:  650, end:  900, easing: 'cubicOut' },
      kickerIn:           { start:  700, end: 1000, easing: 'cubicOut' },
    },
    recognition: {
      start: 1000, end: 2500,
      destinationRise:    { start: 1000, end: 1700, easing: 'cubicOut',
                            translateY: { from: 24, to: 0 }, opacity: { from: 0, to: 1 } },
      destinationGlow:    { start: 1500, end: 2300, easing: 'cubicInOut' },
      dateIn:             { start: 1900, end: 2200, easing: 'cubicOut' },
      hairlineDraw:       { start: 2100, end: 2500, easing: 'cubicInOut' },
    },
    momentum: {
      start: 2500, end: 4000,
      avatarRollCall: {
        firstAvatarStart: 2500,
        cadence: 180,           // 110 for N≥9
        perAvatarDuration: 320,
        easing: 'cubicOut',
      },
      sentenceTypeOn: {
        startsAfterLastAvatar: 200,
        msPerChar: 30,
        maxDuration: 800,
        youUnderlineDelay: 200,
        youUnderlineDuration: 380,
        youUnderlineEasing: 'cubicInOut',
      },
    },
    invitation: {
      start: 4000, end: 4800,
      stakesIn:           { start: 4000, end: 4300, easing: 'cubicOut' },
      ctaArrowExtend:     { start: 4200, end: 4600, easing: 'cubicOut' },
      liveAmberStart:     { start: 4400 },
      ctaInteractive:     { start: 4600 },
    },
  },

  // ─── HAPTICS ───────────────────────────────────────────────
  haptics: {
    arrival:    { at:    0, type: 'impactHeavy' },
    destination:{ at: 1700, type: 'impactLight' },
    rollCall: {
      offsetFromAvatarLand: 0,
      ramp: ['impactLight','impactLight','impactMedium','impactMedium','impactHeavy','impactHeavy'],
      maxHits: 6,
    },
    youUnderline: { at: 'youUnderlineStart', type: 'selection' },
    ctaReady:   { at: 4600, type: 'impactLight' },
  },

  // ─── SOUND ─────────────────────────────────────────────────
  sound: { enabled: false },

  // ─── ADAPTIVE TIME ─────────────────────────────────────────
  timeThresholds: {
    teeTimeMaxMs:     24 * 60 * 60 * 1000,
    dateRangeMaxMs:   30 * 24 * 60 * 60 * 1000,
  },

  // ─── EDGE CASES ────────────────────────────────────────────
  edgeCases: {
    solo: {
      sentenceTemplate: 'Just you.',
      hapticOverride:   'impactMedium',
    },
    medium: { avatarSize: 40, avatarGap: 6, sentenceFormat: 'list' },
    large:  { avatarSize: 36, avatarGap: 5, avatarRows: 2, sentenceFormat: 'summary', cadenceOverride: 110 },
  },

  avatarFallback: {
    palette: ['#3A2F26','#2E3A2F','#3A3026','#2A2F3A','#3A2A2F','#2F2A26'],
    monogramFont: 'Georgia, serif',
    monogramSize: 18,
    monogramColor: '#E8E4DE',
    monogramWeight: 700,
  },
};

export default TL;
