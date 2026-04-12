import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Avatar } from '../Avatar';
import { GEO } from '../../theme/fonts';
import type { ChatMessageWithUser } from '../../services/chat.service';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function MessageBubble({
  message,
  isMe,
  showAvatar = true,
  showName = true,
}: {
  message: ChatMessageWithUser;
  isMe: boolean;
  showAvatar?: boolean;
  showName?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const name = message.user?.name ?? 'Unknown';
  const bubbleBg = isMe ? c.teal : c.elevated;
  const bubbleText = isMe ? '#FFFFFF' : c.text;

  return (
    <View style={[styles.row, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
      {!isMe && showAvatar && (
        <View style={{ marginRight: 8, alignSelf: 'flex-end' }}>
          <Avatar id={message.user_id} size={28} name={name} />
        </View>
      )}
      <View style={{ maxWidth: '78%' }}>
        {!isMe && showName && (
          <Text style={[styles.name, { color: c.textMuted }]}>{name}</Text>
        )}
        <View style={[styles.bubble, { backgroundColor: bubbleBg, borderColor: isMe ? c.teal : c.border }]}>
          <Text style={[styles.body, { color: bubbleText }]}>{message.body}</Text>
          <View style={styles.metaRow}>
            {message.edited_at && (
              <Text style={[styles.meta, { color: isMe ? 'rgba(255,255,255,0.7)' : c.textMuted }]}>edited</Text>
            )}
            <Text style={[styles.meta, { color: isMe ? 'rgba(255,255,255,0.85)' : c.textMuted, fontFamily: GEO }]}>
              {formatTime(message.created_at)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 3, paddingHorizontal: 12 },
  name: { fontSize: 10, marginBottom: 2, marginLeft: 2, fontWeight: '600' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  body: { fontSize: 14, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, justifyContent: 'flex-end' },
  meta: { fontSize: 9, letterSpacing: 1 },
});
