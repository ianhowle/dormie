import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GEO } from '../theme/fonts';
import { Avatar } from './Avatar';
import { haptics } from '../lib/haptics';

const { width: SCREEN_W } = Dimensions.get('window');

type MatchupPlayer = {
  id: string;
  name: string;
  handicap: number;
};

type Matchup = {
  red: MatchupPlayer;
  blue: MatchupPlayer;
  format: string;
};

type Props = {
  teamRedName: string;
  teamBlueName: string;
  matchups: Matchup[];
  onComplete: () => void;
};

// Demo matchup data for testing
export const DEMO_MATCHUPS: Matchup[] = [
  { red: { id: 'r1', name: 'Ian McGowan', handicap: 8 }, blue: { id: 'b1', name: 'Drew Patterson', handicap: 12 }, format: 'Singles' },
  { red: { id: 'r2', name: 'Jake Sullivan', handicap: 15 }, blue: { id: 'b2', name: 'Tommy Fleetwood', handicap: 3 }, format: 'Singles' },
  { red: { id: 'r3', name: 'Mike Chen', handicap: 18 }, blue: { id: 'b3', name: 'Sam Rodriguez', handicap: 22 }, format: 'Singles' },
  { red: { id: 'r4', name: 'Will Harrison', handicap: 25 }, blue: { id: 'b4', name: 'Chris Lee', handicap: 28 }, format: 'Singles' },
];

export function MatchupReveal({ teamRedName, teamBlueName, matchups, onComplete }: Props) {
  const [phase, setPhase] = useState<'teams' | 'matchup' | 'done'>('teams');
  const [currentMatchup, setCurrentMatchup] = useState(0);

  // Animations
  const redNameAnim = useRef(new Animated.Value(0)).current;
  const blueNameAnim = useRef(new Animated.Value(0)).current;
  const vsAnim = useRef(new Animated.Value(0)).current;
  const matchupAnim = useRef(new Animated.Value(0)).current;
  const redPlayerAnim = useRef(new Animated.Value(0)).current;
  const bluePlayerAnim = useRef(new Animated.Value(0)).current;

  // Team name reveal
  useEffect(() => {
    if (phase === 'teams') {
      Animated.sequence([
        Animated.timing(redNameAnim, { toValue: 1, duration: 600, delay: 400, useNativeDriver: true }),
        Animated.timing(blueNameAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  }, [phase]);

  // Matchup reveal animation
  useEffect(() => {
    if (phase === 'matchup') {
      matchupAnim.setValue(0);
      redPlayerAnim.setValue(0);
      bluePlayerAnim.setValue(0);
      vsAnim.setValue(0);

      Animated.sequence([
        Animated.timing(redPlayerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(vsAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(bluePlayerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(matchupAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [phase, currentMatchup]);

  const handleTeamsTap = () => {
    haptics.medium();
    setPhase('matchup');
  };

  const handleNextMatchup = () => {
    haptics.medium();
    if (currentMatchup < matchups.length - 1) {
      setCurrentMatchup(currentMatchup + 1);
    } else {
      setPhase('done');
    }
  };

  const handleFinish = () => {
    haptics.success();
    onComplete();
  };

  // Phase: Team names reveal
  if (phase === 'teams') {
    return (
      <View style={s.screen}>
        <View style={s.centered}>
          <Animated.View style={[s.teamReveal, {
            opacity: redNameAnim,
            transform: [{ translateX: redNameAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }],
          }]}>
            <View style={[s.teamDot, { backgroundColor: '#B71C1C' }]} />
            <Text style={[s.teamRevealName, { color: '#C41E3A', fontFamily: GEO }]}>
              {teamRedName}
            </Text>
          </Animated.View>

          <Text style={[s.versusText, { fontFamily: GEO }]}>VS</Text>

          <Animated.View style={[s.teamReveal, {
            opacity: blueNameAnim,
            transform: [{ translateX: blueNameAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
          }]}>
            <View style={[s.teamDot, { backgroundColor: '#1565C0' }]} />
            <Text style={[s.teamRevealName, { color: '#1565C0', fontFamily: GEO }]}>
              {teamBlueName}
            </Text>
          </Animated.View>

          <Text style={s.matchCountText}>{matchups.length} matches</Text>
        </View>

        <Pressable onPress={handleTeamsTap} style={s.revealBtn}>
          <Text style={[s.revealBtnText, { fontFamily: GEO }]}>Reveal Matchups</Text>
          <Ionicons name="chevron-forward" size={18} color="#C9A227" />
        </Pressable>
      </View>
    );
  }

  // Phase: Individual matchup reveal
  if (phase === 'matchup') {
    const m = matchups[currentMatchup];
    const isLast = currentMatchup === matchups.length - 1;

    return (
      <View style={s.screen}>
        {/* Match counter */}
        <View style={s.matchCounter}>
          <Text style={[s.matchCounterText, { fontFamily: GEO }]}>
            MATCH {currentMatchup + 1} OF {matchups.length}
          </Text>
          <Text style={[s.matchFormat, { color: '#C9A227' }]}>{m.format}</Text>
        </View>

        <View style={s.centered}>
          {/* Red player */}
          <Animated.View style={[s.playerCard, {
            opacity: redPlayerAnim,
            transform: [{ translateX: redPlayerAnim.interpolate({ inputRange: [0, 1], outputRange: [-SCREEN_W, 0] }) }],
          }]}>
            <View style={[s.playerColorBar, { backgroundColor: '#B71C1C' }]} />
            <Avatar id={m.red.id} name={m.red.name} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[s.playerName, { color: '#E8E4DE' }]}>{m.red.name}</Text>
              <Text style={[s.playerHcp, { fontFamily: GEO }]}>{m.red.handicap} HCP</Text>
            </View>
          </Animated.View>

          {/* VS */}
          <Animated.View style={[s.vsContainer, {
            opacity: vsAnim,
            transform: [{ scale: vsAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
          }]}>
            <Text style={[s.vsBig, { fontFamily: GEO }]}>VS</Text>
          </Animated.View>

          {/* Blue player */}
          <Animated.View style={[s.playerCard, {
            opacity: bluePlayerAnim,
            transform: [{ translateX: bluePlayerAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_W, 0] }) }],
          }]}>
            <View style={[s.playerColorBar, { backgroundColor: '#1565C0' }]} />
            <Avatar id={m.blue.id} name={m.blue.name} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={[s.playerName, { color: '#E8E4DE' }]}>{m.blue.name}</Text>
              <Text style={[s.playerHcp, { fontFamily: GEO }]}>{m.blue.handicap} HCP</Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: matchupAnim }}>
          <Pressable onPress={handleNextMatchup} style={s.revealBtn}>
            <Text style={[s.revealBtnText, { fontFamily: GEO }]}>
              {isLast ? "Let's Play!" : 'Next Matchup'}
            </Text>
            <Ionicons name={isLast ? 'golf' : 'chevron-forward'} size={18} color="#C9A227" />
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // Phase: Done
  return (
    <View style={s.screen}>
      <View style={s.centered}>
        <Text style={s.doneEmoji}>&#9971;</Text>
        <Text style={[s.doneTitle, { fontFamily: GEO }]}>ALL MATCHUPS SET</Text>
        <Text style={s.doneSubtitle}>{matchups.length} matches ready to play</Text>
      </View>
      <Pressable onPress={handleFinish} style={s.revealBtn}>
        <Text style={[s.revealBtnText, { fontFamily: GEO }]}>Let's Play!</Text>
        <Ionicons name="golf" size={18} color="#C9A227" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'space-between',
    paddingBottom: 60,
    paddingTop: 80,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  teamReveal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  teamDot: {
    width: 16,
    height: 16,
  },
  teamRevealName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  versusText: {
    color: '#C9A227',
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 16,
    letterSpacing: 4,
  },
  matchCountText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    marginTop: 24,
    letterSpacing: 1,
  },
  matchCounter: {
    alignItems: 'center',
    paddingTop: 20,
  },
  matchCounterText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  matchFormat: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 1,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1816',
    padding: 16,
    width: SCREEN_W - 48,
    overflow: 'hidden',
  },
  playerColorBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
  },
  playerHcp: {
    color: '#6B6560',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  vsContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
  vsBig: {
    color: '#C9A227',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
  },
  revealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#1A1816',
    borderWidth: 1,
    borderColor: '#C9A227',
  },
  revealBtnText: {
    color: '#C9A227',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  doneEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  doneTitle: {
    color: '#C9A227',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  doneSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginTop: 8,
  },
});
