import { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/lib/auth';
import { GEO } from '../../src/theme/fonts';
import { useGroupChat } from '../../src/hooks/useGroupChat';
import { MessageBubble } from '../../src/components/chat/MessageBubble';
import { LiveIndicator } from '../../src/components/common/LiveIndicator';

export default function ChatScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { messages, isLive, loading, hasMore, loadMore, send, markRead } = useGroupChat({
    groupId: groupId ?? null,
    userId: user?.id ?? null,
  });
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<any>>(null);

  useEffect(() => {
    markRead();
  }, [messages.length, markRead]);

  useEffect(() => {
    if (messages.length > 0) {
      // Scroll to end on new messages
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const onSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      await send(body);
    } catch {
      setDraft(body); // restore on failure
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderColor: c.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.title, { color: c.text, fontFamily: GEO }]}>CHAT</Text>
          <LiveIndicator live={isLive} />
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        onEndReachedThreshold={0.2}
        onRefresh={hasMore ? loadMore : undefined}
        refreshing={loading}
        contentContainerStyle={{ paddingVertical: 10, flexGrow: 1, justifyContent: 'flex-end' }}
        renderItem={({ item, index }) => {
          const prev = messages[index - 1];
          const samePrev = prev && prev.user_id === item.user_id;
          return (
            <MessageBubble
              message={item}
              isMe={item.user_id === user?.id}
              showAvatar={!samePrev}
              showName={!samePrev}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={c.textMuted} />
            <Text style={{ color: c.textMuted, marginTop: 8 }}>No messages yet. Start the group chat.</Text>
          </View>
        }
      />

      <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.cardBg }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={c.textMuted}
          multiline
          style={[styles.input, { color: c.text, backgroundColor: c.elevated, borderColor: c.border }]}
        />
        <Pressable
          onPress={onSend}
          disabled={!draft.trim()}
          style={[
            styles.sendBtn,
            { backgroundColor: draft.trim() ? c.gold : c.border },
          ]}
        >
          <Ionicons name="send" size={16} color={draft.trim() ? '#000' : c.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 14, letterSpacing: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, borderWidth: 1,
  },
  sendBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
});
