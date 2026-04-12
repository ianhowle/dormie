import { supabase } from '../lib/supabase';

export type WagerType = 'nassau' | 'skins' | 'match' | 'custom' | 'dots' | 'press' | 'auto_nassau' | 'auto_skins';
export type WagerStatus = 'open' | 'settled' | 'voided';

export type Wager = {
  id: string;
  creator_id: string;
  round_id: string | null;
  trip_id: string | null;
  name: string;
  type: WagerType;
  stakes: Record<string, unknown>;
  status: WagerStatus;
  created_at: string;
  settled_at: string | null;
};

export type LedgerEntry = {
  id: string;
  wager_id: string | null;
  round_id: string | null;
  trip_id: string | null;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  memo: string | null;
  kind: 'wager' | 'settlement' | 'adjustment';
  group_key: string | null;
  created_at: string;
};

export type Balance = { userId: string; netBalance: number };
export type PairwiseBalance = { fromUserId: string; toUserId: string; amount: number };
export type SimplifiedDebt = { from: string; to: string; amount: number };

export type CreateWagerInput = {
  creatorId: string;
  roundId?: string | null;
  tripId?: string | null;
  name: string;
  type: WagerType;
  stakes: Record<string, unknown>;
  participants: { userId: string; team?: string; buyIn?: number }[];
};

function newGroupKey(): string {
  return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const ledgerService = {
  async createWager(input: CreateWagerInput): Promise<Wager> {
    const { data: wager, error } = await supabase
      .from('wagers')
      .insert({
        creator_id: input.creatorId,
        round_id: input.roundId ?? null,
        trip_id: input.tripId ?? null,
        name: input.name,
        type: input.type,
        stakes: input.stakes,
        status: 'open',
      })
      .select()
      .single();
    if (error) throw error;
    const w = wager as Wager;
    if (input.participants.length > 0) {
      await supabase.from('wager_participants').insert(
        input.participants.map((p) => ({
          wager_id: w.id,
          user_id: p.userId,
          team: p.team ?? null,
          buy_in: p.buyIn ?? 0,
        })),
      );
    }
    return w;
  },

  async getWager(wagerId: string): Promise<Wager | null> {
    const { data } = await supabase.from('wagers').select('*').eq('id', wagerId).single();
    return (data as Wager) ?? null;
  },

  async getWagersByUser(userId: string): Promise<Wager[]> {
    const { data } = await supabase
      .from('wager_participants')
      .select('wager:wagers(*)')
      .eq('user_id', userId);
    return ((data ?? []) as any[]).map((r) => r.wager).filter(Boolean) as Wager[];
  },

  /**
   * Record a straight 1-to-1 win: loser owes winner `amount`.
   * Emits a single ledger entry from loser → winner.
   */
  async recordWin(args: {
    wagerId?: string | null;
    roundId?: string | null;
    tripId?: string | null;
    winnerId: string;
    loserId: string;
    amount: number;
    memo?: string;
  }): Promise<LedgerEntry> {
    const { data, error } = await supabase
      .from('ledger_entries')
      .insert({
        wager_id: args.wagerId ?? null,
        round_id: args.roundId ?? null,
        trip_id: args.tripId ?? null,
        from_user_id: args.loserId,
        to_user_id: args.winnerId,
        amount: args.amount,
        memo: args.memo ?? null,
        kind: 'wager',
        group_key: newGroupKey(),
      })
      .select()
      .single();
    if (error) throw error;
    return data as LedgerEntry;
  },

  /**
   * Multi-way result: winners split the total pot contributed by losers.
   * Generates paired entries (loser → each winner, pro-rata) inside a single group_key.
   */
  async recordMultiWayResult(args: {
    wagerId?: string | null;
    roundId?: string | null;
    tripId?: string | null;
    winners: string[]; // userIds
    losers: { userId: string; amount: number }[]; // each loser's total contribution
    memo?: string;
  }): Promise<LedgerEntry[]> {
    if (args.winners.length === 0 || args.losers.length === 0) return [];
    const groupKey = newGroupKey();
    const rows: Omit<LedgerEntry, 'id' | 'created_at'>[] = [];
    for (const loser of args.losers) {
      const perWinner = loser.amount / args.winners.length;
      if (perWinner <= 0) continue;
      for (const winnerId of args.winners) {
        if (winnerId === loser.userId) continue;
        rows.push({
          wager_id: args.wagerId ?? null,
          round_id: args.roundId ?? null,
          trip_id: args.tripId ?? null,
          from_user_id: loser.userId,
          to_user_id: winnerId,
          amount: Math.round(perWinner * 100) / 100,
          memo: args.memo ?? null,
          kind: 'wager',
          group_key: groupKey,
        });
      }
    }
    if (rows.length === 0) return [];
    const { data, error } = await supabase.from('ledger_entries').insert(rows).select();
    if (error) throw error;
    return (data ?? []) as LedgerEntry[];
  },

  async getEntriesForUser(userId: string, opts?: { limit?: number }): Promise<LedgerEntry[]> {
    const { data } = await supabase
      .from('ledger_entries')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 200);
    return (data ?? []) as LedgerEntry[];
  },

  /** Net balances across every user in a given scope (default: among all counterparties of userId). */
  async getGroupBalances(userIds: string[]): Promise<Balance[]> {
    if (userIds.length === 0) return [];
    const { data: entries } = await supabase
      .from('ledger_entries')
      .select('from_user_id,to_user_id,amount')
      .or(`from_user_id.in.(${userIds.join(',')}),to_user_id.in.(${userIds.join(',')})`);
    const { data: setts } = await supabase
      .from('settlements')
      .select('from_user_id,to_user_id,amount')
      .or(`from_user_id.in.(${userIds.join(',')}),to_user_id.in.(${userIds.join(',')})`);
    const balances: Record<string, number> = {};
    userIds.forEach((u) => { balances[u] = 0; });
    (entries ?? []).forEach((e: any) => {
      if (userIds.includes(e.from_user_id)) balances[e.from_user_id] -= Number(e.amount);
      if (userIds.includes(e.to_user_id)) balances[e.to_user_id] += Number(e.amount);
    });
    (setts ?? []).forEach((s: any) => {
      if (userIds.includes(s.from_user_id)) balances[s.from_user_id] += Number(s.amount);
      if (userIds.includes(s.to_user_id)) balances[s.to_user_id] -= Number(s.amount);
    });
    return Object.entries(balances).map(([userId, netBalance]) => ({ userId, netBalance }));
  },

  /** Raw pairwise debts (who owes who, unsimplified). */
  async getPairwiseBalances(userIds: string[]): Promise<PairwiseBalance[]> {
    const pair: Record<string, number> = {};
    const keyOf = (a: string, b: string) => `${a}->${b}`;

    const { data: entries } = await supabase
      .from('ledger_entries')
      .select('from_user_id,to_user_id,amount')
      .or(`from_user_id.in.(${userIds.join(',')}),to_user_id.in.(${userIds.join(',')})`);
    (entries ?? []).forEach((e: any) => {
      const k = keyOf(e.from_user_id, e.to_user_id);
      pair[k] = (pair[k] ?? 0) + Number(e.amount);
    });

    const { data: setts } = await supabase
      .from('settlements')
      .select('from_user_id,to_user_id,amount')
      .or(`from_user_id.in.(${userIds.join(',')}),to_user_id.in.(${userIds.join(',')})`);
    (setts ?? []).forEach((s: any) => {
      const k = keyOf(s.from_user_id, s.to_user_id);
      pair[k] = (pair[k] ?? 0) - Number(s.amount);
    });

    // Net opposing directions
    const result: PairwiseBalance[] = [];
    const seen = new Set<string>();
    Object.entries(pair).forEach(([key, amt]) => {
      if (seen.has(key)) return;
      const [from, to] = key.split('->');
      const reverse = pair[keyOf(to, from)] ?? 0;
      const net = amt - reverse;
      seen.add(key);
      seen.add(keyOf(to, from));
      if (net > 0.01) result.push({ fromUserId: from, toUserId: to, amount: Math.round(net * 100) / 100 });
      else if (net < -0.01) result.push({ fromUserId: to, toUserId: from, amount: Math.round(-net * 100) / 100 });
    });
    return result;
  },

  /** Greedy debt simplification: minimize total transactions among a group. */
  async getSimplifiedDebts(userIds: string[]): Promise<SimplifiedDebt[]> {
    const balances = await this.getGroupBalances(userIds);
    const creditors = balances.filter((b) => b.netBalance > 0.01).map((b) => ({ ...b }));
    const debtors = balances.filter((b) => b.netBalance < -0.01).map((b) => ({ ...b, netBalance: -b.netBalance }));
    creditors.sort((a, b) => b.netBalance - a.netBalance);
    debtors.sort((a, b) => b.netBalance - a.netBalance);

    const result: SimplifiedDebt[] = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].netBalance, creditors[j].netBalance);
      if (pay > 0.01) {
        result.push({ from: debtors[i].userId, to: creditors[j].userId, amount: Math.round(pay * 100) / 100 });
        debtors[i].netBalance -= pay;
        creditors[j].netBalance -= pay;
      }
      if (debtors[i].netBalance < 0.01) i++;
      if (creditors[j].netBalance < 0.01) j++;
    }
    return result;
  },

  async recordSettlement(args: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    method?: string;
    note?: string;
  }): Promise<void> {
    const { error } = await supabase.from('settlements').insert({
      from_user_id: args.fromUserId,
      to_user_id: args.toUserId,
      amount: args.amount,
      method: args.method ?? null,
      note: args.note ?? null,
    });
    if (error) throw error;
  },

  async getSettlementsForUser(userId: string) {
    const { data } = await supabase
      .from('settlements')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('settled_at', { ascending: false });
    return data ?? [];
  },

  /**
   * Auto-settle helpers for common side games at round end.
   * Callers compute winners/losers from scoring state; this persists the ledger entries.
   */
  async autoSettleNassau(args: {
    roundId: string;
    winners: string[];
    losers: { userId: string; amount: number }[];
    memo?: string;
  }) {
    return this.recordMultiWayResult({
      roundId: args.roundId,
      winners: args.winners,
      losers: args.losers,
      memo: args.memo ?? 'Nassau auto-settlement',
    });
  },

  async autoSettleSkins(args: {
    roundId: string;
    winners: string[];
    losers: { userId: string; amount: number }[];
    memo?: string;
  }) {
    return this.recordMultiWayResult({
      roundId: args.roundId,
      winners: args.winners,
      losers: args.losers,
      memo: args.memo ?? 'Skins auto-settlement',
    });
  },
};
