import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SANS } from '../theme/fonts';

type DataFreshnessProps = {
  updatedAt?: Date | null;
  isLive?: boolean;
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  if (diffHr < 24) return `Updated ${diffHr}h ago`;
  return 'Updated yesterday';
}

export function DataFreshness({ updatedAt, isLive }: DataFreshnessProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (isLive) {
    return (
      <View style={styles.container}>
        <View style={[styles.liveDot, { backgroundColor: c.teal }]} />
        <Text style={[styles.liveText, { color: c.teal, fontFamily: SANS }]}>Live</Text>
      </View>
    );
  }

  if (!updatedAt) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: c.textMuted, fontFamily: SANS }]}>
        {getTimeAgo(updatedAt)}
      </Text>
    </View>
  );
}

export function RelativeTimestamp({ date }: { date: Date }) {
  const { theme } = useTheme();

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);

  let label: string;
  if (diffMin < 1) label = 'Just now';
  else if (diffMin < 60) label = `${diffMin}m ago`;
  else if (diffHr < 24) label = `${diffHr}h ago`;
  else if (diffHr < 48) label = 'Yesterday';
  else label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <Text style={[styles.text, { color: theme.colors.textMuted, fontFamily: SANS }]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 10,
    fontWeight: '500',
  },
});
