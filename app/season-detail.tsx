import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../src/theme/colors';

// TODO: Season Detail (991 lines)
// FedEx Cup standings, playoffs, cut lines, majors, career stats

export default function SeasonDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Season Detail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
});
