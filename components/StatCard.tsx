import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../constants/theme';

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  accent?: string;
}

export default function StatCard({ label, value, icon, accent }: StatCardProps) {
  const accentColor = accent ?? Colors.primary;
  return (
    <View style={[styles.card, { borderTopColor: accentColor }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    flex: 1,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginHorizontal: 4,
  },
  icon: {
    fontSize: 22,
    marginBottom: 6,
  },
  value: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    marginBottom: 2,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
