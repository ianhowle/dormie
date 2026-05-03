import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { haptics } from '../src/lib/haptics';
import { useToast } from '../src/components/Toast';
import { tripInvitesService } from '../src/services/tripInvites.service';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

export default function TripInviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { showToast } = useToast();

  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!code) return;
    haptics.light();
    setIsJoining(true);
    try {
      const tripId = await tripInvitesService.joinByInvite(code);
      haptics.success();
      showToast({ message: 'Joined trip!', type: 'success' });
      router.replace({ pathname: '/trip-detail', params: { tripId } });
    } catch (err: any) {
      haptics.error();
      showToast({ message: err?.message ?? 'Could not join trip', type: 'error' });
    } finally {
      setIsJoining(false);
    }
  };

  const handleClose = () => {
    haptics.light();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Close button */}
      <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
        <Ionicons name="close" size={24} color={c.text} />
      </Pressable>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={[styles.brand, { color: c.gold, fontFamily: GEO }]}>DORMIE</Text>
        <View style={[styles.divider, { backgroundColor: c.gold }]} />
        <Text style={[styles.kicker, { color: c.textMuted }]}>TRIP INVITE</Text>
      </View>

      {/* Code display */}
      <View style={[styles.codeCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.codeText, { color: c.text, fontFamily: GEO }]}>
          {code ?? '------'}
        </Text>
      </View>

      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        You've been invited to join a trip on Dormie
      </Text>

      {/* Join CTA */}
      <Pressable
        onPress={handleJoin}
        disabled={isJoining || !code}
        style={[
          styles.joinBtn,
          { backgroundColor: c.teal },
          (isJoining || !code) && { opacity: 0.6 },
        ]}
      >
        {isJoining ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="enter-outline" size={18} color="#fff" />
            <Text style={[styles.joinBtnText, { fontFamily: GEO }]}>Join Trip</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  closeBtn: {
    position: 'absolute',
    top: STATUS_BAR_H + 8,
    right: 16,
    zIndex: 10,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brand: {
    fontSize: 32,
    letterSpacing: 6,
  },
  divider: {
    width: 40,
    height: 2,
    marginVertical: 12,
  },
  kicker: {
    fontSize: 14,
    letterSpacing: 3,
    fontWeight: '600',
  },
  codeCard: {
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 40,
    letterSpacing: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
