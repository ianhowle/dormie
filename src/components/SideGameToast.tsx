import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { haptics } from '../lib/haptics';
import { GEO } from '../theme/fonts';
import { tickerShadowDark, tickerShadowLight } from '../theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const AUTO_DISMISS_MS = 3000;

// ─── Types ────────────────────────────────────────────────────────────
export type TriggerType = 'auto' | 'semi_auto' | 'manual';

export type SideGameEvent = {
  id: string;
  gameKey: string;
  label: string;
  trigger: TriggerType;
  playerName: string;
  holeNumber: number;
  description: string;
  /** For manual events — what input is needed */
  inputLabel?: string;
  inputUnit?: string;
  /** Resolved value (from user input or auto-detection) */
  value?: string;
};

export type SideGameToastProps = {
  events: SideGameEvent[];
  onConfirm: (eventId: string, value?: string) => void;
  onDismiss: (eventId: string) => void;
};

// ─── Side game triggers map ───────────────────────────────────────────
export function detectSideGameEvents(
  gameKey: string,
  holeNumber: number,
  par: number,
  gross: number,
  putts: number,
  playerName: string,
  isFir: boolean | null,
  isGir: boolean,
  isSave: boolean,
): SideGameEvent[] {
  const events: SideGameEvent[] = [];
  const id = `${gameKey}-${holeNumber}-${Date.now()}`;

  switch (gameKey) {
    case 'snake':
      if (putts >= 3) {
        events.push({
          id,
          gameKey: 'snake',
          label: 'Snake',
          trigger: 'auto',
          playerName,
          holeNumber,
          description: `${playerName} three-putted — picks up the snake!`,
        });
      }
      break;

    case 'dots':
      if (gross - par <= -1) {
        events.push({
          id: `${id}-birdie`,
          gameKey: 'dots',
          label: 'Dots — Birdie',
          trigger: 'auto',
          playerName,
          holeNumber,
          description: `${playerName} made birdie (+1 dot)`,
        });
      }
      if (putts === 1) {
        events.push({
          id: `${id}-oneputt`,
          gameKey: 'dots',
          label: 'Dots — One-putt',
          trigger: 'auto',
          playerName,
          holeNumber,
          description: `${playerName} one-putted (+1 dot)`,
        });
      }
      if (putts >= 3) {
        events.push({
          id: `${id}-threeputt`,
          gameKey: 'dots',
          label: 'Dots — Three-putt',
          trigger: 'auto',
          playerName,
          holeNumber,
          description: `${playerName} three-putted (-1 dot)`,
        });
      }
      break;

    case 'greenies':
      if (par === 3) {
        events.push({
          id,
          gameKey: 'greenies',
          label: 'Greenie?',
          trigger: 'semi_auto',
          playerName,
          holeNumber,
          description: `Did ${playerName} hit the green on this par 3?`,
        });
      }
      break;

    case 'sandies':
      if (isSave) {
        events.push({
          id,
          gameKey: 'sandies',
          label: 'Sandy?',
          trigger: 'semi_auto',
          playerName,
          holeNumber,
          description: `Did ${playerName} save par from a bunker?`,
        });
      }
      break;

    case 'bark':
      if (isSave && isFir === false) {
        events.push({
          id,
          gameKey: 'bark',
          label: 'Barkie?',
          trigger: 'semi_auto',
          playerName,
          holeNumber,
          description: `Did ${playerName} save par after hitting a tree?`,
        });
      }
      break;

    case 'arnies':
      if (gross <= par && isFir === false && !isGir) {
        events.push({
          id,
          gameKey: 'arnies',
          label: 'Arnie?',
          trigger: 'semi_auto',
          playerName,
          holeNumber,
          description: `${playerName} made par without hitting fairway or green — Arnie?`,
        });
      }
      break;

    case 'close_shave':
      if (par === 3 || isGir) {
        events.push({
          id,
          gameKey: 'close_shave',
          label: 'KP',
          trigger: 'manual',
          playerName,
          holeNumber,
          description: `How close was ${playerName}'s approach?`,
          inputLabel: 'Distance to pin',
          inputUnit: 'ft',
        });
      }
      break;

    case 'poleys':
      if (putts === 1) {
        events.push({
          id,
          gameKey: 'poleys',
          label: 'Longest Putt',
          trigger: 'manual',
          playerName,
          holeNumber,
          description: `How long was ${playerName}'s one-putt?`,
          inputLabel: 'Putt distance',
          inputUnit: 'ft',
        });
      }
      break;

    case 'bingo_bango_bongo':
      // BINGO: first on green (auto-detect from GIR)
      if (isGir) {
        events.push({
          id: `${id}-bingo`,
          gameKey: 'bingo_bango_bongo',
          label: 'Bingo!',
          trigger: 'auto',
          playerName,
          holeNumber,
          description: `${playerName} hit the green in regulation`,
        });
      }
      // BONGO: first to hole out (auto-detect from score entry)
      if (gross > 0) {
        events.push({
          id: `${id}-bongo`,
          gameKey: 'bingo_bango_bongo',
          label: 'Bongo!',
          trigger: 'auto',
          playerName,
          holeNumber,
          description: `${playerName} holed out`,
        });
      }
      // BANGO: closest to pin (semi-auto prompt)
      events.push({
        id: `${id}-bango`,
        gameKey: 'bingo_bango_bongo',
        label: 'Bango — Closest to pin?',
        trigger: 'semi_auto',
        playerName,
        holeNumber,
        description: `Was ${playerName} closest to the pin once all were on the green?`,
      });
      break;
  }

  return events;
}

// ─── Auto Toast ───────────────────────────────────────────────────────
function AutoToast({
  event,
  onDismiss,
}: {
  event: SideGameEvent;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 100, duration: 250, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [slideAnim, opacityAnim, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: c.teal, opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
        theme.isDark ? tickerShadowDark : tickerShadowLight,
      ]}
    >
      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
      <View style={{ flex: 1 }}>
        <Text style={styles.toastLabel}>{event.label}</Text>
        <Text style={styles.toastDesc}>{event.description}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Semi-Auto Toast ──────────────────────────────────────────────────
function SemiAutoToast({
  event,
  onConfirm,
  onDismiss,
}: {
  event: SideGameEvent;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, opacityAnim]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 100, duration: 250, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [slideAnim, opacityAnim, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.toast,
        styles.toastSemiAuto,
        { backgroundColor: c.gold, opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
        theme.isDark ? tickerShadowDark : tickerShadowLight,
      ]}
    >
      <Ionicons name="help-circle" size={20} color="#000000" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.toastLabel, { color: '#000000' }]}>{event.label}</Text>
        <Text style={[styles.toastDesc, { color: '#00000099' }]}>{event.description}</Text>
      </View>
      <View style={styles.toastActions}>
        <Pressable onPress={() => { haptics.light(); onConfirm(); }} style={[styles.toastBtn, { backgroundColor: '#00000022' }]}>
          <Ionicons name="checkmark" size={18} color="#000000" />
        </Pressable>
        <Pressable onPress={() => { haptics.light(); dismiss(); }} style={[styles.toastBtn, { backgroundColor: '#00000011' }]}>
          <Ionicons name="close" size={18} color="#000000" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Manual Input Modal ───────────────────────────────────────────────
function ManualInputModal({
  event,
  onSubmit,
  onCancel,
}: {
  event: SideGameEvent;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [inputValue, setInputValue] = useState('');

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <View style={styles.modalHeader}>
            <Ionicons name="create" size={24} color={c.gold} />
            <Text style={[styles.modalTitle, { color: c.text }]}>{event.label}</Text>
          </View>

          <Text style={[styles.modalDesc, { color: c.textMuted }]}>{event.description}</Text>

          <View style={styles.modalInputRow}>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="0"
              placeholderTextColor={c.textMuted}
              keyboardType="numeric"
              style={[styles.modalInput, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
              autoFocus
            />
            {event.inputUnit && (
              <Text style={[styles.modalUnit, { color: c.textMuted }]}>{event.inputUnit}</Text>
            )}
          </View>

          <View style={styles.modalActions}>
            <Pressable onPress={() => { haptics.light(); onCancel(); }} style={[styles.modalBtn, { backgroundColor: c.elevated }]}>
              <Text style={[styles.modalBtnText, { color: c.textMuted }]}>Skip</Text>
            </Pressable>
            <Pressable
              onPress={() => { haptics.light(); onSubmit(inputValue); }}
              style={[styles.modalBtn, { backgroundColor: c.gold }]}
            >
              <Text style={[styles.modalBtnText, { color: '#000000' }]}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Component (Toast Queue) ─────────────────────────────────────
export function SideGameToast({ events, onConfirm, onDismiss }: SideGameToastProps) {
  const [queue, setQueue] = useState<SideGameEvent[]>([]);
  const [manualEvent, setManualEvent] = useState<SideGameEvent | null>(null);

  // Add new events to queue
  useEffect(() => {
    if (events.length > 0) {
      setQueue((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEvents = events.filter((e) => !existingIds.has(e.id));
        return [...prev, ...newEvents];
      });
    }
  }, [events]);

  // Process queue — show one at a time
  const current = queue[0];

  const handleDismiss = useCallback((eventId: string) => {
    onDismiss(eventId);
    setQueue((prev) => prev.filter((e) => e.id !== eventId));
  }, [onDismiss]);

  const handleConfirm = useCallback((eventId: string, value?: string) => {
    onConfirm(eventId, value);
    setQueue((prev) => prev.filter((e) => e.id !== eventId));
  }, [onConfirm]);

  if (!current && !manualEvent) return null;

  // Manual event takes priority as modal
  if (manualEvent) {
    return (
      <ManualInputModal
        event={manualEvent}
        onSubmit={(val) => {
          handleConfirm(manualEvent.id, val);
          setManualEvent(null);
        }}
        onCancel={() => {
          handleDismiss(manualEvent.id);
          setManualEvent(null);
        }}
      />
    );
  }

  if (!current) return null;

  // If current is manual, show modal
  if (current.trigger === 'manual') {
    // Move to manual state on next render
    setTimeout(() => {
      setManualEvent(current);
      setQueue((prev) => prev.slice(1));
    }, 0);
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {current.trigger === 'auto' && (
        <AutoToast
          key={current.id}
          event={current}
          onDismiss={() => handleDismiss(current.id)}
        />
      )}
      {current.trigger === 'semi_auto' && (
        <SemiAutoToast
          key={current.id}
          event={current}
          onConfirm={() => handleConfirm(current.id)}
          onDismiss={() => handleDismiss(current.id)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 200,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  toastSemiAuto: {},
  toastLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  toastDesc: { fontSize: 10, color: '#FFFFFFCC', marginTop: 2 },
  toastActions: { flexDirection: 'row', gap: 6 },
  toastBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Manual modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { padding: 20, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalDesc: { fontSize: 13, marginTop: 8, lineHeight: 20 },
  modalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  modalInput: { flex: 1, fontSize: 24, fontFamily: GEO, fontWeight: '700', letterSpacing: -1, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, textAlign: 'center' },
  modalUnit: { fontSize: 16, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
});
