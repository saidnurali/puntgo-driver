import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRide } from '../../contexts/RideContext';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants/theme';

type RideStage = 'navigating_to_pickup' | 'passenger_picked_up' | 'heading_to_dropoff';

export default function ActiveRideScreen() {
  const { currentRide, completeRide } = useRide();
  const [stage, setStage] = useState<RideStage>('navigating_to_pickup');

  if (!currentRide) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>No Active Ride</Text>
          <Text style={styles.emptySubtitle}>
            Your active ride will appear here once you accept a request.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleCallPassenger = () => {
    if (currentRide.passenger_phone) {
      Linking.openURL(`tel:${currentRide.passenger_phone}`);
    }
  };

  const handleNavigate = () => {
    const lat = stage === 'navigating_to_pickup' ? currentRide.pickup_lat : currentRide.dropoff_lat;
    const lng = stage === 'navigating_to_pickup' ? currentRide.pickup_lng : currentRide.dropoff_lng;
    const label = stage === 'navigating_to_pickup' ? 'Pickup Location' : 'Drop-off Location';
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  };

  const handleNextStage = () => {
    if (stage === 'navigating_to_pickup') {
      setStage('passenger_picked_up');
    } else if (stage === 'passenger_picked_up') {
      setStage('heading_to_dropoff');
    } else {
      Alert.alert(
        'Complete Ride',
        'Are you sure you want to mark this ride as completed?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete',
            onPress: async () => {
              await completeRide(currentRide.id);
            },
          },
        ]
      );
    }
  };

  const stageConfig = {
    navigating_to_pickup: {
      label: 'Navigating to Pickup',
      color: Colors.primary,
      nextLabel: 'Arrived at Pickup',
      progress: 33,
      location: currentRide.pickup_address,
      locationLabel: 'PICKUP LOCATION',
    },
    passenger_picked_up: {
      label: 'Passenger On Board',
      color: Colors.warning,
      nextLabel: 'Start Trip',
      progress: 66,
      location: currentRide.pickup_address,
      locationLabel: 'STARTING FROM',
    },
    heading_to_dropoff: {
      label: 'Heading to Drop-off',
      color: Colors.info,
      nextLabel: 'Complete Ride',
      progress: 100,
      location: currentRide.dropoff_address,
      locationLabel: 'DROP-OFF LOCATION',
    },
  };

  const config = stageConfig[stage];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.stageBadge, { backgroundColor: `${config.color}22` }]}>
            <View style={[styles.stageDot, { backgroundColor: config.color }]} />
            <Text style={[styles.stageLabel, { color: config.color }]}>{config.label}</Text>
          </View>
          <View style={styles.fareBadge}>
            <Text style={styles.fareAmount}>${currentRide.estimated_fare?.toFixed(2) ?? '0.00'}</Text>
            <Text style={styles.fareLabel}>FARE</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${config.progress}%`, backgroundColor: config.color }]} />
          </View>
          <View style={styles.progressDots}>
            {[33, 66, 100].map((p) => (
              <View
                key={p}
                style={[styles.progressDot, config.progress >= p && { backgroundColor: config.color }]}
              />
            ))}
          </View>
        </View>

        {/* Passenger Card */}
        <View style={styles.passengerCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>
              {currentRide.passenger_name?.charAt(0)?.toUpperCase() ?? 'P'}
            </Text>
          </View>
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{currentRide.passenger_name}</Text>
            <Text style={styles.passengerPhone}>{currentRide.passenger_phone}</Text>
            <View style={styles.distanceRow}>
              <Text style={styles.distanceText}>📏 {currentRide.distance_km?.toFixed(1)} km</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={handleCallPassenger}>
            <Text style={styles.callIcon}>📞</Text>
          </TouchableOpacity>
        </View>

        {/* Route Info */}
        <View style={styles.routeCard}>
          <Text style={styles.routeCardLabel}>{config.locationLabel}</Text>
          <Text style={styles.routeAddress}>{config.location}</Text>

          <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate}>
            <Text style={styles.navigateBtnText}>🗺️  Open in Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Full Route Preview */}
        <View style={styles.fullRoute}>
          <View style={styles.fullRouteRow}>
            <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
            <View style={styles.fullRouteInfo}>
              <Text style={styles.fullRouteLabel}>Pickup</Text>
              <Text style={styles.fullRouteAddress} numberOfLines={1}>{currentRide.pickup_address}</Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.fullRouteRow}>
            <View style={[styles.routeDot, { backgroundColor: Colors.danger }]} />
            <View style={styles.fullRouteInfo}>
              <Text style={styles.fullRouteLabel}>Drop-off</Text>
              <Text style={styles.fullRouteAddress} numberOfLines={1}>{currentRide.dropoff_address}</Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: config.color }]}
          onPress={handleNextStage}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnText}>{config.nextLabel}</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 6,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  fareBadge: {
    alignItems: 'center',
    backgroundColor: `${Colors.gold}22`,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${Colors.gold}44`,
  },
  fareAmount: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.gold,
  },
  fareLabel: {
    fontSize: FontSize.xs,
    color: Colors.goldDark,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.8,
  },
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  progressBg: {
    height: 6,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: '15%',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceBorder,
  },
  passengerCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  passengerInfo: { flex: 1 },
  passengerName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  passengerPhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  distanceRow: { flexDirection: 'row', marginTop: 4 },
  distanceText: { fontSize: FontSize.xs, color: Colors.textMuted },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.success}22`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${Colors.success}44`,
  },
  callIcon: { fontSize: 20 },
  routeCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  routeCardLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  navigateBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  navigateBtnText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  fullRoute: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  fullRouteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
  },
  fullRouteInfo: { flex: 1 },
  fullRouteLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  fullRouteAddress: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: Colors.surfaceBorder,
    marginLeft: 5,
    marginVertical: 4,
  },
  actionBtn: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  actionBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
});
