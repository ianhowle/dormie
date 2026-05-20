import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Share,
  SectionList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { useDemoMode } from '../src/contexts/DemoModeContext';
import { GEO, SANS } from '../src/theme/fonts';
import { greenHeaderGradient, cardShadowDark, cardShadowLight } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import { friendsService } from '../src/services/friends.service';
import { supabase } from '../src/lib/supabase';
import { useToast } from '../src/components/Toast';
import { haptics } from '../src/lib/haptics';
import { logWarn } from '../src/lib/logger';
import GoldDivider from '../src/components/GoldDivider';
import type { User, FriendshipWithUser } from '../src/lib/database.types';

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

type ContactMatch = {
  contactName: string;
  email: string;
  dormieUser?: User;
};

export default function AddFriendsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { checkAndDisable: disableDemoIfNeeded } = useDemoMode();

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState<FriendshipWithUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  // Contacts state
  const [contactsPermission, setContactsPermission] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [contactMatches, setContactMatches] = useState<ContactMatch[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showContactsPrompt, setShowContactsPrompt] = useState(true);

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const cardShadow = isDark ? cardShadowDark : cardShadowLight;

  // Load pending requests on mount
  useEffect(() => {
    if (!user) return;
    setLoadingPending(true);
    friendsService.getPendingRequests(user.id)
      .then(setPendingRequests)
      .catch((e) => logWarn('Friends: pending requests fetch failed', e))
      .finally(() => setLoadingPending(false));
  }, [user?.id]);

  // Check contacts permission on mount
  useEffect(() => {
    Contacts.getPermissionsAsync()
      .then(({ status }) => {
        if (status === 'granted') {
          setContactsPermission('granted');
          setShowContactsPrompt(false);
          loadContactMatches();
        } else if (status === 'denied') {
          setContactsPermission('denied');
          setShowContactsPrompt(false);
        }
      })
      .catch(() => {});
  }, []);

  const loadContactMatches = async () => {
    setLoadingContacts(true);
    try {
      const { data: contacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails],
      });

      // Extract all emails from contacts
      const emailMap = new Map<string, string>();
      contacts.forEach((contact) => {
        contact.emails?.forEach((emailEntry) => {
          if (emailEntry.email) {
            emailMap.set(emailEntry.email.toLowerCase(), contact.name ?? 'Unknown');
          }
        });
      });

      if (emailMap.size === 0) {
        setContactMatches([]);
        return;
      }

      const emails = Array.from(emailMap.keys());
      // Query Supabase for matching users (batch in chunks of 50)
      const matches: ContactMatch[] = [];
      for (let i = 0; i < emails.length; i += 50) {
        const chunk = emails.slice(i, i + 50);
        const { data: users } = await supabase
          .from('users')
          .select('id, name, email, handicap_index, avatar_color, city, state')
          .in('email', chunk);

        if (users) {
          users.forEach((u) => {
            if (u.id !== user?.id) {
              matches.push({
                contactName: emailMap.get(u.email.toLowerCase()) ?? u.name,
                email: u.email,
                dormieUser: u as User,
              });
            }
          });
        }
      }

      // Also add non-Dormie contacts (limited to first 20 for performance)
      const dormieEmails = new Set(matches.map(m => m.email.toLowerCase()));
      let nonDormieCount = 0;
      for (const [email, name] of emailMap.entries()) {
        if (!dormieEmails.has(email) && nonDormieCount < 20) {
          matches.push({ contactName: name, email });
          nonDormieCount++;
        }
      }

      setContactMatches(matches);
    } catch (e) {
      logWarn('Friends: contact matching failed', e);
      setContactMatches([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleRequestContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      setContactsPermission('granted');
      setShowContactsPrompt(false);
      loadContactMatches();
    } else {
      setContactsPermission('denied');
      setShowContactsPrompt(false);
    }
  };

  const handleShareInvite = async () => {
    haptics.light();
    try {
      await Share.share({
        message: 'Dormie — golf competition app for our crew. Tracks rounds, runs seasons, settles bets. Join up: https://expo.dev/projects/dormie (Download Expo Go first)',
      });
    } catch {}
  };

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
        setResults(data.filter((u) => u.id !== user?.id));
      } catch (e) {
        logWarn('Friends: user search failed', e);
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

  const handleAcceptRequest = async (friendship: FriendshipWithUser) => {
    if (acceptingId) return;
    haptics.light();
    setAcceptingId(friendship.id);
    try {
      await friendsService.acceptRequest(friendship.id);
      setPendingRequests((prev) => prev.filter((r) => r.id !== friendship.id));
      showToast({ message: 'Friend added', type: 'success', icon: 'checkmark-circle' });
      disableDemoIfNeeded().catch(() => {});
    } catch (e) {
      logWarn('Friends: accept request failed', e);
      showToast({ message: 'Failed to accept request', type: 'error' });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineRequest = async (friendship: FriendshipWithUser) => {
    if (decliningId) return;
    haptics.light();
    setDecliningId(friendship.id);
    try {
      await friendsService.rejectRequest(friendship.id);
      setPendingRequests((prev) => prev.filter((r) => r.id !== friendship.id));
      showToast({ message: 'Request declined', type: 'success' });
    } catch (e) {
      logWarn('Friends: decline request failed', e);
      showToast({ message: 'Failed to decline request', type: 'error' });
    } finally {
      setDecliningId(null);
    }
  };

  const handleInviteContact = async (contactName: string) => {
    haptics.light();
    try {
      await Share.share({
        message: `Dormie — golf competition app for our crew. Tracks rounds, runs seasons, settles bets. Join up: https://expo.dev/projects/dormie (Download Expo Go first)`,
      });
    } catch {}
  };

  const dormieContacts = contactMatches.filter(m => m.dormieUser);
  const nonDormieContacts = contactMatches.filter(m => !m.dormieUser);

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={greenHeaderGradient}
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

      <FlatList
        data={[]}
        renderItem={() => null}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        ListHeaderComponent={
          <View>
            {/* ─── PENDING FRIEND REQUESTS ─── */}
            {pendingRequests.length > 0 && (
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <Text style={[styles.sectionLabel, { color: c.gold }]}>PENDING REQUESTS</Text>
                <GoldDivider style={{ marginBottom: 8 }} />
                {pendingRequests.map((request) => {
                  const friend = request.friend as any;
                  const isAccepting = acceptingId === request.id;
                  const isDeclining = decliningId === request.id;
                  return (
                    <View
                      key={request.id}
                      style={[styles.requestRow, { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow }]}
                    >
                      <Avatar id={friend?.id ?? ''} size={44} name={friend?.name} />
                      <View style={styles.requestInfo}>
                        <Text style={[styles.requestName, { color: c.text }]}>{friend?.name ?? 'Unknown'}</Text>
                        {(friend?.city || friend?.state) && (
                          <Text style={[styles.requestLocation, { color: c.textMuted }]}>
                            {[friend?.city, friend?.state].filter(Boolean).join(', ')}
                          </Text>
                        )}
                      </View>
                      <Pressable
                        onPress={() => handleAcceptRequest(request)}
                        disabled={isAccepting || isDeclining}
                        style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.7 }]}
                      >
                        {isAccepting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeclineRequest(request)}
                        disabled={isAccepting || isDeclining}
                        style={({ pressed }) => [styles.declineBtn, { borderColor: c.border }, pressed && { opacity: 0.7 }]}
                      >
                        {isDeclining ? (
                          <ActivityIndicator size="small" color={c.textMuted} />
                        ) : (
                          <Text style={[styles.declineBtnText, { color: c.textMuted }]}>Decline</Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ─── INVITE FRIENDS ─── */}
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={[styles.sectionLabel, { color: c.gold }]}>INVITE FRIENDS</Text>
              <GoldDivider style={{ marginBottom: 12 }} />
              <Pressable
                onPress={handleShareInvite}
                style={({ pressed }) => [
                  styles.inviteBtn,
                  { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="share-outline" size={20} color={c.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inviteTitle, { color: c.text }]}>Share Invite Link</Text>
                  <Text style={[styles.inviteDesc, { color: c.textMuted }]}>
                    Send via text, email, or any app
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            </View>

            {/* ─── PEOPLE YOU MAY KNOW (Contacts) ─── */}
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <Text style={[styles.sectionLabel, { color: c.gold }]}>PEOPLE YOU MAY KNOW</Text>
              <GoldDivider style={{ marginBottom: 12 }} />

              {/* Contacts permission prompt */}
              {contactsPermission === 'undetermined' && showContactsPrompt && (
                <View style={[styles.contactsPrompt, { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow }]}>
                  <Ionicons name="people-outline" size={24} color={c.teal} style={{ marginBottom: 8 }} />
                  <Text style={[styles.contactsPromptTitle, { color: c.text }]}>
                    Find friends on Dormie
                  </Text>
                  <Text style={[styles.contactsPromptDesc, { color: c.textMuted }]}>
                    We only match email addresses and never store your contact list.
                  </Text>
                  <Pressable
                    onPress={handleRequestContacts}
                    style={({ pressed }) => [styles.contactsAllowBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.contactsAllowText}>Check Contacts</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowContactsPrompt(false)}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    <Text style={[styles.contactsSkipText, { color: c.textMuted }]}>Not now</Text>
                  </Pressable>
                </View>
              )}

              {contactsPermission === 'denied' && (
                <Text style={[styles.contactsDenied, { color: c.textMuted }]}>
                  Enable contacts in Settings to find friends on Dormie.
                </Text>
              )}

              {loadingContacts && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator color={c.teal} />
                  <Text style={[{ color: c.textMuted, marginTop: 8, fontSize: 13 }]}>Checking contacts...</Text>
                </View>
              )}

              {/* Dormie users from contacts */}
              {dormieContacts.length > 0 && (
                <View>
                  {dormieContacts.map((match) => {
                    const u = match.dormieUser!;
                    const isSent = sentIds.has(u.id);
                    const isSending = sendingId === u.id;
                    return (
                      <View
                        key={u.id}
                        style={[styles.resultRow, { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow }]}
                      >
                        <Avatar id={u.id} size={44} name={u.name} />
                        <View style={styles.resultInfo}>
                          <Text style={[styles.resultName, { color: c.text }]}>{u.name}</Text>
                          <Text style={[styles.resultLocation, { color: c.textMuted }]}>
                            From your contacts
                          </Text>
                        </View>
                        {isSent ? (
                          <View style={[styles.sentBadge, { backgroundColor: `${c.teal}20` }]}>
                            <Ionicons name="checkmark" size={14} color={c.teal} />
                            <Text style={[styles.sentText, { color: c.teal }]}>Sent</Text>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleSendRequest(u.id)}
                            disabled={isSending}
                            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
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
                  })}
                </View>
              )}

              {/* Non-Dormie contacts — invite them */}
              {nonDormieContacts.length > 0 && (
                <View style={{ marginTop: dormieContacts.length > 0 ? 12 : 0 }}>
                  {nonDormieContacts.slice(0, 10).map((match, i) => (
                    <View
                      key={`contact-${i}`}
                      style={[styles.resultRow, { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow }]}
                    >
                      <View style={[styles.contactInitialCircle, { backgroundColor: c.elevated }]}>
                        <Text style={[styles.contactInitialText, { color: c.textMuted }]}>
                          {match.contactName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={[styles.resultName, { color: c.text }]}>{match.contactName}</Text>
                        <Text style={[styles.resultLocation, { color: c.textMuted }]}>Not on Dormie yet</Text>
                      </View>
                      <Pressable
                        onPress={() => handleInviteContact(match.contactName)}
                        style={({ pressed }) => [styles.inviteContactBtn, { borderColor: c.teal }, pressed && { opacity: 0.7 }]}
                      >
                        <Ionicons name="paper-plane-outline" size={12} color={c.teal} />
                        <Text style={[styles.inviteContactText, { color: c.teal }]}>Invite</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {contactsPermission === 'granted' && !loadingContacts && contactMatches.length === 0 && (
                <Text style={[styles.contactsDenied, { color: c.textMuted }]}>
                  No matches found in your contacts.
                </Text>
              )}
            </View>

            {/* ─── SEARCH BY NAME ─── */}
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <Text style={[styles.sectionLabel, { color: c.gold }]}>SEARCH BY NAME</Text>
              <GoldDivider style={{ marginBottom: 12 }} />
            </View>

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
              />
              {query.length > 0 && (
                <Pressable onPress={() => { setQuery(''); setResults([]); }} hitSlop={12}>
                  <Ionicons name="close-circle" size={18} color={c.textMuted} />
                </Pressable>
              )}
            </View>

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

            {/* Search results */}
            {results.map((item) => {
              const isSent = sentIds.has(item.id);
              const isSending = sendingId === item.id;
              return (
                <View
                  key={item.id}
                  style={[styles.resultRow, { marginHorizontal: 16, backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow }]}
                >
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
                      style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
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
            })}
          </View>
        }
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
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: GEO,
  },
  // Invite section
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    padding: 16,
  },
  inviteTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: SANS,
  },
  inviteDesc: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: SANS,
  },
  // Contacts prompt
  contactsPrompt: {
    alignItems: 'center',
    padding: 20,
    borderWidth: 1,
  },
  contactsPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: SANS,
    marginBottom: 4,
  },
  contactsPromptDesc: {
    fontSize: 13,
    fontFamily: SANS,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  contactsAllowBtn: {
    backgroundColor: '#006747',
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginBottom: 8,
  },
  contactsAllowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: SANS,
  },
  contactsSkipText: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 8,
  },
  contactsDenied: {
    fontSize: 13,
    fontFamily: SANS,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  contactInitialCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInitialText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: GEO,
  },
  inviteContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inviteContactText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Search
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
    paddingTop: 32,
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
  // Result rows
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
  // Pending requests
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: SANS,
  },
  requestLocation: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: SANS,
  },
  acceptBtn: {
    backgroundColor: '#006747',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  declineBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  declineBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
