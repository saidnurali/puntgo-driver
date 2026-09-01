import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrder } from '../../contexts/OrderContext';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Menu, Bell, PackageOpen } from 'lucide-react-native';

const BRAND_GREEN = '#1F933F';
const LIGHT_BG = '#FFFFFF';
const DARK_TEXT = '#111827';
const GREY_TEXT = '#6B7280';
const BORDER_COLOR = '#F3F4F6';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    driverStatus,
    setDriverStatus,
    driverProfile,
    todayEarnings,
    todayDeliveries,
    activeOrders,
    refreshProfile,
  } = useOrder();
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  // Use AsyncStorage to get correct driver_is_online on load (will do this later in toggle logic)
  const isOnline = driverStatus === 'online';

  // 1. FIX ACTIVE DISPATCH CARD FILTERING
  const activeIncompleteOrders = activeOrders.filter(o => 
    ['pending', 'preparing', 'out for delivery', 'out_for_delivery']
    .includes((o.status || '').toLowerCase())
  );
  const currentActiveOrder = activeIncompleteOrders[0];

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const toggleOnline = async () => {
    await setDriverStatus(isOnline ? 'offline' : 'online');
  };

  const avatarUrl = driverProfile?.profile_photo || 'https://ui-avatars.com/api/?name=' + (driverProfile?.full_name || 'Driver') + '&background=E5E7EB&color=6B7280';
  const driverName = driverProfile?.full_name || 'Driver';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* ── Top Header Bar ── */}
      <View style={styles.headerContainer}>
        {/* Row 1: Menu & Bell */}
        <View style={styles.topIconRow}>
          <TouchableOpacity style={styles.iconBtn}>
            <Menu color={DARK_TEXT} size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <View style={styles.bellBadge} />
            <Bell color="#F97316" size={24} />
          </TouchableOpacity>
        </View>

        {/* Row 2: Greeting & Avatar */}
        <View style={styles.greetingRow}>
          <Text style={styles.greetingText}>Hello, {driverName}</Text>
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        </View>

        {/* ── Toggle Bar ── */}
        <View style={styles.toggleBar}>
          <View style={styles.toggleTextWrapper}>
            <Text style={styles.toggleText}>{isOnline ? '🟢 Online' : '🔴 Offline'}</Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleOnline}
            trackColor={{ false: '#E5E7EB', true: BRAND_GREEN }}
            thumbColor={'#FFFFFF'}
            ios_backgroundColor="#E5E7EB"
            style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] } : undefined}
          />
        </View>

        {/* ── Quick Stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Earnings</Text>
            <Text style={styles.statValue}>${todayEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Deliveries Today</Text>
            <Text style={styles.statValue}>{todayDeliveries}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND_GREEN} />
        }
      >
        {!isOnline ? (
          /* ── OFFLINE STATE ── */
          <View style={styles.offlineContainer}>
            {/* Scooter Graphic Placeholder (using a generic URL or just styled UI) */}
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3753/3753066.png' }} 
              style={styles.scooterGraphic}
              resizeMode="contain"
            />
            <Text style={styles.offlineTitle}>You are offline</Text>
            <Text style={styles.offlineSub}>Go online to start receiving orders</Text>
            
            <TouchableOpacity 
              style={styles.goOnlineBtn}
              onPress={toggleOnline}
              activeOpacity={0.8}
            >
              <Text style={styles.goOnlineBtnText}>Go Online</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── ONLINE STATE ── */
          <View style={styles.onlineContainer}>
            {/* Active Order Card */}
            <View style={styles.activeOrderCard}>
              <Text style={styles.activeOrderHeader}>Active Dispatch</Text>
              
              {currentActiveOrder ? (
                <View style={styles.activeOrderContent}>
                  <View style={styles.orderIconBgActive}>
                    <PackageOpen color={BRAND_GREEN} size={28} />
                  </View>
                  <Text style={styles.activeOrderTitle}>
                    {currentActiveOrder?.restaurant_name || currentActiveOrder?.restaurant || 'Restaurant'}
                  </Text>
                  <Text style={styles.activeOrderSub}>
                    Deliver to {currentActiveOrder?.delivery_address || currentActiveOrder?.address || 'Customer'}
                  </Text>
                  
                  <TouchableOpacity 
                    style={[styles.goOnlineBtn, { marginTop: 16, paddingVertical: 14, width: '100%', borderRadius: 12 }]}
                    onPress={() => router.push({ pathname: '/(tabs)/active-order', params: { orderId: String(currentActiveOrder?.id ?? '') }})}
                    activeOpacity={0.8}
                  >
                     <Text style={styles.goOnlineBtnText}>Manage Delivery</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.activeOrderContent}>
                  <View style={styles.orderIconBg}>
                    <PackageOpen color="#D1D5DB" size={32} />
                  </View>
                  <Text style={styles.emptyOrderTitle}>Finding Orders...</Text>
                  <Text style={styles.emptyOrderSub}>
                    You are online and ready to receive orders. Wait here.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  headerContainer: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  topIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBtn: {
    position: 'relative',
    padding: 4,
    marginLeft: -4, // Adjust for padding
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444', // Red dot
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: LIGHT_BG,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '800',
    color: DARK_TEXT,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#DCFCE7', // Light green border
    backgroundColor: '#F3F4F6',
  },
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#F9FAFB',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
    position: 'relative',
    height: 48,
  },
  toggleTextWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK_TEXT,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: GREY_TEXT,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  scroll: {
    flexGrow: 1,
  },
  
  // Offline State
  offlineContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  scooterGraphic: {
    width: 200,
    height: 160,
    opacity: 0.6,
    marginBottom: 24,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 8,
  },
  offlineSub: {
    fontSize: 14,
    color: GREY_TEXT,
    marginBottom: 32,
    textAlign: 'center',
  },
  goOnlineBtn: {
    width: '100%',
    backgroundColor: BRAND_GREEN,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  goOnlineBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Online State
  onlineContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  activeOrderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: BRAND_GREEN,
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 200,
  },
  activeOrderHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_GREEN,
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  activeOrderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  orderIconBg: {
    marginBottom: 16,
    opacity: 0.5,
  },
  orderIconBgActive: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyOrderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: GREY_TEXT,
    marginBottom: 6,
  },
  emptyOrderSub: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  activeOrderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 6,
  },
  activeOrderSub: {
    fontSize: 15,
    color: GREY_TEXT,
    fontWeight: '500',
  },
});
