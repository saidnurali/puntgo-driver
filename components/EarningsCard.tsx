import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../constants/theme';

interface EarningsCardProps {
  label: string;
  amount: number;
  rides: number;
  period?: string;
  highlight?: boolean;
}

export default function EarningsCard({ label, amount, rides, period, highlight }: EarningsCardProps) {
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      {highlight && <View style={styles.highlightBadge}><Text style={styles.highlightBadgeText}>TODAY</Text></View>}
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.amount, highlight && styles.amountHighlight]}>
        ${amount.toFixed(2)}
      </Text>
      <View style={styles.row}>
        <Text style={styles.rides}>🚗 {rides} ride{rides !== 1 ? 's' : ''}</Text>
        {period && <Text style={styles.period}>{period}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  cardHighlight: {
    borderColor: `${Colors.gold}55`,
    backgroundColor: `${Colors.gold}08`,
  },
  highlightBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: `${Colors.gold}33`,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${Colors.gold}66`,
  },
  highlightBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.gold,
    letterSpacing: 0.8,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontWeight: FontWeight.medium,
  },
  amount: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  amountHighlight: {
    color: Colors.gold,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rides: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  period: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
