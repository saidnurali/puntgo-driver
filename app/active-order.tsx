import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useOrder } from '../contexts/OrderContext';
import { ChevronLeft, MessageSquare, Phone, Store, PackageCheck, Truck, CheckCircle, Navigation } from 'lucide-react-native';

const BRAND_GREEN = '#1F933F';
const DARK_TEXT = '#111827';
const GREY_TEXT = '#6B7280';
const BORDER = '#E5E7EB';

// Garowe city centre — fallback when order doesn't have real coords yet
const GAROWE_DEFAULT = { latitude: 8.4064, longitude: 48.4826 };

const STAGES = [
  { id: 'accepted', label: 'Accepted', icon: PackageCheck },
  { id: 'picked_up', label: 'Picked Up', icon: Store },
  { id: 'on_the_way', label: 'On The Way', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function ActiveOrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentOrder, pickupOrder, completeOrder } = useOrder();

  // Local state for "Arrived at Customer" stage
  const [hasArrived, setHasArrived] = useState(false);

  // Live driver GPS position for the map marker
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  // Start a lightweight foreground position watcher for this screen only
  useEffect(() => {
    let cancelled = false;

    async function startWatch() {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Get current position immediately for map centering
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) {
        setDriverLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      }

      // Then watch for updates at 5 s / 10 m (screen-level, lighter than broadcast hook)
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5_000, distanceInterval: 10 },
        (loc) => {
          if (!cancelled) {
            setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        }
      );
      if (!cancelled) {
        watcherRef.current = sub;
      } else {
        sub.remove();
      }
    }

    startWatch();
    return () => {
      cancelled = true;
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, []);

  if (!currentOrder) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorText}>No active order found.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Real coordinates from the orders table ──────────────────
  // restaurant_lat/lng and delivery_lat/lng are populated by the Customer app
  // when the order is placed with a geocoded address.
  // If null (older orders / manual data entry), fall back to Garowe centre with a comment.
  const restaurantCoords = (currentOrder.restaurant_lat != null && currentOrder.restaurant_lng != null)
    ? { latitude: currentOrder.restaurant_lat, longitude: currentOrder.restaurant_lng }
    : GAROWE_DEFAULT; // fallback — TODO: geocode restaurant_name address in a future task

  const customerCoords = (currentOrder.delivery_lat != null && currentOrder.delivery_lng != null)
    ? { latitude: currentOrder.delivery_lat, longitude: currentOrder.delivery_lng }
    : { latitude: GAROWE_DEFAULT.latitude + 0.004, longitude: GAROWE_DEFAULT.longitude + 0.004 }; // fallback

  const driverCoords = driverLocation ?? GAROWE_DEFAULT;

  // Map initial region centred between restaurant and customer
  const midLat = (restaurantCoords.latitude + customerCoords.latitude) / 2;
  const midLng = (restaurantCoords.longitude + customerCoords.longitude) / 2;
  const latDelta = Math.abs(restaurantCoords.latitude - customerCoords.latitude) * 2.5 + 0.01;
  const lngDelta = Math.abs(restaurantCoords.longitude - customerCoords.longitude) * 2.5 + 0.01;

  // ── Stage index ─────────────────────────────────────────────
  // 'Preparing' → 0 (Accepted), 'Out for Delivery' w/ hasArrived false → 1 (Picked Up),
  // 'Out for Delivery' w/ hasArrived true → 2 (On The Way), 'Delivered' → 3
  let currentStageIndex = 0;
  if (currentOrder.status === 'Out for Delivery') {
    currentStageIndex = hasArrived ? 2 : 1;
  } else if (currentOrder.status === 'Delivered') {
    currentStageIndex = 3;
  }

  // ── Action button ───────────────────────────────────────────
  let actionLabel = 'Loading...';
  let handleAction = async () => {};

  if (currentOrder.status === 'Preparing') {
    actionLabel = 'Picked Up from Restaurant';
    handleAction = async () => {
      await pickupOrder(currentOrder.id);
    };
  } else if (currentOrder.status === 'Out for Delivery' && !hasArrived) {
    actionLabel = 'Arrived at Customer';
    handleAction = async () => {
      setHasArrived(true);
    };
  } else if (currentOrder.status === 'Out for Delivery' && hasArrived) {
    actionLabel = 'Complete Delivery';
    handleAction = async () => {
      router.push('/confirm-delivery');
    };
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── HEADER ── */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color={DARK_TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order #{String(currentOrder.id).slice(-5).toUpperCase()}</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <View style={styles.notificationDot} />
            <MessageSquare size={22} color={DARK_TEXT} />
          </TouchableOpacity>
        </View>

        {/* ── STEPPER ── */}
        <View style={styles.stepperContainer}>
          {STAGES.map((stage, index) => {
            const isActive = index === currentStageIndex;
            const isCompleted = index < currentStageIndex;
            const Icon = stage.icon;

            return (
              <View key={stage.id} style={styles.stepItem}>
                <View style={styles.stepIconRow}>
                  <View
                    style={[
                      styles.stepCircle,
                      isActive && styles.stepCircleActive,
                      isCompleted && styles.stepCircleCompleted,
                    ]}
                  >
                    <Icon size={16} color={isActive || isCompleted ? '#FFF' : GREY_TEXT} />
                  </View>
                  {index < STAGES.length - 1 && (
                    <View style={[styles.stepLine, (isActive || isCompleted) && styles.stepLineActive]} />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    isActive && styles.stepLabelActive,
                    isCompleted && styles.stepLabelCompleted,
                  ]}
                  numberOfLines={1}
                >
                  {stage.label}
                </Text>
              </View>
            );
          })}
        </View>
      </SafeAreaView>

      {/* ── MAP ── */}
      {/* Note: Polyline is a straight line (not a real route) — a future task can
          integrate the Google Maps Directions API for turn-by-turn routing. */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFillObject}
          region={{
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: latDelta,
            longitudeDelta: lngDelta,
          }}
        >
          {/* Straight-line route: restaurant → driver → customer (placeholder) */}
          <Polyline
            coordinates={[restaurantCoords, driverCoords, customerCoords]}
            strokeColor={BRAND_GREEN}
            strokeWidth={4}
            lineDashPattern={[1]}
          />

          {/* Restaurant Marker */}
          <Marker coordinate={restaurantCoords} title="Restaurant" description={currentOrder.restaurant_name}>
            <View style={styles.markerContainer}>
              <View style={[styles.markerBg, { backgroundColor: '#FEF3C7' }]}>
                <Store size={18} color="#D97706" />
              </View>
              <View style={[styles.markerTriangle, { borderTopColor: '#FEF3C7' }]} />
            </View>
          </Marker>

          {/* Customer / Delivery Marker */}
          <Marker coordinate={customerCoords} title="Customer" description={currentOrder.delivery_address}>
            <View style={styles.markerContainer}>
              <View style={[styles.markerBg, { backgroundColor: '#DCFCE7' }]}>
                <Text style={styles.markerText}>🏠</Text>
              </View>
              <View style={[styles.markerTriangle, { borderTopColor: '#DCFCE7' }]} />
            </View>
          </Marker>

          {/* Driver Live Position Marker */}
          {driverLocation && (
            <Marker coordinate={driverCoords} title="You">
              <View style={styles.driverMarkerContainer}>
                <View style={styles.driverMarkerBg}>
                  <Navigation size={16} color="#FFF" />
                </View>
              </View>
            </Marker>
          )}
        </MapView>
      </View>

      {/* ── BOTTOM SHEET ── */}
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>

        {/* Customer Info */}
        <View style={styles.customerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.customerName}>{currentOrder.customer_name || 'Customer'}</Text>
          </View>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => {
              if (currentOrder.customer_phone) {
                const url = `tel:${currentOrder.customer_phone}`;
                import('react-native').then(({ Linking }) => Linking.openURL(url));
              }
            }}
          >
            <Phone size={20} color={DARK_TEXT} />
          </TouchableOpacity>
        </View>

        {/* Delivery Address */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Delivery Address</Text>
          <Text style={styles.infoText}>
            {currentOrder.delivery_address || 'Address not available'}
          </Text>
        </View>

        {/* Restaurant */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Pickup from</Text>
          <Text style={styles.infoText}>
            {currentOrder.restaurant_name || 'Restaurant'}
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleAction}
          activeOpacity={0.9}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  errorText: {
    fontSize: 16,
    color: DARK_TEXT,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  headerSafe: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    zIndex: 1,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepCircleActive: {
    backgroundColor: BRAND_GREEN,
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  stepCircleCompleted: {
    backgroundColor: BRAND_GREEN,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#F3F4F6',
    marginLeft: -16,
    marginRight: -16,
    zIndex: 1,
  },
  stepLineActive: {
    backgroundColor: '#A7F3D0',
  },
  stepLabel: {
    fontSize: 10,
    color: GREY_TEXT,
    fontWeight: '500',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: BRAND_GREEN,
    fontWeight: '700',
  },
  stepLabelCompleted: {
    color: DARK_TEXT,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 0,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  markerText: {
    fontSize: 16,
  },
  driverMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFF',
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  bottomSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 15,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: GREY_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoText: {
    fontSize: 15,
    color: DARK_TEXT,
    fontWeight: '500',
  },
  actionBtn: {
    backgroundColor: BRAND_GREEN,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
