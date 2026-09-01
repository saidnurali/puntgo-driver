import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useOrder } from '../../contexts/OrderContext';
import { Star, ChevronRight, HeadphonesIcon, LogOut, User } from 'lucide-react-native';

const BRAND_GREEN = '#1F933F';
const DARK_TEXT = '#111827';
const GREY_TEXT = '#6B7280';
const BORDER = '#E5E7EB';
const LIGHT_BG = '#F9FAFB';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { driverProfile, driverStatus, todayEarnings, todayDeliveries } = useOrder();

  const handleSupport = () => {
    // Attempt to open WhatsApp or Phone for support
    // Here we just dial a dummy support number for demonstration
    Linking.openURL('tel:+252612345678').catch(() => {
      Alert.alert('Error', 'Unable to open phone dialer. This feature may not be available on simulators.');
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your driver account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  if (!driverProfile) {
    return (
      <View style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* ── HERO HEADER ── */}
      <View style={[styles.heroHeader, { paddingTop: Math.max(insets.top, 40) }]}>
        <View style={styles.heroContent}>
          {driverProfile.profile_photo ? (
            <Image 
              source={{ uri: driverProfile.profile_photo }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={40} color="#FFF" />
            </View>
          )}
          
          <View style={styles.heroTextContainer}>
            <Text style={styles.driverName}>{driverProfile.full_name}</Text>
            <View style={styles.ratingBadge}>
              <Star size={14} color="#FCD34D" fill="#FCD34D" />
              <Text style={styles.ratingText}>{driverProfile.rating?.toFixed(1) || '5.0'}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingBottom: 90 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── DETAILS CARD ── */}
        <View style={styles.card}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone Number</Text>
            <Text style={styles.detailValue}>{driverProfile.phone}</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle Type</Text>
            <Text style={styles.detailValue}>{driverProfile.vehicle_model || 'Motorcycle'}</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle Number</Text>
            <Text style={styles.detailValue}>{driverProfile.vehicle_plate || 'N/A'}</Text>
          </View>
          <View style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Status</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {driverStatus === 'online' ? 'Active' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── TODAY'S METRICS CARD ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Today's Metrics</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Deliveries</Text>
              <Text style={styles.statValue}>{todayDeliveries}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Earnings</Text>
              <Text style={styles.statValue}>${todayEarnings.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* ── ACTION MENU CARD ── */}
        <View style={styles.actionCard}>
          <TouchableOpacity 
            style={styles.actionRow} 
            onPress={handleSupport}
            activeOpacity={0.7}
          >
            <View style={styles.actionRowLeft}>
              <HeadphonesIcon size={20} color={DARK_TEXT} />
              <Text style={styles.actionLabel}>Support</Text>
            </View>
            <ChevronRight size={20} color={GREY_TEXT} />
          </TouchableOpacity>
          
          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.actionRow} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={styles.actionRowLeft}>
              <LogOut size={20} color="#EF4444" />
              <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Logout</Text>
            </View>
            <ChevronRight size={20} color={GREY_TEXT} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  safe: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  heroHeader: {
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextContainer: {
    marginLeft: 20,
  },
  driverName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  ratingText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: GREY_TEXT,
  },
  statusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    color: BRAND_GREEN,
    fontWeight: '600',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  actionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: BORDER,
  },
  statLabel: {
    fontSize: 13,
    color: GREY_TEXT,
    fontWeight: '500',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: BRAND_GREEN,
  },
});
