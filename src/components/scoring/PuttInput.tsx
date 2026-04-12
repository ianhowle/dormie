import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';

const OPTIONS = [0, 1, 2, 3, 4] as const;

export function PuttInput({
  value,
  onChange,
  label = 'PUTTS',
}: {
  value: number;
  onChange: (putts: number) => void;
  label?: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <View style={styles.row}>
        {OPTIONS.map((n) => {
          const active = value === n;
          const isChipIn = n === 0;
          const isThreePutt = n >= 3;
          const displayLabel = n === 4 ? '4+' : String(n);
          const borderColor = active ? (isChipIn ? c.gold : isThreePutt ? c.urgent : c.teal) : c.border;
          const textColor = active ? (isChipIn ? c.gold : isThreePutt ? c.urgent : c.teal) : c.text;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[styles.btn, { borderColor, backgroundColor: active ? `${borderColor}18` : 'transparent' }]}
            >
              <Text style={[styles.btnText, { color: textColor, fontFamily: GEO }]}>{displayLabel}</Text>
              {isChipIn && <Text style={[styles.sub, { color: c.gold }]}>CHIP-IN</Text>}
              {isThreePutt && active && <Text style={[styles.sub, { color: c.urgent }]}>3-PUTT</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 6 },
  label: { fontSize: 10, letterSpacing: 1, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    borderWidth: 1,
  },
  btnText: { fontSize: 18 },
  sub: { fontSize: 8, letterSpacing: 1, marginTop: 2, fontWeight: '700' },
});
