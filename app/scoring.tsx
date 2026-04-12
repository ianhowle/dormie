import React, { Suspense, lazy } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { tickerShadowDark, tickerShadowLight } from '../src/theme/colors';
import GoldDivider from '../src/components/GoldDivider';
const DormieMoment = lazy(() => import('../src/components/DormieMoment').then(m => ({ default: m.DormieMoment })));
import { SideGameToast } from '../src/components/SideGameToast';
import { HoleTransitionBanner } from '../src/components/HoleTransitionBanner';
import { Confetti } from '../src/components/Confetti';
import { PersonalBestBanner } from '../src/components/PersonalBestBanner';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { haptics } from '../src/lib/haptics';
import { SIDE_GAME_DISPLAY } from '../src/scoring/calculations';
import type { PlayerConfig, HoleScore } from '../src/scoring/types';

// ─── Custom hook (all state, effects, callbacks) ────────────────────
import { useScoringState } from '../src/scoring/useScoringState';

// ─── Extracted sub-components ───────────────────────────────────────
import { HoleHeader } from '../src/components/scoring/HoleHeader';
import { PlayerScoreInput } from '../src/components/scoring/ScoreGrid';
import { PlayerTabs } from '../src/components/scoring/PlayerTabs';
import { HoleNavigator, NavButtons } from '../src/components/scoring/HoleNavigator';
import {
  RunningSkinsPanel, RunningDotsPanel, RunningNassauPanel,
  RunningSnakePanel, RunningWolfPanel, RunningBBBPanel,
} from '../src/components/scoring/SideGameTicker';
import { WolfModal } from '../src/components/scoring/WolfModal';
import { BBBPrompt } from '../src/components/scoring/BBBPrompt';
const PostRoundSummary = lazy(() => import('../src/components/scoring/PostRoundSummary'));
import { scoringStyles as st } from '../src/components/scoring/styles';

// ─── Extracted modals ───────────────────────────────────────────────
import {
  ScoreConfirmation,
  HammerModal,
  PuttDistModal,
  BestBallSetupModal,
  HoleNotesModal,
  LiveLeaderboard,
  LowHighSetupModal,
} from '../src/components/scoring/ScoringModals';
import { LowHighBanner } from '../src/components/scoring/LowHighBanner';

function HoleResultBanner({ players, holeScores, holePar }: { players: PlayerConfig[]; holeScores: Map<string, HoleScore>; holePar: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (holeScores.size < players.length) return null;
  let bestScore = Infinity;
  let winners: string[] = [];
  holeScores.forEach((s, pid) => {
    if (s.gross < bestScore) { bestScore = s.gross; winners = [pid]; }
    else if (s.gross === bestScore) winners.push(pid);
  });
  const isTie = winners.length > 1;
  const winnerName = isTie ? 'Halved' : (players.find((p) => p.id === winners[0])?.id === '1' ? 'You won' : `${players.find((p) => p.id === winners[0])?.name?.split(' ')[0] ?? 'Player'} wins`);
  const diff = bestScore - holePar;
  const scoreName = diff <= -2 ? 'eagle' : diff === -1 ? 'birdie' : diff === 0 ? 'par' : diff === 1 ? 'bogey' : 'double bogey';
  const scoreLabel = isTie ? '' : ` with ${scoreName}`;
  return (
    <View style={[st.resultBanner, { backgroundColor: `${c.teal}12`, borderColor: c.teal }]}>
      <Ionicons name={isTie ? 'swap-horizontal' : 'trophy'} size={16} color={c.teal} />
      <Text style={[st.resultText, { color: c.teal }]}>{winnerName}{scoreLabel}</Text>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────
function ScoringScreenInner() {
  const { theme } = useTheme();
  const c = theme.colors;
  const s = useScoringState();

  // ─── Early returns for confirmation / summary ─────────────────────
  if (s.showConfirmation) {
    return (
      <ScoreConfirmation
        players={s.players}
        holes={s.holes}
        allScores={s.allScores}
        onEdit={(idx) => {
          s.setShowConfirmation(false);
          if (idx >= 0) s.setCurrentHoleIdx(idx);
        }}
        onPost={() => { s.setShowConfirmation(false); s.setShowSummary(true); }}
      />
    );
  }

  if (s.showSummary) {
    return (
      <Suspense fallback={<View style={{ flex: 1, backgroundColor: c.bg }} />}>
        <PostRoundSummary
          players={s.players}
          holes={s.holes}
          allScores={s.allScores}
          scoreMode={s.scoreMode}
          handicapStrokes={s.handicapStrokes}
          courseName={s.courseName}
          formatLabel={s.formatLabel}
          sideGameKeys={s.sideGameKeys}
          wolfHoleDecisions={s.wolfHoleDecisions}
          bbbHolePoints={s.bbbHolePoints}
          onDone={s.handlePostRound}
        />
      </Suspense>
    );
  }

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />

      {/* Offline banner */}
      {s.isOffline && (
        <View style={{ backgroundColor: '#C9A227', paddingVertical: 6, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Ionicons name="cloud-offline-outline" size={14} color="#141210" />
          <Text style={{ color: '#141210', fontSize: 13, fontWeight: '600' }}>
            Offline — your round is saved locally
          </Text>
        </View>
      )}

      <HoleHeader
        courseName={s.courseName}
        holeNumber={s.currentHole.number}
        holePar={s.currentHole.par}
        format={s.formatLabel}
        totalHoles={s.holes.length}
        holesScored={s.holesScored}
        onLeaderboard={() => s.setShowLeaderboard(true)}
        onFeed={() => { s.setShowFeed(!s.showFeed); s.setLastReadEventCount(s.scoringEvents.length); }}
        unreadFeedCount={s.unreadFeedCount > 0 ? s.unreadFeedCount : 0}
        viewMode={s.viewMode}
        onToggleViewMode={() => s.setViewMode(s.viewMode === 'solo' ? 'all' : 'solo')}
        holeYardage={s.currentHole.yards}
        holeHcp={s.currentHole.strokeIndex}
        onPrevHole={() => { if (s.currentHoleIdx > 0) s.setCurrentHoleIdx(s.currentHoleIdx - 1); }}
        onNextHole={() => { if (s.currentHoleIdx < s.holes.length - 1) s.setCurrentHoleIdx(s.currentHoleIdx + 1); }}
        canPrevHole={s.currentHoleIdx > 0}
        canNextHole={s.currentHoleIdx < s.holes.length - 1}
        competitionCount={s.competitionTabs.length}
        roundType={s.roundType}
      />

      <HoleNavigator
        holes={s.holes}
        currentIdx={s.currentHoleIdx}
        scores={s.allScores}
        onSelect={s.setCurrentHoleIdx}
        holeNotes={s.holeNotes}
      />

      {/* Season banners */}
      {s.linkedSeasons.length > 0 && s.linkedSeasons.map((ls) => (
        <View key={ls.seasonId} style={st.seasonBanner}>
          <View style={st.seasonBannerContent}>
            <Text style={[st.seasonBannerName, { fontFamily: GEO }]}>
              {ls.seasonName} {'\u00B7'} Week {ls.weekNumber} {'\u00B7'} {ls.format} {'\u00B7'} {ls.multiplier}x
            </Text>
          </View>
        </View>
      ))}

      {/* Side Game Ticker */}
      {s.sideGameKeys.length > 0 && (
        <>
        <GoldDivider />
        <Pressable
          onPress={() => s.setSideGameTickerExpanded(!s.sideGameTickerExpanded)}
          accessibilityLabel={s.sideGameTickerExpanded ? 'Collapse side games' : 'Expand side games'}
          accessibilityRole="button"
          style={[st.sideGameTicker, theme.isDark ? tickerShadowDark : tickerShadowLight]}
        >
          {!s.sideGameTickerExpanded ? (
            <View style={st.sideGameTickerCollapsed}>
              <Text style={st.sideGameTickerText}>
                {s.sideGameKeys.map((k) => SIDE_GAME_DISPLAY[k] ?? k).join(' | ')}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
            </View>
          ) : (
            <View style={st.sideGameTickerExpanded}>
              <View style={st.sideGameTickerExpandedHeader}>
                <Text style={[st.sideGameTickerTitle, { fontFamily: GEO }]}>SIDE GAMES</Text>
                <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.6)" />
              </View>
              {s.sideGameKeys.map((key) => (
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

      {/* Wolf banner */}
      {s.sideGameKeys.includes('wolf') && s.currentWolfId && (
        <Pressable
          onPress={() => { s.setWolfPickStep('choose'); s.setShowWolfModal(true); }}
          style={[st.wolfBanner, { backgroundColor: c.elevated, borderColor: c.border }]}
        >
          <Ionicons name="paw" size={16} color={c.gold} />
          <Text style={[st.wolfBannerText, { color: c.text }]}>
            Wolf: {(() => {
              const wp = s.players.find((p) => p.id === s.currentWolfId);
              return wp ? (wp.id === '1' ? 'You' : wp.name.split(' ')[0]) : '';
            })()}
            {s.currentWolfDecision?.decision === 'lone' ? ' (Lone Wolf)' :
             s.currentWolfDecision?.decision === 'blind' ? ' (Blind Wolf)' :
             s.currentWolfDecision?.decision === 'partner' ? ` + ${(() => {
               const pp = s.players.find((p) => p.id === s.currentWolfDecision!.partnerId);
               return pp ? (pp.id === '1' ? 'You' : pp.name.split(' ')[0]) : '';
             })()}` : ' — Tap to decide'}
          </Text>
          {!s.currentWolfDecision && (
            <Ionicons name="chevron-forward" size={14} color={c.gold} />
          )}
        </Pressable>
      )}

      {/* Low Ball / High Ball banner */}
      {s.isLowHigh && !s.showLowHighSetup && (
        <LowHighBanner
          holeResult={s.lowHighResults.get(s.currentHole.number)}
          points={s.lowHighPoints}
          includeTotal={s.lowHighOptions.includeTotal}
        />
      )}

      {/* Best Ball team banner */}
      {s.isBestBall && !s.showBestBallSetup && (
        <View style={[st.bestBallBanner, { backgroundColor: c.elevated, borderColor: c.border }]}>
          <View style={st.bestBallTeam}>
            <Text style={[st.bestBallTeamLabel, { color: c.teal }]}>Team 1</Text>
            <Text style={[st.bestBallTeamScore, { color: c.text, fontFamily: GEO }]}>
              {s.bestBallTeamScores.team1 > 0 ? s.bestBallTeamScores.team1 : '-'}
            </Text>
          </View>
          <Text style={[st.bestBallVs, { color: c.textMuted }]}>vs</Text>
          <View style={st.bestBallTeam}>
            <Text style={[st.bestBallTeamLabel, { color: c.gold }]}>Team 2</Text>
            <Text style={[st.bestBallTeamScore, { color: c.text, fontFamily: GEO }]}>
              {s.bestBallTeamScores.team2 > 0 ? s.bestBallTeamScores.team2 : '-'}
            </Text>
          </View>
        </View>
      )}

      {/* Live Feed or Scoring Body */}
      {s.showFeed ? (
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={st.feedContainer}>
          <Text style={[st.feedTitle, { color: c.gold, fontFamily: GEO }]}>LIVE FEED</Text>
          {s.scoringEvents.length === 0 ? (
            <Text style={[st.feedEmpty, { color: c.textMuted }]}>No events yet — start scoring!</Text>
          ) : (
            s.scoringEvents.slice(0, 10).map((ev, i) => (
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
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={st.scoringBody} accessibilityHint="Swipe left or right to change holes">
          {/* Hole notes button */}
          <View style={st.holeToolsRow}>
            <Pressable
              onPress={() => {
                s.setNoteText(s.holeNotes.get(s.currentHole.number) ?? '');
                s.setShowNoteModal(true);
              }}
              style={[st.holeToolBtn, { borderColor: c.border }]}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={s.holeNotes.has(s.currentHole.number) && (s.holeNotes.get(s.currentHole.number) ?? '').length > 0 ? c.gold : c.textMuted}
              />
              <Text style={[st.holeToolLabel, { color: c.textMuted }]}>Notes</Text>
            </Pressable>
          </View>

          {/* Solo mode player tabs */}
          {s.viewMode === 'solo' && s.players.length > 1 && (
            <PlayerTabs
              players={s.players}
              soloPlayerIdx={s.soloPlayerIdx}
              onSoloPlayerChange={s.setSoloPlayerIdx}
              runningToPar={(() => { const r = s.getRunningTotal(s.players[s.soloPlayerIdx].id); return r.total - r.par; })()}
              holesPlayed={(() => { const r = s.getRunningTotal(s.players[s.soloPlayerIdx].id); return r.count; })()}
            />
          )}

          {/* Player score inputs */}
          {s.visiblePlayers.map((p) => {
            const running = s.getRunningTotal(p.id);
            const netStrokes = s.handicapStrokes.get(p.id)?.get(s.currentHole.number) ?? 0;
            return (
              <PlayerScoreInput
                key={p.id}
                player={p}
                holePar={s.currentHole.par}
                score={s.getPlayerScore(p.id)}
                runningTotal={running.total}
                runningPar={running.par}
                netStrokes={netStrokes}
                scoreMode={s.scoreMode}
                onChange={(score) => s.updatePlayerScore(p.id, score)}
                compact={s.viewMode === 'all' && s.players.length > 2}
              />
            );
          })}

          {/* Tag logging */}
          <View style={st.tagSection}>
            <Text style={[st.tagSectionTitle, { fontFamily: GEO }]}>LOG THIS HOLE</Text>
            <View style={st.tagRow}>
              {(['Sand', 'Trees', 'Water', 'Penalty', 'Up & Down'] as const).map((tag) => {
                const myScore = s.getPlayerScore('1');
                const tags = myScore.tags ?? [];
                const isSelected = tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => {
                      const currentScore = s.getPlayerScore('1');
                      const currentTags = currentScore.tags ?? [];
                      const newTags = currentTags.includes(tag)
                        ? currentTags.filter((t) => t !== tag)
                        : [...currentTags, tag];
                      s.updatePlayerScore('1', { ...currentScore, tags: newTags });
                    }}
                    style={({ pressed }) => [
                      st.tagPill,
                      { backgroundColor: isSelected ? `${c.teal}20` : c.elevated, borderColor: isSelected ? c.teal : c.border },
                      pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text style={[st.tagPillText, { color: isSelected ? c.teal : c.textMuted }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Hole result */}
          {s.players.length > 1 && (
            <HoleResultBanner players={s.players} holeScores={s.currentHoleScores} holePar={s.currentHole.par} />
          )}

          {/* Hammer button */}
          {s.sideGameKeys.includes('hammer') && (
            <Pressable
              onPress={() => {
                if (s.players.length >= 2) {
                  s.setHammerState((prev) => ({ ...prev, active: true, thrower: s.players[0].id, target: s.players[1].id, pending: true }));
                  s.setShowHammerModal(true);
                }
              }}
              style={({ pressed }) => [st.hammerBtn, { backgroundColor: c.gold }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="hammer-outline" size={18} color="#1E4D2B" />
              <Text style={[st.hammerBtnText, { fontFamily: GEO }]}>Throw Hammer</Text>
              {s.hammerState.active && s.hammerState.multiplier > 2 && (
                <View style={st.hammerMultiplierBadge}>
                  <Text style={[st.hammerMultiplierText, { fontFamily: GEO }]}>{s.hammerState.multiplier}x</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Side Game Running Panel */}
          {s.sideGameKeys.length > 0 && (
            <View style={[st.runningPanelWrap, { borderColor: c.border }]}>
              <Pressable
                onPress={() => s.setShowRunningPanel(!s.showRunningPanel)}
                style={[st.runningPanelToggle, { backgroundColor: c.elevated }]}
              >
                <Text style={[st.runningPanelToggleText, { color: c.text }]}>
                  Side Games {s.showRunningPanel ? '\u25B2' : '\u25BC'}
                </Text>
              </Pressable>
              {s.showRunningPanel && (
                <View style={[st.runningPanelContent, { backgroundColor: c.cardBg }]}>
                  {s.sideGameKeys.includes('skins') && <RunningSkinsPanel players={s.players} holes={s.holes} allScores={s.allScores} currentHoleNumber={s.currentHole.number} />}
                  {s.sideGameKeys.includes('dots') && <RunningDotsPanel players={s.players} holes={s.holes} allScores={s.allScores} />}
                  {s.sideGameKeys.includes('nassau') && <RunningNassauPanel players={s.players} holes={s.holes} allScores={s.allScores} />}
                  {s.sideGameKeys.includes('snake') && <RunningSnakePanel players={s.players} holes={s.holes} allScores={s.allScores} />}
                  {s.sideGameKeys.includes('wolf') && <RunningWolfPanel players={s.players} holes={s.holes} allScores={s.allScores} wolfHoleDecisions={s.wolfHoleDecisions} currentHoleNumber={s.currentHole.number} />}
                  {s.sideGameKeys.includes('bingo_bango_bongo') && <RunningBBBPanel players={s.players} bbbHolePoints={s.bbbHolePoints} />}
                </View>
              )}
            </View>
          )}

          {/* Nav buttons */}
          <NavButtons
            canPrev={s.currentHoleIdx > 0}
            canNext={s.currentHoleIdx < s.holes.length - 1}
            isLast={s.isLastHole}
            onPrev={s.handlePrev}
            onNext={s.handleNext}
            onFinish={s.handleFinish}
          />
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ═══ MODALS ═══ */}

      <HammerModal
        visible={s.showHammerModal}
        hammerState={s.hammerState}
        players={s.players}
        onAccept={() => {
          s.setHammerState((prev) => ({ ...prev, multiplier: Math.min(8, prev.multiplier * 2), pending: false }));
          s.setShowHammerModal(false);
        }}
        onFold={() => {
          s.setHammerResults((prev) => {
            const next = new Map(prev);
            next.set(s.currentHole.number, { thrower: s.hammerState.thrower, target: s.hammerState.target, multiplier: s.hammerState.multiplier, accepted: false });
            return next;
          });
          s.setHammerState((prev) => ({ ...prev, pending: false }));
          s.setShowHammerModal(false);
        }}
      />

      {/* Wolf Decision Modal */}
      <Modal visible={s.showWolfModal} transparent animationType="fade">
        <WolfModal
          currentWolfId={s.currentWolfId}
          players={s.players}
          currentHole={s.currentHole}
          wolfPickStep={s.wolfPickStep}
          setWolfPickStep={s.setWolfPickStep}
          onDecision={(decision) => {
            s.setWolfHoleDecisions((prev) => {
              const next = new Map(prev);
              next.set(s.currentHole.number, decision);
              return next;
            });
          }}
          onClose={() => s.setShowWolfModal(false)}
        />
      </Modal>

      {/* BBB Bango Prompt */}
      <Modal visible={s.showBangoPrompt} transparent animationType="fade">
        <BBBPrompt
          bangoHoleNumber={s.bangoHoleNumber}
          players={s.players}
          bbbHolePoints={s.bbbHolePoints}
          onSelect={(holeNumber, playerId) => {
            s.setBBBHolePoints((prev) => {
              const next = new Map(prev);
              const existing = next.get(holeNumber) ?? { bingo: null, bango: null, bongo: null };
              next.set(holeNumber, { ...existing, bango: playerId });
              return next;
            });
            s.setShowBangoPrompt(false);
            haptics.light();
          }}
          onSkip={() => s.setShowBangoPrompt(false)}
          onTripleCrown={(playerName, holeNumber) => {
            s.setDormieMoment({
              visible: true,
              type: 'BBB_TRIPLE_CROWN',
              playerName,
              detail: `All three points on Hole ${holeNumber}!`,
            });
          }}
        />
      </Modal>

      <PuttDistModal
        visible={s.puttDistPrompt.show}
        playerName={(() => {
          const playersWithPutts = s.players.filter((p) => { const sc = s.getPlayerScore(p.id); return sc.putts > 0; });
          const cp = playersWithPutts[s.puttDistPrompt.playerIdx];
          return cp ? (cp.id === '1' ? 'Your' : `${cp.name.split(' ')[0]}'s`) : '';
        })()}
        holeNumber={s.puttDistPrompt.holeNumber}
        onSelect={s.handlePuttDistSelect}
      />

      <BestBallSetupModal
        visible={s.showBestBallSetup && s.isBestBall}
        players={s.players}
        teams={s.bestBallTeams}
        onMoveToTeam2={(pid) => s.setBestBallTeams((prev) => ({
          team1: prev.team1.filter((id) => id !== pid),
          team2: [...prev.team2, pid],
        }))}
        onMoveToTeam1={(pid) => s.setBestBallTeams((prev) => ({
          team1: [...prev.team1, pid],
          team2: prev.team2.filter((id) => id !== pid),
        }))}
        onStart={() => s.setShowBestBallSetup(false)}
      />

      <LowHighSetupModal
        visible={s.showLowHighSetup && s.isLowHigh}
        players={s.players}
        teams={s.lowHighTeams}
        options={s.lowHighOptions}
        onMoveToTeam2={(pid) => s.setLowHighTeams((prev) => ({
          team1: prev.team1.filter((id) => id !== pid),
          team2: [...prev.team2, pid],
        }))}
        onMoveToTeam1={(pid) => s.setLowHighTeams((prev) => ({
          team1: [...prev.team1, pid],
          team2: prev.team2.filter((id) => id !== pid),
        }))}
        onChangeOptions={s.setLowHighOptions}
        onStart={() => s.setShowLowHighSetup(false)}
      />

      <HoleNotesModal
        visible={s.showNoteModal}
        holeNumber={s.currentHole.number}
        noteText={s.noteText}
        onChangeText={s.setNoteText}
        onCancel={() => s.setShowNoteModal(false)}
        onSave={() => {
          s.setHoleNotes((prev) => {
            const next = new Map(prev);
            if (s.noteText.trim().length > 0) next.set(s.currentHole.number, s.noteText.trim());
            else next.delete(s.currentHole.number);
            return next;
          });
          s.setShowNoteModal(false);
        }}
      />

      <LiveLeaderboard
        visible={s.showLeaderboard}
        onClose={() => s.setShowLeaderboard(false)}
        courseName={s.courseName}
        competitionTabs={s.competitionTabs}
        activeCompTab={s.activeCompTab}
        setActiveCompTab={s.setActiveCompTab}
        leaderboardData={s.leaderboardData}
        allScores={s.allScores}
        holes={s.holes}
        holesScored={s.holesScored}
        players={s.players}
        getRunningTotal={s.getRunningTotal}
        matchupOpponent={s.matchupOpponent}
        linkedTrip={s.linkedTrip}
        MOCK_GROUP_PLAYERS={s.MOCK_GROUP_PLAYERS}
      />

      {/* Dormie Moment overlay */}
      {s.dormieMoment.visible && (
        <Suspense fallback={null}>
          <DormieMoment
            visible={s.dormieMoment.visible}
            type={s.dormieMoment.type}
            playerName={s.dormieMoment.playerName}
            detail={s.dormieMoment.detail}
            onDismiss={() => s.setDormieMoment((prev) => ({ ...prev, visible: false }))}
          />
        </Suspense>
      )}

      {/* Side Game Toast */}
      {s.sideGameToastEvents.length > 0 && (
        <SideGameToast
          events={s.sideGameToastEvents}
          onConfirm={(eventId) => s.setSideGameToastEvents((prev) => prev.filter((e) => e.id !== eventId))}
          onDismiss={(eventId) => s.setSideGameToastEvents((prev) => prev.filter((e) => e.id !== eventId))}
        />
      )}

      {/* Hole Transition Banner */}
      <HoleTransitionBanner
        visible={s.transitionBanner.visible}
        holeNumber={s.transitionBanner.holeNumber}
        par={s.transitionBanner.par}
        results={s.transitionBanner.results}
        onDismiss={() => s.setTransitionBanner((prev) => ({ ...prev, visible: false }))}
      />

      <Confetti visible={s.showConfetti} onDone={() => s.setShowConfetti(false)} />
      <PersonalBestBanner visible={s.showPersonalBest} courseName={s.courseName} previousBest={s.prevBest} onDone={() => s.setShowPersonalBest(false)} />
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
