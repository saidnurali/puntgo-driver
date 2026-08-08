import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useRide } from '../../contexts/RideContext';
import EarningsCard from '../../components/EarningsCard';
import { supabase } from '../../lib/supabase';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants/theme';

interface EarningsPeriod {
  label: string;
  amount: number;
  rides: number;
  period: string;
}

export default function EarningsScreen() {
  const { user } = useAuth();
  const { todayEarnings, todayRides, driverProfile, refreshProfile } = useRide();
  const [weeklyData, setWeeklyData] = useState<EarningsPeriod | null>(null);
  const [monthlyData, setMonthlyData] = useState<EarningsPeriod | null>(null);
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = async () => {
    if (!user) return;

    // Weekly
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const { data: weekData } = await supabase
      .from('rides')
      .select('estimated_fare, created_at, pickup_address, dropoff_address')
      .eq('driver_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', weekStart.toISOString())
      .order('created_at', { ascending: false });

    if (weekData) {
      setWeeklyData({
        label: 'This Week',
        amount: weekData.reduce((s, r) => s + (r.estimated_fare ?? 0), 0),
        rides: weekData.length,
        period: formatDateRange(weekStart, new Date()),
      });
      setRecentRides(weekData.slice(0, 10));
    }

    // Monthly
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { data: monthData } = await supabase
      .from('rides')
      .select('estimated_fare')
      .eq('driver_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', monthStart.toISOString());

    if (monthData) {
      setMonthlyData({
        label: 'This Month',
        amount: monthData.reduce((s, r) => s + (r.estimated_fare ?? 0), 0),
        rides: monthData.length,
        period: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      });
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await fetchEarnings();
    setRefreshing(false);
  };

  const totalEarnings = driverProfile?.total_earnings ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
          <Text style={styles.subtitle}>Your earning summary</Text>
        </View>

        {/* Total Lifetime Banner */}
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Total Lifetime Earnings</Text>
          <Text style={styles.totalAmount}>${totalEarnings.toFixed(2)}</Text>
          <Text style={styles.totalRides}>{driverProfile?.total_rides ?? 0} rides completed</Text>
        </View>

        {/* Earnings Cards */}
        <View style={styles.section}>
          <EarningsCard
            label="Today"
            amount={todayEarnings}
            rides={todayRides}
            period={new Date().toLocaleDateString()}
            highlight
          />
          {weeklyData && (
            <EarningsCard
              label={weeklyData.label}
              amount={weeklyData.amount}
              rides={weeklyData.rides}
              period={weeklyData.period}
            />
          )}
          {monthlyData && (
            <EarningsCard
              label={monthlyData.label}
              amount={monthlyData.amount}
              rides={monthlyData.rides}
              period={monthlyData.period}
            />
          )}
        </View>

        {/* Recent Rides */}
        {recentRides.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Completed Rides</Text>
            {recentRides.map((ride, index) => (
              <View key={index} style={styles.rideRow}>
                <View style={styles.rideIconCircle}>
                  <Text style={styles.rideIcon}>🚗</Text>
                </View>
                <View style={styles.rideInfo}>
                  <Text style={styles.rideRoute} numberOfLines={1}>
                    {ride.pickup_address ?? 'Unknown'} → {ride.dropoff_address ?? 'Unknown'}
                  </Text>
                  <Text style={styles.rideDate}>{formatRelativeDate(ride.created_at)}</Text>
                </View>
                <Text style={styles.rideFare}>${(ride.estimated_fare ?? 0).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {recentRides.length === 0 && (
          <View style={styles.emptyRides}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyTitle}>No Rides Yet</Text>
            <Text style={styles.emptyText}>Complete rides to see your earnings here.</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDateRange(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  totalBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: `${Colors.primary}40`,
  },
  totalLabel: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  totalAmount: {
    fontSize: 48,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  totalRides: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: Spacing.sm,
  },
  rideIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideIcon: { fontSize: 18 },
  rideInfo: { flex: 1 },
  rideRoute: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  rideDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rideFare: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.success,
  },
  emptyRides: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
