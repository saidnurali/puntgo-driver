import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../constants/theme';

interface StatusToggleProps {
  isOnline: boolean;
  onToggle: (value: boolean) => void;
}

export default function StatusToggle({ isOnline, onToggle }: StatusToggleProps) {
  return (
    <View style={[styles.container, isOnline ? styles.online : styles.offline]}>
      <View style={styles.row}>
        {/* Status dot */}
        <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        <View style={styles.textGroup}>
          <Text style={styles.statusLabel}>
            {isOnline ? 'You\'re Online' : 'You\'re Offline'}
          </Text>
          <Text style={styles.statusSub}>
            {isOnline ? 'Receiving ride requests' : 'Go online to receive requests'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={onToggle}
          trackColor={{ false: Colors.surfaceBorder, true: `${Colors.primary}66` }}
          thumbColor={isOnline ? Colors.primary : Colors.textMuted}
          ios_backgroundColor={Colors.surfaceBorder}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    marginHorizontal: Spacing.lg,
  },
  online: {
    backgroundColor: `${Colors.primary}12`,
    borderColor: `${Colors.primary}50`,
  },
  offline: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.surfaceBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotOnline: {
    backgroundColor: Colors.online,
    shadowColor: Colors.online,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  dotOffline: {
    backgroundColor: Colors.offline,
  },
  textGroup: {
    flex: 1,
    marginLeft: 4,
  },
  statusLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  statusSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
