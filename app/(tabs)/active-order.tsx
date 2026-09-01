import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import {
  Search,
  Bell,
  X,
  ChevronRight,
  MapPin,
  Clock,
  Package,
  Phone,
  MessageCircle,
  Navigation,
} from 'lucide-react-native';
import CustomerChatModal from '../../components/CustomerChatModal';
import { logger } from '../../utils/logger';
import { useToast } from '../../lib/GlobalErrorProvider';
import { OfflineQueue } from '../../services/OfflineQueue';

// ── Brand ──────────────────────────────────────────────────────
const GREEN = '#1F933F';
const LIGHT_BG = '#F9FAFB';
const WHITE = '#FFFFFF';
const DARK = '#111827';
const GREY = '#6B7280';
const BORDER = '#E5E7EB';

// ── Types ──────────────────────────────────────────────────────
// Exact status strings as found in the production `orders` table (Step 0 findings).
// Do NOT add strings here that the Customer app doesn't write — mismatches cause silent failures.
type OrderStatus =
  | 'Pending'           // Unclaimed — driver_id IS NULL
  | 'Preparing'         // Driver accepted, restaurant preparing
  | 'Out for Delivery'  // Driver picked up, en-route
  | 'Delivered'         // Delivery complete
  | 'Delivered (Reviewed)' // Complete + customer left a review
  | 'Cancelled';        // Cancelled

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
}

interface Order {
  id: string | number;
  restaurant_name?: string;
  restaurant?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  address?: string;
  items: OrderItem[];
  total_price: number;
  delivery_fee?: number;
  status: OrderStatus;
  created_at: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  cancel_reason?: string;
  restaurant_lat?: number;
  restaurant_lng?: number;
  customer_lat?: number;
  customer_lng?: number;
}

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  vehicle_model?: string;
  vehicle_plate?: string;
}

// ── Preset cancel reasons ───────────────────────────────────────
const CANCEL_PRESETS = [
  '🚲 Distance too far / Out of range',
  '🌧️ Bad weather / Heavy traffic',
  '🛠️ Vehicle / Bike mechanical issue',
];

const CUSTOM_REASON = '✏️ Other (Type custom reason...)';

// ── Cancel Reason Bottom Sheet ──────────────────────────────────
function CancelReasonSheet({
  visible,
  onSubmit,
  onDismiss,
}: {
  visible: boolean;
  onSubmit: (reason: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setCustomText('');
    }
  }, [visible]);

  const canSubmit =
    selected !== null &&
    (selected !== CUSTOM_REASON || customText.trim().length > 0);

  const handleSubmit = async () => {
    const reason = selected === CUSTOM_REASON ? customText.trim() : selected!;
    setSubmitting(true);
    await onSubmit(reason);
    setSubmitting(false);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={cr.kvWrapper}
      >
        <View style={cr.overlay}>
          <View style={cr.sheet}>
            {/* Handle */}
            <View style={cr.handle} />

            {/* Header */}
            <View style={cr.header}>
              <Text style={cr.title}>Cancel Order</Text>
              <TouchableOpacity onPress={onDismiss} style={cr.closeBtn}>
                <X size={20} color={DARK} />
              </TouchableOpacity>
            </View>
            <Text style={cr.subtitle}>Select a reason for cancellation</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {CANCEL_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[cr.option, selected === preset && cr.optionSelected]}
                  onPress={() => setSelected(preset)}
                  activeOpacity={0.7}
                >
                  <View style={[cr.radio, selected === preset && cr.radioSelected]}>
                    {selected === preset && <View style={cr.radioDot} />}
                  </View>
                  <Text style={[cr.optionText, selected === preset && cr.optionTextSelected]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Custom reason */}
              <TouchableOpacity
                style={[cr.option, selected === CUSTOM_REASON && cr.optionSelected]}
                onPress={() => setSelected(CUSTOM_REASON)}
                activeOpacity={0.7}
              >
                <View style={[cr.radio, selected === CUSTOM_REASON && cr.radioSelected]}>
                  {selected === CUSTOM_REASON && <View style={cr.radioDot} />}
                </View>
                <Text style={[cr.optionText, selected === CUSTOM_REASON && cr.optionTextSelected]}>
                  {CUSTOM_REASON}
                </Text>
              </TouchableOpacity>

              {selected === CUSTOM_REASON && (
                <TextInput
                  style={cr.textInput}
                  placeholder="Type your reason here…"
                  placeholderTextColor={GREY}
                  value={customText}
                  onChangeText={setCustomText}
                  multiline
                  numberOfLines={3}
                  autoFocus
                />
              )}

              <TouchableOpacity
                style={[cr.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!canSubmit || submitting}
                activeOpacity={0.8}
              >
                <Text style={cr.submitBtnText}>
                  {submitting ? 'Submitting…' : 'Confirm Cancellation'}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Filters ────────────────────────────────────────────────────
const FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Preparing', value: 'Preparing' },
  { label: 'Ready', value: 'Ready' },
  { label: 'Delivering', value: 'Out for Delivery' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' },
];

// Keyed by the EXACT status strings stored in the DB (confirmed in Step 0).
const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  Pending:                  { color: '#D97706', bg: '#FEF3C7', label: 'Pending' },
  Preparing:                { color: '#2563EB', bg: '#DBEAFE', label: 'Preparing' },
  'Out for Delivery':       { color: GREEN,    bg: '#DCFCE7', label: 'Out for Delivery' },
  Delivered:                { color: '#059669', bg: '#D1FAE5', label: 'Delivered' },
  'Delivered (Reviewed)':   { color: '#059669', bg: '#D1FAE5', label: 'Delivered ✓' },
  Cancelled:                { color: '#DC2626', bg: '#FEE2E2', label: 'Cancelled' },
};

// ── Helpers ────────────────────────────────────────────────────
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function orderId(id: string | number): string {
  return `#${String(id ?? '').slice(-4).toUpperCase()}`;
}

const getRestaurantName = (orderData: any) => {
  if (!orderData) return 'Restaurant';
  
  let name = 'Restaurant';
  if (orderData.restaurant_name) name = orderData.restaurant_name;
  else if (orderData.restaurant) name = orderData.restaurant;
  else if (Array.isArray(orderData.items) && orderData.items[0]?.restaurant_name) {
    name = orderData.items[0].restaurant_name;
  }
  
  if (name === 'PuntEats Restaurant' || name === 'PuntEats Partner') {
    return 'Restaurant';
  }
  return name;
};

// ── Skeleton ───────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <View style={[sk.card]}>
      <View style={[sk.line, { width: '40%', marginBottom: 8 }]} />
      <View style={[sk.line, { width: '70%', marginBottom: 6 }]} />
      <View style={[sk.line, { width: '50%' }]} />
    </View>
  );
}
const sk = StyleSheet.create({
  card: { backgroundColor: WHITE, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  line: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6 },
});

// ── Order Card ─────────────────────────────────────────────────
const OrderCard = memo(({ order, onPress }: { order: Order; onPress: () => void }) => {
  const restaurant = getRestaurantName(order);
  const address = order.delivery_address || order.address || '—';
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG['Pending'];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.cardId}>{orderId(order.id)}</Text>
          <Text style={styles.cardRestaurant} numberOfLines={1}>{restaurant}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: sc.color }]} />
          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <View style={styles.metaRow}>
          <Package size={13} color={GREY} />
          <Text style={styles.metaText}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>${(order.total_price ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Clock size={13} color={GREY} />
          <Text style={styles.metaText}>{formatDate(order.created_at)} · {formatTime(order.created_at)}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.metaRow}>
          <MapPin size={13} color={GREY} />
          <Text style={styles.addressText} numberOfLines={1}>{address}</Text>
        </View>
        {order.driver_name ? (
          <Text style={styles.driverText}>Driver: {order.driver_name}</Text>
        ) : (
          <Text style={styles.noDriverText}>No driver assigned</Text>
        )}
        <ChevronRight size={18} color={GREY} />
      </View>
    </TouchableOpacity>
  );
});

// ── Order Detail Modal ─────────────────────────────────────────
function OrderDetailModal({
  order,
  visible,
  onClose,
  onRefresh,
}: {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Local optimistic status so the UI updates before realtime refresh
  const [localStatus, setLocalStatus] = useState<OrderStatus | null>(null);

  // Reset localStatus whenever a new order is opened
  useEffect(() => {
    setLocalStatus(null);
    setShowCancelSheet(false);
    setUnreadCount(0);
  }, [order?.id]);

  // Listen for new messages to update unread badge
  useEffect(() => {
    if (!order?.id) return;
    
    const channel = supabase
      .channel(`badge_chat_${String(order.id)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=eq.${order.id}`,
      }, (payload) => {
        // If chat modal is closed and it's a customer message, increment badge
        if (!showChat && payload.new.sender_role === 'customer') {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id, showChat]);

  useEffect(() => {
    if (showChat) {
      setUnreadCount(0); // clear badge when opened
    }
  }, [showChat]);

  useEffect(() => {
    if (showAssign) loadDrivers();
  }, [showAssign]);

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, full_name, phone, status, vehicle_model, vehicle_plate')
        .order('status', { ascending: false });
      if (error) {
        logger.warn('[OrderDetail] loadDrivers error:', error.message);
      } else if (data) {
        setDrivers(data);
      }
    } catch (e) {
      logger.error('[OrderDetail] loadDrivers unexpected error:', e);
    }
  };

  const assignDriver = async (driver: Driver) => {
    if (!order) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ driver_name: driver.full_name, status: order.status === 'Pending' ? 'Preparing' : order.status })
        .eq('id', order.id);
      if (error) {
        logger.error('[OrderDetail] assignDriver error:', error.message);
      }
    } catch (e) {
      logger.error('[OrderDetail] assignDriver unexpected error:', e);
    } finally {
      setAssigning(false);
      setShowAssign(false);
      onRefresh();
      onClose();
    }
  };

  const updateStatus = async (newStatus: OrderStatus, extra?: Record<string, any>) => {
    if (!order) return;
    setUpdating(true);

    // Optimistic local update — UI responds immediately
    setLocalStatus(newStatus);

    let { error } = await supabase
      .from('orders')
      .update({ status: newStatus, ...extra })
      .eq('id', order.id);

    if (error && error.code === 'PGRST204' && extra?.cancellation_reason) {
      console.warn('[updateStatus] cancellation_reason column missing, falling back to status only.');
      const fallbackExtra = { ...extra };
      delete fallbackExtra.cancellation_reason;
      delete fallbackExtra.cancelled_by;
      
      const fallback = await supabase
        .from('orders')
        .update({ status: newStatus, ...fallbackExtra })
        .eq('id', order.id);
      error = fallback.error;
    }

    setUpdating(false);

    if (error) {
      console.error('[updateStatus] Supabase error:', error);
      
      // If it's a network error, queue it for later
      if (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network')) {
        await OfflineQueue.push({
          orderId: String(order.id),
          action: 'UPDATE_STATUS',
          payload: { status: newStatus, ...extra }
        });
        Alert.alert('Offline Mode', `You are offline. Order will be marked as ${newStatus} when internet returns.`);
        onClose();
        return;
      }
      
      setLocalStatus(null); // revert optimistic update on true error
    } else {
      onRefresh(); // background refresh to sync list
      if (newStatus === 'Delivered') {
        Alert.alert('✅ Delivered!', 'Order has been completed successfully.');
        onClose();
      }
    }
  };

  // Called when driver submits a cancel reason
  const handleCancelWithReason = async (reason: string) => {
    if (!order) return;
    setShowCancelSheet(false);
    await updateStatus('Cancelled', { cancellation_reason: reason, cancelled_by: 'driver' });
    onClose();
  };

  if (!order) return null;

  // Use optimistic local status if set, otherwise fall back to DB status
  const displayStatus: OrderStatus = localStatus ?? order.status;

  const restaurant = getRestaurantName(order);
  const address = order.delivery_address || order.address || '—';
  const sc = STATUS_CONFIG[displayStatus] || STATUS_CONFIG['Pending'];
  const subtotal = Array.isArray(order.items)
    ? order.items.reduce((s, i) => s + Number(i.price ?? 0) * Number(i.quantity ?? 1), 0)
    : 0;
  const deliveryFee = order.delivery_fee ?? 0;

  // Full driver action mapping across all stages:
  // Pending / Order Placed → Accept & Start Preparing
  // Preparing              → Mark as Picked Up
  // Out for Delivery / Delivering → Mark as Delivered
  // Delivered / Completed  → green badge only, no button
  // Cancelled              → no button
  // Use exact DB status strings — no 'Order Placed', 'Delivering', or 'Completed'
  const isPending = displayStatus === 'Pending';
  const isDelivering = displayStatus === 'Out for Delivery';
  const isCompleted = displayStatus === 'Delivered' || displayStatus === 'Delivered (Reviewed)';

  const driverAction: { label: string; next: OrderStatus; color: string } | null =
    isPending
      ? { label: '🟡 Accept & Start Preparing', next: 'Preparing', color: '#D97706' }
      : displayStatus === 'Preparing'
      ? { label: '🔵 Mark as Picked Up / Out for Delivery', next: 'Out for Delivery', color: '#2563EB' }
      : isDelivering
      ? { label: '🟢 Mark as Delivered (Gacanta ka saaray)', next: 'Delivered', color: '#1F933F' }
      : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={modal.safe}>
        <StatusBar style="dark" />
        {/* Header */}
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <X size={22} color={DARK} />
          </TouchableOpacity>
          <Text style={modal.title}>Order Details</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Chat with Customer button for active orders */}
            {(!isPending && !isCompleted && displayStatus !== 'Cancelled') && (
              <TouchableOpacity 
                onPress={() => setShowChat(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, position: 'relative' }}
              >
                <MessageCircle size={20} color="#2563EB" />
                {unreadCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: '#EF4444',
                    borderRadius: 10,
                    width: 16,
                    height: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 1.5,
                    borderColor: '#FFF'
                  }}>
                    <Text style={{ color: '#FFF', fontSize: 9, fontWeight: 'bold' }}>
                      {unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            
            {/* Subtle cancel button for active orders (Preparing/Delivery) */}
            {!isPending && !isCompleted && displayStatus !== 'Cancelled' && (
              <TouchableOpacity onPress={() => setShowCancelSheet(true)}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626' }}>Cancel</Text>
              </TouchableOpacity>
            )}
            <View style={[modal.badge, { backgroundColor: sc.bg }]}>
              <Text style={[modal.badgeText, { color: sc.color }]}>{sc.label}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={modal.scroll} showsVerticalScrollIndicator={false}>
          {/* IDs */}
          <View style={modal.section}>
            <Row label="Order" value={orderId(order.id)} />
            <Row label="Date" value={`${formatDate(order.created_at)} · ${formatTime(order.created_at)}`} />
          </View>

          {/* Customer */}
          <SectionTitle title="Customer" />
          <View style={modal.section}>
            <Row label="Name" value={order.customer_name || '—'} />
            <Row label="Phone" value={order.customer_phone || '—'} icon={<Phone size={14} color={GREEN} />} />
            <Row label="Delivery Address" value={address} />
          </View>

          {/* Restaurant */}
          <SectionTitle title="Restaurant" />
          <View style={modal.section}>
            <Row label="Name" value={restaurant} />
          </View>

          {/* Items */}
          <SectionTitle title="Order Items" />
          <View style={modal.section}>
            {Array.isArray(order?.items) && order.items.length > 0 ? (
              order.items.map((item, i) => (
                <View key={i} style={modal.itemRow}>
                  <Text style={modal.itemQty}>{item?.quantity ?? 1}×</Text>
                  <Text style={modal.itemName}>{item?.name ?? 'Unknown Item'}</Text>
                  {item?.price != null && (
                    <Text style={modal.itemPrice}>${(item.price * (item.quantity ?? 1)).toFixed(2)}</Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={modal.emptyItems}>No item details available</Text>
            )}
            <View style={modal.divider} />
            {subtotal > 0 && <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />}
            {deliveryFee > 0 && <Row label="Delivery Fee" value={`$${deliveryFee.toFixed(2)}`} />}
            <Row label="Total" value={`$${(order.total_price ?? 0).toFixed(2)}`} bold />
          </View>

          {/* Driver */}
          <SectionTitle title="Driver" />
          <View style={modal.section}>
            <Row label="Assigned Driver" value={`${order.driver_name || 'Unassigned'} (${order.driver_phone || 'No phone'})`} />
          </View>

          {/* Actions */}
          <View style={modal.actions}>

            {/* Navigation Buttons */}
            {(!isPending && !isCompleted && displayStatus !== 'Cancelled') && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <TouchableOpacity
                  style={[modal.actionBtn, { flex: 1, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6', height: 48 }]}
                  onPress={() => {
                    const url = order.restaurant_lat && order.restaurant_lng 
                      ? `https://www.google.com/maps/dir/?api=1&destination=${order.restaurant_lat},${order.restaurant_lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant)}`;
                    Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open maps.'));
                  }}
                  activeOpacity={0.8}
                >
                  <MapPin size={18} color="#3B82F6" style={{ marginRight: 6 }} />
                  <Text style={[modal.actionBtnText, { color: '#3B82F6', fontSize: 14 }]}>Restaurant</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modal.actionBtn, { flex: 1, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6', height: 48 }]}
                  onPress={() => {
                    const url = order.customer_lat && order.customer_lng 
                      ? `https://www.google.com/maps/dir/?api=1&destination=${order.customer_lat},${order.customer_lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                    Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open maps.'));
                  }}
                  activeOpacity={0.8}
                >
                  <Navigation size={18} color="#3B82F6" style={{ marginRight: 6 }} />
                  <Text style={[modal.actionBtnText, { color: '#3B82F6', fontSize: 14 }]}>Customer</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Call Buttons */}
            {(!isPending && !isCompleted && displayStatus !== 'Cancelled') && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <TouchableOpacity
                  style={[modal.actionBtn, { flex: 1, backgroundColor: '#F3F4F6', height: 48 }]}
                  onPress={() => {
                    Linking.openURL(`tel:+252907730148`).catch(() => Alert.alert('Error', 'Unable to dial dispatch.'));
                  }}
                  activeOpacity={0.8}
                >
                  <Phone size={18} color="#4B5563" style={{ marginRight: 6 }} />
                  <Text style={[modal.actionBtnText, { color: '#4B5563', fontSize: 14 }]}>Dispatch</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modal.actionBtn, { flex: 1, backgroundColor: '#F3F4F6', height: 48 }]}
                  onPress={() => {
                    const phone = order.customer_phone || '';
                    if (!phone) {
                      Alert.alert('No Phone', 'Customer did not provide a phone number.');
                      return;
                    }
                    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Unable to dial customer.'));
                  }}
                  activeOpacity={0.8}
                >
                  <Phone size={18} color="#4B5563" style={{ marginRight: 6 }} />
                  <Text style={[modal.actionBtnText, { color: '#4B5563', fontSize: 14 }]}>Customer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Primary driver action — exactly ONE per status */}
            {driverAction && (
              <TouchableOpacity
                style={[modal.actionBtn, { backgroundColor: driverAction.color }, updating && { opacity: 0.7 }]}
                onPress={() => updateStatus(driverAction.next)}
                disabled={updating}
                activeOpacity={0.8}
              >
                {updating ? (
                  <ActivityIndicator color={WHITE} size="small" />
                ) : (
                  <Text style={modal.actionBtnText}>{driverAction.label}</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Completed badge — hide all action buttons */}
            {isCompleted && (
              <View style={[modal.actionBtn, { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#059669' }]}>
                <Text style={[modal.actionBtnText, { color: '#059669' }]}>✅ Order Delivered & Completed</Text>
              </View>
            )}

            {/* Cancel \u2014 only shown for Pending / Order Placed (before acceptance).
                Hidden once driver has accepted (Preparing, Out for Delivery, Delivered, etc.) */}
            {isPending && (
              <TouchableOpacity
                style={[modal.actionBtn, { backgroundColor: '#DC2626', marginTop: 8 }]}
                onPress={() => setShowCancelSheet(true)}
                disabled={updating}
              >
                <Text style={modal.actionBtnText}>Cancel Order</Text>
              </TouchableOpacity>
            )}

          </View>

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Assign Driver Sheet */}
        {showAssign && (
          <View style={assign.overlay}>
            <View style={assign.sheet}>
              <View style={assign.sheetHeader}>
                <Text style={assign.sheetTitle}>Select Driver</Text>
                <TouchableOpacity onPress={() => setShowAssign(false)}>
                  <X size={22} color={DARK} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {drivers.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={assign.driverRow}
                    onPress={() => assignDriver(d)}
                    disabled={assigning}
                  >
                    <View style={assign.driverAvatar}>
                      <Text style={assign.avatarText}>{d.full_name.charAt(0)}</Text>
                    </View>
                    <View style={assign.driverInfo}>
                      <Text style={assign.driverName}>{d.full_name}</Text>
                      <Text style={assign.driverMeta}>
                        {d.vehicle_model || 'No vehicle'} · {d.phone}
                      </Text>
                    </View>
                    <View style={[assign.statusPill, { backgroundColor: d.status === 'online' ? '#DCFCE7' : '#F3F4F6' }]}>
                      <Text style={[assign.statusPillText, { color: d.status === 'online' ? GREEN : GREY }]}>
                        {d.status === 'online' ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {drivers.length === 0 && (
                  <Text style={assign.noDrivers}>No drivers available</Text>
                )}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Cancel Reason Bottom Sheet */}
        <CancelReasonSheet
          visible={showCancelSheet}
          onSubmit={handleCancelWithReason}
          onDismiss={() => setShowCancelSheet(false)}
        />

        <CustomerChatModal
          orderId={String(order.id)}
          visible={showChat}
          onClose={() => setShowChat(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ── Small helpers ──────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return <Text style={modal.sectionTitle}>{title}</Text>;
}
function Row({ label, value, bold, icon }: { label: string; value: string; bold?: boolean; icon?: React.ReactNode }) {
  return (
    <View style={modal.row}>
      <Text style={modal.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon}
        <Text style={[modal.rowValue, bold && modal.rowValueBold]}>{value}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────
const PAGE_SIZE = 20;

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { showError } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const channelRef = useRef<any>(null);

  const upsertLocalOrder = useCallback((incomingOrder: Order) => {
    setOrders((prevOrders) => {
      // If filtering is applied and the incoming order doesn't match the filter, 
      // we might want to remove it or just ignore it.
      if (filter !== 'all' && (incomingOrder.status || '').toLowerCase() !== filter.toLowerCase()) {
        return prevOrders.filter(o => String(o.id) !== String(incomingOrder.id));
      }

      // If search is applied, we might ignore inserts that don't match
      if (search.trim() && !(incomingOrder.restaurant_name || '').toLowerCase().includes(search.trim().toLowerCase())) {
        return prevOrders.filter(o => String(o.id) !== String(incomingOrder.id));
      }

      const existingIndex = prevOrders.findIndex((o) => String(o.id) === String(incomingOrder.id));
      if (existingIndex > -1) {
        const updated = [...prevOrders];
        updated[existingIndex] = incomingOrder;
        return updated;
      }
      return [incomingOrder, ...prevOrders];
    });
  }, [filter, search]);

  const fetchOrders = useCallback(async (reset = false) => {
    try {
      if (reset) {
        // Keep existing orders on screen while refreshing to prevent empty flashes
        setPage(0);
        setHasMore(true);
      } else {
        setLoading(true);
      }
      const from = reset ? 0 : page * PAGE_SIZE;
      let q = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (filter !== 'all') {
        q = q.ilike('status', filter);
      }
      if (search.trim()) {
        q = q.ilike('restaurant_name', `%${search.trim()}%`);
      }

      const { data, error: err } = await q;
      if (err) {
        logger.error('[OrdersScreen] fetchOrders error:', err.message);
        setError('Unable to load orders');
        return;
      }

      const rows = (data as Order[]) ?? [];
      setOrders(reset ? rows : (prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      if (!reset) setPage((p) => p + 1);
      setError(null);
    } catch (e) {
      logger.error('[OrdersScreen] fetchOrders unexpected error:', e);
      setError('Unable to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, search, page]);

  // Initial + filter/search load
  useEffect(() => {
    fetchOrders(true);
  }, [filter, search]);

  const { orderId } = useLocalSearchParams();

  useEffect(() => {
    if (orderId && orders.length > 0) {
      const match = orders.find(o => String(o.id) === String(orderId));
      if (match && selectedOrder?.id !== match.id) {
        setSelectedOrder(match);
      }
    }
  }, [orderId, orders]);

  // Realtime subscription with reconnect on error and deduplication
  useEffect(() => {
    const setupChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = supabase
        .channel(`orders-screen-rt_${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          upsertLocalOrder(payload.new as Order);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
          upsertLocalOrder(payload.new as Order);
        })
        .subscribe((status) => {
          logger.debug('[OrdersScreen] Realtime channel status:', status);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.warn('[OrdersScreen] Realtime channel error — reconnecting in 4s...');
            setTimeout(setupChannel, 4000);
          }
        });
    };

    setupChannel();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [upsertLocalOrder]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders(true);
  };

  const loadMore = () => {
    if (hasMore && !loading) fetchOrders();
  };

  const filteredOrders = orders; // server-side filtered already

  // ── Render ──
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSub}>Manage delivery orders</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(!showSearch)}>
            <Search size={22} color={DARK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Bell size={22} color={DARK} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchBar}>
          <Search size={16} color={GREY} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by restaurant name..."
            placeholderTextColor={GREY}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={GREY} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter Chips */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Loading skeletons */}
      {loading && orders.length === 0 && (
        <ScrollView contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}>
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </ScrollView>
      )}

      {/* Error state */}
      {!!error && (
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchOrders(true)}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty state */}
      {!loading && !error && filteredOrders.length === 0 && (
        <View style={styles.centerBox}>
          <Package size={48} color={BORDER} />
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptySub}>
            {filter !== 'all' ? `No ${filter} orders right now.` : 'No orders in the system yet.'}
          </Text>
        </View>
      )}

      {/* Orders List */}
      {!error && filteredOrders.length > 0 && (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={() => setSelectedOrder(item)} />
          )}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 90 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            hasMore && !loading ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 16 }} />
            ) : null
          }
        />
      )}

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        visible={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onRefresh={() => fetchOrders(true)}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LIGHT_BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: LIGHT_BG,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: DARK },
  headerSub: { fontSize: 13, color: GREY, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: DARK },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 13, fontWeight: '500', color: GREY },
  chipTextActive: { color: WHITE, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardTopLeft: { flex: 1 },
  cardId: { fontSize: 12, fontWeight: '700', color: GREEN, letterSpacing: 0.5, marginBottom: 3 },
  cardRestaurant: { fontSize: 16, fontWeight: '600', color: DARK },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
    marginLeft: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardMeta: { gap: 5, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDot: { color: GREY, fontSize: 13 },
  metaText: { fontSize: 13, color: GREY },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  addressText: { flex: 1, fontSize: 13, color: GREY },
  driverText: { fontSize: 12, fontWeight: '600', color: GREEN },
  noDriverText: { fontSize: 12, color: '#FCA5A5', fontWeight: '500' },

  // States
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errorTitle: { fontSize: 16, fontWeight: '600', color: DARK, textAlign: 'center' },
  retryBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryText: { color: WHITE, fontWeight: '600', fontSize: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: DARK, marginTop: 12 },
  emptySub: { fontSize: 14, color: GREY, textAlign: 'center' },
});

// ── Modal Styles ───────────────────────────────────────────────
const modal = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: LIGHT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: DARK },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: GREY,
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowLabel: { fontSize: 14, color: GREY },
  rowValue: { fontSize: 14, color: DARK, fontWeight: '500', textAlign: 'right', maxWidth: '60%' },
  rowValueBold: { fontWeight: '700', color: DARK, fontSize: 15 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 10,
  },
  itemQty: { fontSize: 14, fontWeight: '700', color: GREEN, width: 28 },
  itemName: { flex: 1, fontSize: 14, color: DARK },
  itemPrice: { fontSize: 14, color: GREY },
  emptyItems: { fontSize: 14, color: GREY, paddingVertical: 12 },
  noDriver: { fontSize: 14, color: '#FCA5A5', paddingVertical: 13 },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },
  actions: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  actionBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: { color: WHITE, fontWeight: '700', fontSize: 15 },
});

// ── Assign Sheet Styles ────────────────────────────────────────
const assign = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: DARK },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  driverAvatar: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: GREEN },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: '600', color: DARK },
  driverMeta: { fontSize: 13, color: GREY, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  noDrivers: { padding: 20, color: GREY, textAlign: 'center' },
});

// ── Cancel Reason Sheet Styles ─────────────────────────────────
const cr = StyleSheet.create({
  kvWrapper: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: '700', color: DARK },
  closeBtn: { padding: 4 },
  subtitle: {
    fontSize: 13,
    color: GREY,
    marginBottom: 14,
    marginTop: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
    gap: 12,
    backgroundColor: '#FAFAFA',
  },
  optionSelected: {
    borderColor: '#DC2626',
    backgroundColor: '#FFF5F5',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#DC2626' },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  optionText: { flex: 1, fontSize: 15, color: DARK, fontWeight: '500' },
  optionTextSelected: { color: '#DC2626', fontWeight: '600' },
  textInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: DARK,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  submitBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
});
