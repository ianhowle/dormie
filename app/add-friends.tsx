import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { GEO, SANS } from '../src/theme/fonts';
import { greenHeaderGradient, cardShadowDark, cardShadowLight } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import { friendsService } from '../src/services/friends.service';
import { useToast } from '../src/components/Toast';
import { haptics } from '../src/lib/haptics';
import type { User } from '../src/lib/database.types';

function Pinstripes() {
  const lines = Array.from({ length: 40 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -200,
            left: i * 18 - 100,
            width: 1,
            height: 800,
            backgroundColor: '#fff',
            opacity: 0.03,
            transform: [{ rotate: '35deg' }],
          }}
        />
      ))}
    </View>
  );
}

export default function AddFriendsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef[0] = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await friendsService.searchUsers(text.trim());
        // Filter out self
        setResults(data.filter((u) => u.id !== user?.id));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [user?.id]);

  const handleSendRequest = async (friendId: string) => {
    if (!user || sendingId) return;
    haptics.light();
    setSendingId(friendId);
    try {
      await friendsService.sendRequest(user.id, friendId);
      setSentIds((prev) => new Set(prev).add(friendId));
      showToast({ message: 'Request sent', type: 'success', icon: 'checkmark-circle' });
    } catch (err: any) {
      const msg = err?.message?.includes('duplicate')
        ? 'Request already sent'
        : 'Failed to send request';
      showToast({ message: msg, type: 'error' });
    } finally {
      setSendingId(null);
    }
  };

  const cardShadow = isDark ? cardShadowDark : cardShadowLight;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={greenHeaderGradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 4 }]}
      >
        <Pinstripes />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Add Friends</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: c.elevated, borderBottomColor: c.border }]}>
        <Ionicons name="search" size={18} color={c.textMuted} />
        <TextInput
          value={query}
          onChangeText={handleSearch}
          placeholder="Search by name or email"
          placeholderTextColor={c.textMuted}
          style={[styles.searchInput, { color: c.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); }} hitSlop={12}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Results */}
      {searching && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={c.teal} />
        </View>
      )}

      {!searching && query.length >= 2 && results.length === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="person-outline" size={32} color={c.textMuted} />
          <Text style={[styles.emptyText, { color: c.textMuted }]}>No users found</Text>
          <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
            Try searching by name or email address
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
        renderItem={({ item }) => {
          const isSent = sentIds.has(item.id);
          const isSending = sendingId === item.id;
          return (
            <View style={[styles.resultRow, { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow }]}>
              <Avatar id={item.id} size={44} name={item.name} />
              <View style={styles.resultInfo}>
                <Text style={[styles.resultName, { color: c.text }]}>{item.name}</Text>
                {(item.city || item.state) && (
                  <Text style={[styles.resultLocation, { color: c.textMuted }]}>
                    {[item.city, item.state].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
              {isSent ? (
                <View style={[styles.sentBadge, { backgroundColor: `${c.teal}20` }]}>
                  <Ionicons name="checkmark" size={14} color={c.teal} />
                  <Text style={[styles.sentText, { color: c.teal }]}>Sent</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleSendRequest(item.id)}
                  disabled={isSending}
                  style={({ pressed }) => [
                    styles.addBtn,
                    pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                  ]}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={14} color="#FFFFFF" />
                      <Text style={styles.addBtnText}>Add</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: GEO,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  loadingWrap: {
    padding: 32,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: GEO,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: SANS,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: SANS,
  },
  resultLocation: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: SANS,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#006747',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sentText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
