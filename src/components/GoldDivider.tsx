import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  style?: any;
};

/** Signature gold gradient divider — 3px, fades at edges */
export default function GoldDivider({ style }: Props) {
  return (
    <View style={[styles.wrapper, style]}>
      <LinearGradient
        colors={['transparent', '#B8860B', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.line}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', alignItems: 'center' },
  line: { width: '100%', height: 3 },
});
