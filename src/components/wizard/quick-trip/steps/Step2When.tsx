// =============================================================
// Step 2 — When
// =============================================================
// Single-date picker for Quick Trip. Plan Ahead (Phase 3) extends
// to date ranges + per-day course assignment.
//
// Three input affordances stacked:
//   1. Smart-default pill row: Today / Tomorrow / This Saturday.
//      Tapping a pill sets state.startDate immediately. Augusta-green
//      accent on the pill that matches the current selection.
//   2. Selected-date hero: Georgia serif rendering of the picked date
//      ("Saturday, October 15, 2026") with a gold tracked-caps
//      countdown line ("TODAY" / "TOMORROW" / "T-15 DAYS").
//   3. Inline calendar: 6×7 grid with month-nav chevrons. Past days
//      and pre-min-date months are disabled. Tapping any day commits
//      the selection to wizard state.
//
// State: startDate + endDate are stored as YYYY-MM-DD strings so the
// shape stays serializable. Quick Trip mirrors endDate = startDate;
// Plan Ahead's range picker overrides this.
// =============================================================

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme/ThemeContext';
import { GEO } from '../../../../theme/fonts';
import { haptics } from '../../../../lib/haptics';
import { useWizard } from '../WizardContext';
import {
  toYMD,
  fromYMD,
  todayYMD,
  tomorrowYMD,
  nextSaturdayYMD,
  formatLongDate,
  daysBetweenYMD,
  countdownLabel,
} from '../dateHelpers';

// Re-export for any callers (tests, future shared use).
export {
  toYMD,
  fromYMD,
  todayYMD,
  tomorrowYMD,
  nextSaturdayYMD,
  formatLongDate,
  daysBetweenYMD,
  countdownLabel,
};

const HAIRLINE = 'rgba(255,255,255,0.06)';
const AUGUSTA = '#006747';
const GOLD = '#C9A227';

// Date helpers extracted to ../dateHelpers (testable from ts-node
// without RN imports). Re-exported above for any callers; this section
// is intentionally empty.

// ─── Smart-default pills ──────────────────────────────────────────────

interface PillSpec {
  key: 'today' | 'tomorrow' | 'saturday';
  label: string;
  resolveDate: () => string;
}

const PILLS: PillSpec[] = [
  { key: 'today', label: 'Today', resolveDate: todayYMD },
  { key: 'tomorrow', label: 'Tomorrow', resolveDate: tomorrowYMD },
  { key: 'saturday', label: 'This Saturday', resolveDate: nextSaturdayYMD },
];

// ─── Inline calendar ──────────────────────────────────────────────────

interface InlineCalendarProps {
  /** Currently selected day in YYYY-MM-DD, or empty string for none. */
  selected: string;
  /** Earliest selectable day in YYYY-MM-DD. Days before are disabled. */
  minDate: string;
  onSelect: (ymd: string) => void;
}

function InlineCalendar({ selected, minDate, onSelect }: InlineCalendarProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const minDateObj = useMemo(() => fromYMD(minDate) ?? new Date(), [minDate]);
  const minMonthKey = useMemo(
    () => `${minDateObj.getFullYear()}-${minDateObj.getMonth()}`,
    [minDateObj],
  );

  // Initial month: month of selected date if any, else month of minDate.
  const [viewMonth, setViewMonth] = useState(() => {
    const d = fromYMD(selected) ?? minDateObj;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const monthIdx = viewMonth.getMonth();
    const firstDayOfWeek = new Date(year, monthIdx, 1).getDay();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const out: { date: Date; ymd: string; inMonth: boolean }[] = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, monthIdx, -i);
      out.push({ date: d, ymd: toYMD(d), inMonth: false });
    }
    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, monthIdx, day);
      out.push({ date: d, ymd: toYMD(d), inMonth: true });
    }
    // Trailing days to fill 6 rows × 7 cols = 42
    while (out.length < 42) {
      const last = out[out.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      out.push({ date: next, ymd: toYMD(next), inMonth: false });
    }
    return out;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const isAtMinMonth =
    `${viewMonth.getFullYear()}-${viewMonth.getMonth()}` === minMonthKey;

  const goPrev = () => {
    if (isAtMinMonth) return;
    haptics.light();
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
    );
  };
  const goNext = () => {
    haptics.light();
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
    );
  };

  const minMs = minDateObj.getTime();

  return (
    <View style={s.calendarWrap}>
      {/* Month header with prev/next chevrons */}
      <View style={s.monthHeader}>
        <Pressable
          onPress={goPrev}
          disabled={isAtMinMonth}
          hitSlop={8}
          style={({ pressed }) => [
            s.monthNavBtn,
            { opacity: isAtMinMonth ? 0.3 : pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={c.textMuted} />
        </Pressable>
        <Text style={[s.monthLabel, { color: c.text, fontFamily: GEO }]}>
          {monthLabel}
        </Text>
        <Pressable
          onPress={goNext}
          hitSlop={8}
          style={({ pressed }) => [
            s.monthNavBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </Pressable>
      </View>

      {/* Day-of-week header */}
      <View style={s.dowRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dow, i) => (
          <Text
            key={`${dow}-${i}`}
            style={[s.dowText, { color: c.textMuted, fontFamily: GEO }]}
          >
            {dow}
          </Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={s.dayGrid}>
        {cells.map((cell) => {
          const isPast = cell.date.getTime() < minMs;
          const isSelected = cell.ymd === selected && cell.inMonth;
          const isToday = cell.ymd === todayYMD() && cell.inMonth;
          const disabled = isPast || !cell.inMonth;

          return (
            <Pressable
              key={cell.ymd}
              onPress={() => {
                if (disabled) return;
                haptics.light();
                onSelect(cell.ymd);
              }}
              disabled={disabled}
              style={({ pressed }) => [
                s.dayCell,
                {
                  backgroundColor: isSelected ? AUGUSTA : 'transparent',
                  opacity: pressed && !disabled ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  s.dayText,
                  {
                    color: !cell.inMonth
                      ? 'transparent' // hide leading/trailing month days
                      : isSelected
                        ? GOLD
                        : isPast
                          ? 'rgba(255,255,255,0.18)'
                          : c.text,
                    fontFamily: GEO,
                    fontWeight: isSelected || isToday ? '700' : '400',
                  },
                ]}
              >
                {cell.date.getDate()}
              </Text>
              {isToday && !isSelected ? (
                <View style={[s.todayDot, { backgroundColor: GOLD }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step component ───────────────────────────────────────────────────

export function Step2When() {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;

  const today = todayYMD();

  const handleSelect = (ymd: string) => {
    // Quick Trip is single-day — endDate mirrors startDate. Plan Ahead
    // (Phase 3) overrides this with a range picker.
    dispatch({ type: 'SET_DATES', startDate: ymd, endDate: ymd });
  };

  const handlePillTap = (pill: PillSpec) => {
    haptics.light();
    handleSelect(pill.resolveDate());
  };

  // Determine which pill (if any) matches the current selection.
  const activePillKey: PillSpec['key'] | null = useMemo(() => {
    if (!state.startDate) return null;
    if (state.startDate === todayYMD()) return 'today';
    if (state.startDate === tomorrowYMD()) return 'tomorrow';
    if (state.startDate === nextSaturdayYMD()) return 'saturday';
    return null;
  }, [state.startDate]);

  const longDate = state.startDate ? formatLongDate(state.startDate) : '';
  const countdown = state.startDate ? countdownLabel(state.startDate) : '';

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
        When are you playing?
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Pick a quick option or any day on the calendar.
      </Text>

      {/* Smart-default pill row */}
      <View style={s.pillRow}>
        {PILLS.map((pill) => {
          const active = activePillKey === pill.key;
          return (
            <Pressable
              key={pill.key}
              onPress={() => handlePillTap(pill)}
              style={({ pressed }) => [
                s.pill,
                {
                  backgroundColor: active ? AUGUSTA : '#221F1D',
                  borderColor: active ? AUGUSTA : HAIRLINE,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  s.pillText,
                  {
                    color: active ? GOLD : c.text,
                    fontFamily: GEO,
                  },
                ]}
              >
                {pill.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Selected-date hero */}
      <View style={s.heroBlock}>
        {state.startDate ? (
          <>
            <Text
              style={[s.heroDate, { color: c.text, fontFamily: GEO }]}
              numberOfLines={2}
            >
              {longDate}
            </Text>
            <Text style={[s.heroCountdown, { color: GOLD, fontFamily: GEO }]}>
              {countdown}
            </Text>
          </>
        ) : (
          <Text style={[s.heroEmpty, { color: c.textMuted, fontFamily: GEO }]}>
            No date selected yet
          </Text>
        )}
      </View>

      {/* Inline calendar */}
      <InlineCalendar
        selected={state.startDate}
        minDate={today}
        onSelect={handleSelect}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },

  /* Header */
  prompt: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
  },

  /* Pills */
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* Selected-date hero */
  heroBlock: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroDate: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    lineHeight: 28,
  },
  heroCountdown: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 8,
  },
  heroEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
  },

  /* Calendar */
  calendarWrap: {
    marginTop: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dowRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  dowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
  },
  todayDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
  },
});
