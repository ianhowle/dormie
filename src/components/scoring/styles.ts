import { StyleSheet, Platform, StatusBar } from 'react-native';
import { GEO } from '../../theme/fonts';

export const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

export const scoringStyles = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerCourseName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerThrough: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: GEO,
  },
  headerHoleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  headerHoleLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerHoleNum: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    fontFamily: GEO,
  },
  headerParBadge: {
    alignItems: 'center',
  },
  headerParLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerParValue: {
    color: '#C9A227',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },
  headerFormat: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 4,
  },

  /* Hole strip */
  holeStrip: {
    borderBottomWidth: 1,
    maxHeight: 58,
  },
  holeStripContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 6,
  },
  holeChip: {
    width: 40,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  holeChipNum: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: GEO,
  },
  holeChipPar: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: -1,
    fontFamily: GEO,
  },

  /* Scoring body */
  scoringBody: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },

  /* Player card */
  playerCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  playerNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  strokeDot: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strokeDotText: {
    color: '#1E4D2B',
    fontSize: 10,
    fontWeight: '800',
  },
  runningWrap: {
    alignItems: 'flex-end',
  },
  runningTotal: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },
  runningLabel: {
    fontSize: 10,
    marginTop: 1,
  },

  /* Score input */
  scoreInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
  },
  scoreBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scoreCenterWrap: {
    alignItems: 'center',
    minWidth: 80,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '700',
    fontFamily: GEO,
    letterSpacing: -1,
  },
  netScore: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: -4,
  },
  scoreLabelText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },

  /* Secondary inputs */
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  secondaryGroup: {
    alignItems: 'center',
    gap: 4,
  },
  secondaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  miniValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  puttsButtonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  puttsButton: {
    // ≥44pt tap target (Apple HIG / accessible-touch minimum). The
    // earlier 36×32 was below comfortable size for a gloved, outdoor,
    // one-handed context; a mis-tap silently corrupts stats.
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  puttsButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  toggleChip: {
    // ≥44pt tap target — see puttsButton note above.
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  /* Result banner */
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  resultText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Nav buttons */
  navRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navFinish: {
    borderWidth: 0,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Section title (shared) */
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  /* Post-round summary */
  summaryScreen: {
    flex: 1,
  },
  summaryHeader: {
    paddingTop: STATUS_BAR_H + 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  summarySubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
  },
  summaryBody: {
    paddingHorizontal: 16,
  },

  /* Summary table */
  summaryTable: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  summaryColHeader: {
    color: '#E8E4DE',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryColPos: {
    width: 32,
    textAlign: 'center',
  },
  summaryColName: {
    flex: 1,
    paddingRight: 4,
  },
  summaryColNum: {
    width: 48,
    textAlign: 'right',
    fontSize: 14,
  },
  summaryPosText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryPlayerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryPlayerName: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Stat cards */
  statCard: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statCardName: {
    fontSize: 13,
    fontWeight: '600',
  },
  statCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  miniStat: {
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: GEO,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 3,
    textTransform: 'uppercase',
  },

  /* Done button */
  doneBtn: {
    marginTop: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Header actions (Features 11, 12, 14) */
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionBtn: {
    position: 'relative',
  },
  feedBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#C41E3A',
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },

  /* Feature 2: Penalty toggle + row */
  penaltyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
  },
  penaltyToggleLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  penaltyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
    paddingTop: 4,
  },
  penaltyGroup: {
    alignItems: 'center',
    gap: 3,
  },
  penaltyLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  penaltyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  penaltyValue: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
    fontFamily: GEO,
  },

  /* Feature 2: Hole chip indicators */
  holeChipPenaltyDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 5,
    height: 5,
    backgroundColor: '#C41E3A',
  },
  holeChipNoteDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 5,
    height: 5,
  },

  /* Feature 7: Score entry grid — 2x4 layout */
  scoreGrid2Row: {
    gap: 6,
    marginBottom: 8,
  },
  scoreGridRowInner: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  scoreGridCell2: {
    flex: 1,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scoreGridText2: {
    fontSize: 22,
    fontFamily: GEO,
    fontWeight: '700',
  },
  scoreGridParLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  // Keep legacy name for compact grid references
  scoreGridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  scoreGridCell: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scoreGridText: {
    fontSize: 18,
    fontFamily: GEO,
    fontWeight: '700',
  },
  highScoreStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },

  /* Feature 6: Hole tools */
  holeToolsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  holeToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  holeToolLabel: {
    fontSize: 10,
    fontWeight: '600',
  },

  /* Feature 6: Note input */
  noteInput: {
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 12,
  },

  /* Feature 1: Hammer */
  hammerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  hammerBtnText: {
    color: '#1E4D2B',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  hammerMultiplierBadge: {
    backgroundColor: '#1E4D2B',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hammerMultiplierText: {
    color: '#C9A227',
    fontSize: 11,
    fontWeight: '700',
  },
  hammerMultiplierDisplay: {
    fontSize: 20,
    fontWeight: '700',
    marginVertical: 8,
    textAlign: 'center',
  },

  /* Modals (shared) */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: GEO,
    textTransform: 'uppercase',
  },
  modalText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Feature 3: Putt distance */
  puttDistGrid: {
    gap: 8,
  },
  puttDistBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  puttDistBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Feature 4: Best Ball */
  bestBallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  bestBallTeam: {
    alignItems: 'center',
    flex: 1,
  },
  bestBallTeamLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bestBallTeamScore: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },
  bestBallVs: {
    fontSize: 11,
    fontWeight: '600',
  },
  bestBallSetupRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  bestBallColumn: {
    flex: 1,
    gap: 8,
  },
  bestBallColumnTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  bestBallPlayerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
  },
  bestBallPlayerName: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Feature 10: Confirmation */
  confirmHeader: {
    paddingTop: STATUS_BAR_H + 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  confirmTitle: {
    color: '#C9A227',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  confirmSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  confirmTotalsRow: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  confirmPlayerTotals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  confirmPlayerName: {
    fontSize: 13,
    fontWeight: '600',
    width: 60,
  },
  confirmNineTotals: {
    flexDirection: 'row',
    gap: 16,
  },
  confirmNineItem: {
    alignItems: 'center',
  },
  confirmNineLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  confirmNineValue: {
    fontSize: 18,
    fontWeight: '600',
  },

  /* Feature 11: Leaderboard */
  leaderboardScreen: {
    flex: 1,
    paddingTop: STATUS_BAR_H,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  leaderboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: GEO,
  },
  leaderboardCourse: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  lbPos: {
    color: '#C9A227',
    fontSize: 18,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
    fontFamily: GEO,
  },
  lbNameWrap: {
    flex: 1,
  },
  lbName: {
    color: '#E8E4DE',
    fontSize: 14,
    fontWeight: '500',
  },
  lbThru: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 1,
  },
  lbTotal: {
    color: '#E8E4DE',
    fontSize: 20,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
    fontFamily: GEO,
  },
  lbToPar: {
    fontSize: 14,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
    fontFamily: GEO,
  },

  /* Competition tab pills */
  compTabRow: {
    flexDirection: 'row',
    gap: 0,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  compTabPill: {
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compTabPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  compBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#C9A227',
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compBadgeText: {
    color: '#1E4D2B',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: GEO,
  },

  /* Season view */
  seasonViewHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  seasonViewTitle: {
    color: '#C9A227',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  seasonViewMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 4,
  },
  seasonProjectedCard: {
    backgroundColor: 'rgba(201,162,39,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.3)',
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  seasonProjectedLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  seasonProjectedValue: {
    color: '#C9A227',
    fontSize: 32,
    fontWeight: '700',
  },
  seasonProjectedSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 4,
  },
  seasonStandingsTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  /* Matchup view */
  matchupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  matchupPlayerCol: {
    alignItems: 'center',
    gap: 6,
  },
  matchupPlayerName: {
    color: '#E8E4DE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  matchupVs: {
    paddingHorizontal: 12,
  },
  matchupVsText: {
    color: '#C9A227',
    fontSize: 18,
    fontWeight: '700',
  },
  matchStatusBanner: {
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  matchStatusText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  matchupGrid: {
    marginBottom: 16,
  },
  matchupGridHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  matchupGridRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  matchupGridCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchupGridHole: {
    width: 40,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  matchupGridScore: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  matchupGridResult: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchupWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  matchupWaitingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontStyle: 'italic',
  },

  /* Feature 12: Live feed */
  feedContainer: {
    padding: 20,
  },
  feedTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  feedEmpty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 40,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  feedItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  feedItemTime: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: GEO,
  },

  /* Feature 13: Running panel */
  runningPanelWrap: {
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  runningPanelToggle: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  runningPanelToggleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  runningPanelContent: {
    padding: 12,
  },
  runningGameSection: {
    marginBottom: 10,
  },
  runningGameTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  runningGameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  runningGameName: {
    fontSize: 12,
    fontWeight: '500',
  },
  runningGameValue: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: GEO,
  },
  runningGameNote: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },

  /* Feature 14: Solo mode nav */
  soloNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 10,
  },
  soloNavText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Feature 14: Compact player card */
  playerCardCompact: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  compactName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  compactRunning: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactGrid: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },
  compactGridCell: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  compactGridText: {
    fontSize: 14,
    fontFamily: GEO,
    fontWeight: '700',
  },
  compactPuttsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  compactPuttsLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  compactPuttsValue: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
    fontFamily: GEO,
  },

  /* Feature 24: Season banner */
  seasonBanner: {
    backgroundColor: '#C9A227',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 10,
  },
  seasonBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seasonBannerName: {
    color: '#1E4D2B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  seasonBannerWeek: {
    color: '#1E4D2B',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.8,
  },
  seasonBannerFormat: {
    color: '#1E4D2B',
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.7,
  },
  seasonMultiplierBadge: {
    backgroundColor: '#1E4D2B',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  seasonMultiplierText: {
    color: '#C9A227',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Item 11: Header hole detail */
  headerHoleDetail: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  /* Item 35: Round type badge + format row */
  headerFormatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  roundTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roundTypeBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },

  /* Item 8: Side game ticker */
  sideGameTicker: {
    backgroundColor: '#1E4D2B',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  sideGameTickerCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideGameTickerText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  sideGameTickerExpanded: {
    gap: 4,
  },
  sideGameTickerExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideGameTickerTitle: {
    color: '#C9A227',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sideGameTickerLine: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    paddingVertical: 2,
  },

  /* Item 9: Tag logging */
  tagSection: {
    marginBottom: 12,
    paddingTop: 8,
  },
  tagSectionTitle: {
    color: '#C9A227',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagIndicator: {
    fontSize: 9,
    fontWeight: '700',
  },

  /* Item 10: Broadcast leaderboard header */
  broadcastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    gap: 10,
  },
  broadcastColPos: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 28,
    textAlign: 'center',
  },
  broadcastColName: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  broadcastColThru: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 36,
    textAlign: 'center',
  },
  broadcastColTotal: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 36,
    textAlign: 'right',
  },
  broadcastColPar: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 40,
    textAlign: 'right',
  },
});

export const postRoundStyles = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H + 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: GEO,
    letterSpacing: -1,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
  },
  headerFormat: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  /* Body */
  body: { paddingHorizontal: 20 },

  /* Section title */
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  /* Standings table */
  standingsTable: { borderWidth: 1, overflow: 'hidden' },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  stHeader: {
    color: '#E8E4DE',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  stColPos: { width: 32, textAlign: 'center', fontFamily: GEO },
  stColName: { flex: 1, paddingRight: 4 },
  stColNum: { width: 48, textAlign: 'right', fontSize: 14, fontFamily: GEO },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginTop: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ─── Scorecard tab ──────────────────────────────────── */
  scRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  scCellHole: {
    width: 52,
    paddingLeft: 8,
    fontSize: 10,
    fontWeight: '600',
  },
  scCell: {
    width: 32,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 6,
    fontFamily: GEO,
  },
  scCellTotal: {
    width: 72,
    alignItems: 'center',
    paddingRight: 8,
  },
  scHeaderText: {
    color: '#E8E4DE',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    fontFamily: GEO,
  },
  scParText: {
    fontSize: 10,
    textAlign: 'center',
    fontFamily: GEO,
  },
  scPlayerLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  scTotalText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scNetText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },

  /* ─── Stats tab ──────────────────────────────────────── */
  statPlayerCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  statPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  statPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  statPlayerScore: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: GEO,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  statItem: {
    width: '28%' as unknown as number,
    minWidth: 80,
  },
  statItemLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  statItemValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },
  statItemSub: {
    fontSize: 10,
    marginTop: 1,
  },
  parAvgRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  parAvgItem: {
    alignItems: 'center',
  },
  parAvgLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  parAvgValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },

  /* ─── Games tab ──────────────────────────────────────── */
  gameCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  gameTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  gameLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  gameLineText: {
    fontSize: 13,
    fontWeight: '500',
  },
  gameLineValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: GEO,
  },
  gamesEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  gamesEmptyText: {
    fontSize: 14,
  },

  /* ─── Share card ─────────────────────────────────────── */
  shareSection: {
    marginTop: 24,
  },
  sharePreview: {
    padding: 24,
    alignItems: 'center',
  },
  shareDormie: {
    color: '#C9A227',
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 3,
  },
  shareCourse: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  shareDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  shareScores: {
    marginTop: 16,
    width: '100%',
  },
  shareScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sharePlayerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  sharePlayerScore: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
    fontFamily: GEO,
  },
  sharePlayerToPar: {
    fontSize: 14,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  shareStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
  },
  shareStat: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* ─── Save button ────────────────────────────────────── */
  saveBtn: {
    marginTop: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* ─── Feature 5: Settlement ──────────────────────────── */
  settlementSection: {
    marginTop: 20,
  },
  settlementCard: {
    borderWidth: 1,
    padding: 16,
  },
  settlementSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  settlementEmpty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  settlementName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  settlementAmount: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: GEO,
  },
  settleUpBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  settleUpBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Wolf banner */
  wolfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  wolfBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  /* ─── Side Game Wins ───────────────────────────────── */
  sideGameWinsSection: {
    marginTop: 12,
    gap: 8,
  },
  sideGameWinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  sideGameWinLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  sideGameWinPoints: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
});

/* ─── Competition Impact ─────────────────────────────────────────── */
export const competitionStyles = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontFamily: GEO,
  },
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 'auto' as unknown as number,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  row: {
    paddingVertical: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  valueMain: {
    fontSize: 14,
    fontWeight: '600',
  },
  valueSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  rankArrow: {
    fontSize: 14,
    fontWeight: '700',
  },
  handicapValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  handicapChange: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    marginTop: 2,
  },
  achievementText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },

  /* Share impact lines */
  shareImpactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  shareImpactText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
  },
});
