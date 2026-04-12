import { useRef } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { captureAndShare } from '../../services/shareCard.service';

// react-native-view-shot may not be installed in every dev env — fall back gracefully.
let ViewShot: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ViewShot = require('react-native-view-shot').default ?? require('react-native-view-shot').ViewShot;
} catch {
  ViewShot = null;
}

export type ShareButtonProps = {
  children: React.ReactNode;
  filename?: string;
  label?: string;
  /** 9:16 story, 1:1 feed, or custom dimensions wrapper from the caller */
  style?: any;
};

/**
 * Wraps content in a ViewShot capture target and renders a premium share CTA.
 * Captures whatever is passed as children at high quality, then shares via the
 * native share sheet (iOS/Android) or Web Share API.
 */
export function ShareButton({ children, filename = 'dormie.png', label = 'SHARE', style }: ShareButtonProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const ref = useRef<any>(null);

  const onShare = () => captureAndShare(ref, { filename, dialogTitle: 'Share to…' });

  const content = (
    <View style={style}>{children}</View>
  );

  return (
    <View>
      {ViewShot ? (
        <ViewShot ref={ref} options={{ format: 'png', quality: 1.0 }}>
          {content}
        </ViewShot>
      ) : (
        content
      )}
      <Pressable onPress={onShare} style={[styles.btn, { backgroundColor: c.gold }]}>
        <Ionicons name="share-outline" size={16} color="#000" />
        <Text style={[styles.btnText, { fontFamily: GEO }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16, marginTop: 12,
  },
  btnText: { fontSize: 12, letterSpacing: 2, fontWeight: '700', color: '#000' },
});
