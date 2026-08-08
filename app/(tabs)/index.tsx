import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useRide } from '../../contexts/RideContext';
import StatusToggle from '../../components/StatusToggle';
import StatCard from '../../components/StatCard';
import RideRequestModal from '../../components/RideRequestModal';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants/theme';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { user } = useAuth();
  const {
    driverStatus,
    setDriverStatus,
    driverProfile,
    pendingRide,
    currentRide,
    todayEarnings,
    todayRides,
    acceptRide,
    declineRide,
    refreshProfile,
  } = useRide();
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const isOnline = driverStatus === 'online';

  const handleToggle = async (value: boolean) => {
    await setDriverStatus(value ? 'online' : 'offline');
  };

  const handleAccept = async () => {
    if (pendingRide) {
      await acceptRide(pendingRide.id);
      router.push('/(tabs)/active-ride');
    }
  };

  const handleDecline = async () => {
    if (pendingRide) {
      await declineRide(pendingRide.id);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const rating = driverProfile?.rating?.toFixed(1) ?? '5.0';
  const totalRides = driverProfile?.total_rides ?? 0;
  const weeklyEarnings = (todayEarnings * 5).toFixed(2); // rough estimate for display

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={styles.driverName}>
              {driverProfile?.full_name ?? user?.email?.split('@')[0] ?? 'Driver'} 👋
            </Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingStar}>⭐</Text>
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        </View>

        {/* Status Toggle */}
        <StatusToggle isOnline={isOnline} onToggle={handleToggle} />

        {/* Today's Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <View style={styles.statsRow}>
            <StatCard
              label="Earnings"
              value={`$${todayEarnings.toFixed(2)}`}
              icon="💰"
              accent={Colors.gold}
            />
            <StatCard
              label="Rides"
              value={`${todayRides}`}
              icon="🚗"
              accent={Colors.primary}
            />
            <StatCard
              label="Rating"
              value={rating}
              icon="⭐"
              accent={Colors.warning}
            />
          </View>
        </View>

        {/* Current Ride Banner */}
        {currentRide && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.activeRideBanner}
              onPress={() => router.push('/(tabs)/active-ride')}
              activeOpacity={0.85}
            >
              <View style={styles.activeRidePulse} />
              <View style={styles.activeRideInfo}>
                <Text style={styles.activeRideLabel}>Active Ride</Text>
                <Text style={styles.activeRidePassenger}>{currentRide.passenger_name}</Text>
                <Text style={styles.activeRideAddress} numberOfLines={1}>
                  📍 {currentRide.dropoff_address}
                </Text>
              </View>
              <Text style={styles.activeRideArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Lifetime Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Time</Text>
          <View style={styles.lifetimeCard}>
            <View style={styles.lifetimeStat}>
              <Text style={styles.lifetimeValue}>{totalRides}</Text>
              <Text style={styles.lifetimeLabel}>Total Rides</Text>
            </View>
            <View style={styles.lifetimeDivider} />
            <View style={styles.lifetimeStat}>
              <Text style={styles.lifetimeValue}>
                ${(driverProfile?.total_earnings ?? 0).toFixed(0)}
              </Text>
              <Text style={styles.lifetimeLabel}>Total Earned</Text>
            </View>
            <View style={styles.lifetimeDivider} />
            <View style={styles.lifetimeStat}>
              <Text style={styles.lifetimeValue}>{rating}</Text>
              <Text style={styles.lifetimeLabel}>Avg Rating</Text>
            </View>
          </View>
        </View>

        {/* Tips when offline */}
        {!isOnline && (
          <View style={styles.section}>
            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>💡 Ready to Earn?</Text>
              <Text style={styles.tipText}>
                Toggle the switch above to go online and start receiving ride requests in Garowe.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Incoming Ride Request Modal */}
      <RideRequestModal
        ride={pendingRide}
        visible={!!pendingRide && isOnline}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </SafeAreaView>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  driverName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  ratingStar: { fontSize: 14 },
  ratingText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  activeRideBanner: {
    backgroundColor: `${Colors.primary}15`,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  activeRidePulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  activeRideInfo: { flex: 1 },
  activeRideLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  activeRidePassenger: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  activeRideAddress: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activeRideArrow: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  lifetimeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  lifetimeStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  lifetimeValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
  },
  lifetimeLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  lifetimeDivider: {
    width: 1,
    backgroundColor: Colors.surfaceBorder,
    marginVertical: Spacing.md,
  },
  tipCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  tipTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  tipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
