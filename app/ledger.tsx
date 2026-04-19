import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, Modal, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { GEO } from '../src/theme/fonts';
import { supabase } from '../src/lib/supabase';
import {
  ledgerService,
  type Balance,
  type LedgerEntry,
  type SimplifiedDebt,
} from '../src/services/ledger.service';

type UserRow = { id: string; name: string };

export default function LedgerScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [simplified, setSimplified] = useState<SimplifiedDebt[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [settleTarget, setSettleTarget] = useState<SimplifiedDebt | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const myEntries = await ledgerService.getEntriesForUser(user.id, { limit: 100 });
      const peerIds = new Set<string>();
      myEntries.forEach((e) => {
        peerIds.add(e.from_user_id);
        peerIds.add(e.to_user_id);
      });
      peerIds.add(user.id);
      const allIds = Array.from(peerIds);
      const [grpBalances, simp] = await Promise.all([
        ledgerService.getGroupBalances(allIds),
        ledgerService.getSimplifiedDebts(allIds),
      ]);
      setBalances(grpBalances);
      setSimplified(simp);
      setEntries(myEntries);

      if (allIds.length > 0) {
        const { data } = await supabase.from('users').select('id,name').in('id', allIds);
        const map: Record<string, UserRow> = {};
        (data ?? []).forEach((u: any) => { map[u.id] = { id: u.id, name: u.name }; });
        setUsers(map);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const myBalance = balances.find((b) => b.userId === user?.id)?.netBalance ?? 0;

  const relevantDebts = useMemo(() =>
    simplified.filter((d) => d.from === user?.id || d.to === user?.id),
    [simplified, user?.id],
  );

  const nameOf = (id: string) => (id === user?.id ? 'You' : users[id]?.name ?? 'Unknown');

  const openSettle = (d: SimplifiedDebt) => {
    setSettleTarget(d);
    setSettleAmount(String(d.amount));
    setSettleNote('');
  };

  const confirmSettle = async () => {
    if (!settleTarget || !user) return;
    const amt = Number(settleAmount);
    if (!amt || amt <= 0) return;
    await ledgerService.recordSettlement({
      fromUserId: settleTarget.from,
      toUserId: settleTarget.to,
      amount: amt,
      note: settleNote || undefined,
    });
    setSettleTarget(null);
    await load();
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderColor: c.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text, fontFamily: GEO }]}>LEDGER</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.gold} />}
      >
        <View style={[styles.hero, { borderColor: myBalance >= 0 ? c.teal : c.urgent, backgroundColor: myBalance >= 0 ? `${c.teal}10` : `${c.urgent}10` }]}>
          <Text style={[styles.heroLabel, { color: c.textMuted }]}>NET BALANCE</Text>
          <Text style={[styles.heroValue, { color: myBalance >= 0 ? c.teal : c.urgent, fontFamily: GEO }]}>
            {myBalance >= 0 ? '+' : '-'}${Math.abs(myBalance).toFixed(2)}
          </Text>
          <Text style={[styles.heroSub, { color: c.textMuted }]}>
            {myBalance >= 0 ? 'Others owe you' : 'You owe others'}
          </Text>
        </View>

        <Text style={[styles.section, { color: c.gold, fontFamily: GEO }]}>SIMPLIFIED DEBTS</Text>
        {loading ? (
          <Text style={{ color: c.textMuted }}>Loading…</Text>
        ) : relevantDebts.length === 0 ? (
          <View style={[styles.empty, { borderColor: c.border }]}>
            <Ionicons name="checkmark-done-circle" size={32} color={c.teal} />
            <Text style={{ color: c.textMuted, marginTop: 8 }}>All settled up</Text>
          </View>
        ) : (
          relevantDebts.map((d, idx) => {
            const isMine = d.from === user?.id;
            return (
              <Pressable
                key={idx}
                onPress={() => isMine && openSettle(d)}
                style={[styles.debtRow, { borderColor: c.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.debtText, { color: c.text }]}>
                    {isMine ? `You owe ${nameOf(d.to)}` : `${nameOf(d.from)} owes you`}
                  </Text>
                </View>
                <Text style={[styles.debtAmount, { color: isMine ? c.urgent : c.teal, fontFamily: GEO }]}>
                  ${d.amount.toFixed(2)}
                </Text>
                {isMine && <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={{ marginLeft: 6 }} />}
              </Pressable>
            );
          })
        )}

        <Text style={[styles.section, { color: c.gold, fontFamily: GEO, marginTop: 24 }]}>RECENT ACTIVITY</Text>
        {entries.length === 0 ? (
          <Text style={{ color: c.textMuted }}>No activity yet</Text>
        ) : (
          entries.slice(0, 25).map((e) => {
            const isCredit = e.to_user_id === user?.id;
            return (
              <View key={e.id} style={[styles.entry, { borderColor: c.border }]}>
                <Ionicons
                  name={isCredit ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={18}
                  color={isCredit ? c.teal : c.urgent}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.entryText, { color: c.text }]}>
                    {isCredit ? `${nameOf(e.from_user_id)} → You` : `You → ${nameOf(e.to_user_id)}`}
                  </Text>
                  {e.memo && <Text style={[styles.entryMemo, { color: c.textMuted }]}>{e.memo}</Text>}
                </View>
                <Text style={[styles.entryAmount, { color: isCredit ? c.teal : c.urgent, fontFamily: GEO }]}>
                  {isCredit ? '+' : '-'}${Number(e.amount).toFixed(2)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Settle modal */}
      <Modal visible={!!settleTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
            <Text style={[styles.modalTitle, { color: c.gold, fontFamily: GEO }]}>SETTLE UP</Text>
            {settleTarget && (
              <Text style={[styles.modalText, { color: c.text }]}>
                Pay {nameOf(settleTarget.to)} ${settleTarget.amount.toFixed(2)}
              </Text>
            )}
            <TextInput
              value={settleAmount}
              onChangeText={setSettleAmount}
              keyboardType="numeric"
              placeholder="Amount"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.elevated }]}
            />
            <TextInput
              value={settleNote}
              onChangeText={setSettleNote}
              placeholder="Note (venmo, cash...)"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, marginTop: 8 }]}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => setSettleTarget(null)} style={[styles.modalBtn, { borderColor: c.border }]}>
                <Text style={{ color: c.text }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmSettle} style={[styles.modalBtn, { backgroundColor: c.gold, flex: 1 }]}>
                <Text style={{ color: '#000', fontWeight: '700' }}>Record Payment</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 14, letterSpacing: 2 },
  hero: { padding: 16, borderWidth: 1, alignItems: 'center', marginBottom: 16 },
  heroLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  heroValue: { fontSize: 36, marginTop: 6 },
  heroSub: { fontSize: 11, marginTop: 4 },
  section: { fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  empty: { borderWidth: 1, padding: 20, alignItems: 'center' },
  debtRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderWidth: 1, marginBottom: 6,
  },
  debtText: { fontSize: 13 },
  debtAmount: { fontSize: 18 },
  entry: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryText: { fontSize: 13 },
  entryMemo: { fontSize: 11, marginTop: 2 },
  entryAmount: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%', padding: 18, borderWidth: 1 },
  modalTitle: { fontSize: 13, letterSpacing: 2, textAlign: 'center', marginBottom: 10 },
  modalText: { fontSize: 14, textAlign: 'center', marginBottom: 10 },
  input: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, alignItems: 'center' },
});
