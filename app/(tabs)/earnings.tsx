import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrder } from '../../contexts/OrderContext';
import { logger } from '../../utils/logger';

const BRAND_GREEN = '#1F933F';
const DARK_TEXT = '#111827';
const GREY_TEXT = '#6B7280';
const BORDER = '#E5E7EB';
const LIGHT_BG = '#F9FAFB';

type TimeFilter = 'today' | 'week' | 'month';

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { driverProfile } = useOrder();

  const [activeTab, setActiveTab] = useState<TimeFilter>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [completedOrdersList, setCompletedOrdersList] = useState<any[]>([]);

  // Metrics
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [deliveries, setDeliveries] = useState(0);
  const [cashCollected, setCashCollected] = useState(0);

  const calculateMetrics = (data: any[]) => {
    let earnings = 0;
    let cash = 0;

    data.forEach((order) => {
      // Driver ONLY earns the delivery fee + tip
      const feeEarned = Number(order.delivery_fee || 0.60) + Number(order.tip || 0);
      earnings += feeEarned;

      if (order.payment_method === 'Cash' || order.payment_method?.toLowerCase() === 'cash') {
        cash += Number(order.total_price || 0);
      }
    });

    setDeliveries(data.length);
    setTotalEarnings(earnings);
    setCashCollected(cash);
  };

  const fetchDriverEarnings = useCallback(async (filterType: TimeFilter) => {
    if (!driverProfile) return;
    setFetchError(null);

    try {
      let dateFilter = new Date();
      if (filterType === 'today') {
        dateFilter.setHours(0, 0, 0, 0);
      } else if (filterType === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (filterType === 'month') {
        dateFilter.setDate(dateFilter.getDate() - 30);
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`driver_name.ilike.%${driverProfile.full_name}%,driver_phone.eq.${driverProfile.phone}`)
        .eq('status', 'Delivered')
        .gte('created_at', dateFilter.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('[EarningsScreen] fetchDriverEarnings error:', error.message);
        setFetchError('Failed to load earnings. Tap to retry.');
        return;
      }

      if (data) {
        calculateMetrics(data);
        setCompletedOrdersList(data);
      }
    } catch (err) {
      logger.error('[EarningsScreen] fetchDriverEarnings unexpected error:', err);
      setFetchError('Failed to load earnings. Tap to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverProfile]);

  useEffect(() => {
    if (!driverProfile) return;
    setLoading(true);
    fetchDriverEarnings(activeTab);

    // Supabase realtime updates
    const subscription = supabase
      .channel(`earnings_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `status=eq.Delivered` },
        (payload) => {
          // Whenever an order status transitions to Delivered, refresh seamlessly
          fetchDriverEarnings(activeTab);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [activeTab, fetchDriverEarnings, driverProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDriverEarnings(activeTab);
  };

  const tabs: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];
  
  const averagePerDelivery = deliveries > 0 ? totalEarnings / deliveries : 0;

  const renderOrder = ({ item }: { item: any }) => {
    const isCash = item.payment_method?.toLowerCase() === 'cash';
  // ✅ FIX: Use String(item.id) — .slice() is undefined on numeric IDs
    const timestamp = new Date(item.created_at ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const orderDate = new Date(item.created_at ?? Date.now());
    const today = new Date();
    let displayDate = `${orderDate.toLocaleDateString()} at ${timestamp}`;
    if (orderDate.toDateString() === today.toDateString()) {
      displayDate = `Today at ${timestamp}`;
    }

    const feeEarned = Number(item.delivery_fee ?? 0.60) + Number(item.tip ?? 0);

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderCardHeader}>
          <Text style={styles.orderId}>#{String(item.id ?? '').slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.orderTime}>{displayDate}</Text>
        </View>

        <View style={styles.orderCardBody}>
          <Text style={styles.restaurantName} numberOfLines={1}>{item.restaurant_name || item.restaurant || 'Unknown Restaurant'}</Text>
          <Text style={styles.customerArea} numberOfLines={1}>{item.delivery_address || item.address || 'Unknown Area'}</Text>
        </View>

        <View style={styles.orderCardFooter}>
          <View style={[styles.badge, isCash ? styles.cashBadge : styles.onlineBadge]}>
            <Text style={[styles.badgeText, isCash ? styles.cashBadgeText : styles.onlineBadgeText]}>
              {isCash ? `💵 Cash Collected: $${item.total_price?.toFixed(2) || '0.00'}` : '💳 Online Paid'}
            </Text>
          </View>
          <Text style={styles.feeEarned}>+${feeEarned.toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
      </View>

      {/* ── TABS ── */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity 
              key={tab.key} 
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.tabBottomLine} />

      {/* ── FETCH ERROR STATE ── */}
      {!!fetchError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{fetchError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              setFetchError(null);
              fetchDriverEarnings(activeTab);
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!fetchError && (
        <FlatList
          data={completedOrdersList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GREEN} />}
          ListHeaderComponent={() => (
            loading ? (
              <ActivityIndicator size="large" color={BRAND_GREEN} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardLabel}>Total Earnings</Text>
                  <Text style={styles.totalAmount}>${totalEarnings.toFixed(2)}</Text>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardBottom}>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>Deliveries</Text>
                    <Text style={styles.statValue}>{deliveries}</Text>
                  </View>
                  <View style={[styles.statCol, { alignItems: 'center' }]}>
                    <Text style={styles.statLabel}>Average / Delivery</Text>
                    <Text style={styles.statValue}>${averagePerDelivery.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.statCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.statLabel}>Cash Collected</Text>
                    <Text style={styles.statValue}>${cashCollected.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            )
          )}
          ListEmptyComponent={() => (
            !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No delivered orders found for this period.</Text>
              </View>
            ) : null
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: BRAND_GREEN,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: GREY_TEXT,
  },
  tabTextActive: {
    color: BRAND_GREEN,
  },
  tabBottomLine: {
    height: 1,
    backgroundColor: BORDER,
    width: '100%',
    marginTop: -1, // overlap the active border
    zIndex: -1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  cardTop: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 13,
    color: GREY_TEXT,
    fontWeight: '600',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: BRAND_GREEN,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: GREY_TEXT,
    fontWeight: '600',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: DARK_TEXT,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  orderTime: {
    fontSize: 12,
    color: GREY_TEXT,
  },
  orderCardBody: {
    marginBottom: 16,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK_TEXT,
    marginBottom: 4,
  },
  customerArea: {
    fontSize: 13,
    color: GREY_TEXT,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cashBadge: {
    backgroundColor: '#DCFCE7',
  },
  onlineBadge: {
    backgroundColor: '#DBEAFE',
  },
  cashBadgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
  },
  onlineBadgeText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '600',
  },
  feeEarned: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_GREEN,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: GREY_TEXT,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: GREY_TEXT,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
