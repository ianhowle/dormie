import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { WagerType } from '../../services/ledger.service';
import type { PlayerConfig } from '../../scoring/types';

type WagerDraft = {
  name: string;
  type: WagerType;
  amount: number;
  participantIds: string[];
};

const TYPE_OPTIONS: { key: WagerType; label: string; hint: string }[] = [
  { key: 'nassau', label: 'Nassau', hint: 'Front / Back / Overall' },
  { key: 'skins', label: 'Skins', hint: 'Per-hole winner takes pot' },
  { key: 'match', label: 'Match', hint: '1v1 or team match' },
  { key: 'dots', label: 'Dots', hint: 'Dots for GIR/birdie/sandie/etc.' },
  { key: 'custom', label: 'Custom', hint: 'Define your own stakes' },
];

export function WagerSetup({
  visible,
  players,
  onCancel,
  onSave,
}: {
  visible: boolean;
  players: PlayerConfig[];
  onCancel: () => void;
  onSave: (wager: WagerDraft) => void | Promise<void>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [type, setType] = useState<WagerType>('nassau');
  const [amount, setAmount] = useState('5');
  const [name, setName] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>(() => players.map((p) => p.id));

  const toggle = (pid: string) => {
    setParticipantIds((prev) => (prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]));
  };

  const handleSave = () => {
    const parsedAmount = Number(amount) || 0;
    onSave({
      name: name.trim() || (TYPE_OPTIONS.find((t) => t.key === type)?.label ?? 'Wager'),
      type,
      amount: parsedAmount,
      participantIds,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
          <Text style={[styles.title, { color: c.gold, fontFamily: GEO }]}>SET A WAGER</Text>

          <ScrollView style={{ maxHeight: 480 }}>
            <Text style={[styles.label, { color: c.textMuted }]}>TYPE</Text>
            <View style={{ gap: 6 }}>
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setType(opt.key)}
                    style={[
                      styles.typeBtn,
                      { borderColor: active ? c.gold : c.border, backgroundColor: active ? `${c.gold}18` : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.typeLabel, { color: active ? c.gold : c.text }]}>{opt.label}</Text>
                    <Text style={[styles.typeHint, { color: c.textMuted }]}>{opt.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: c.textMuted, marginTop: 14 }]}>NAME (optional)</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Sunday Nassau"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.elevated }]}
            />

            <Text style={[styles.label, { color: c.textMuted, marginTop: 14 }]}>STAKE ($)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.elevated }]}
            />

            <Text style={[styles.label, { color: c.textMuted, marginTop: 14 }]}>PARTICIPANTS</Text>
            <View style={{ gap: 6 }}>
              {players.map((p) => {
                const active = participantIds.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggle(p.id)}
                    style={[
                      styles.playerBtn,
                      { borderColor: active ? c.teal : c.border, backgroundColor: active ? `${c.teal}18` : 'transparent' },
                    ]}
                  >
                    <Ionicons name={active ? 'checkbox' : 'square-outline'} size={18} color={active ? c.teal : c.textMuted} />
                    <Text style={{ color: c.text, fontSize: 14 }}>{p.id === '1' ? 'You' : p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.btn, { borderColor: c.border }]}>
              <Text style={{ color: c.text }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.btn, { backgroundColor: c.gold, flex: 1 }]}>
              <Text style={{ color: '#000', fontWeight: '700' }}>Lock In</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  content: { width: '92%', padding: 18, borderWidth: 1 },
  title: { fontSize: 13, letterSpacing: 2, textAlign: 'center', marginBottom: 14 },
  label: { fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 6 },
  typeBtn: { padding: 10, borderWidth: 1 },
  typeLabel: { fontSize: 14, fontWeight: '600' },
  typeHint: { fontSize: 11, marginTop: 2 },
  input: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  playerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 8, borderWidth: 1,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, alignItems: 'center' },
});
