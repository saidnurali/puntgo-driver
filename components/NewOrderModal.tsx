import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  TextInput,
  ScrollView,
  Vibration,
} from 'react-native';
import { Store, MapPin, CircleDollarSign, X, ChevronRight } from 'lucide-react-native';
import { useOrder } from '../contexts/OrderContext';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import { stopAlarm } from '../lib/audioEngine';
import { logger } from '../utils/logger';

const { height } = Dimensions.get('window');
const BRAND_GREEN = '#1F933F';
const RED_BTN = '#EF4444';
const DARK_TEXT = '#111827';
const GREY_TEXT = '#6B7280';
const BORDER = '#E5E7EB';
const TIMER_DURATION = 180; // 3 minutes

// ── Preset cancellation reasons ───────────────────────────────
const CANCEL_PRESETS = [
  '🚲 Distance too far / Out of range',
  '🌧️ Bad weather / Heavy traffic',
  '🛠️ Vehicle / Bike mechanical issue',
];

const CUSTOM_REASON = '✏️ Other (Type custom reason...)';

// ── Cancel Reason Modal ───────────────────────────────────────
function CancelReasonModal({
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

  // Reset state every time the sheet opens
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setCustomText('');
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    const reason = selected === CUSTOM_REASON ? customText.trim() : selected;
    if (!reason) return;
    setSubmitting(true);
    await onSubmit(reason);
    // onSubmit handles closing — no local state change needed here
  };

  const canSubmit =
    selected !== null &&
    (selected !== CUSTOM_REASON || customText.trim().length > 0);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={cr.overlay}>
        <View style={cr.sheet}>
          {/* Handle bar */}
          <View style={cr.handle} />

          {/* Header */}
          <View style={cr.header}>
            <Text style={cr.title}>Why are you declining?</Text>
            <TouchableOpacity onPress={onDismiss} style={cr.closeBtn}>
              <X size={20} color={DARK_TEXT} />
            </TouchableOpacity>
          </View>
          <Text style={cr.subtitle}>Select a reason — this will be sent to the customer</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Preset options */}
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

            {/* Custom reason option */}
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
                placeholder="Type your reason here..."
                placeholderTextColor={GREY_TEXT}
                value={customText}
                onChangeText={setCustomText}
                multiline
                numberOfLines={3}
                autoFocus
              />
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[cr.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              activeOpacity={0.8}
            >
              <Text style={cr.submitBtnText}>
                {submitting ? 'Cancelling order...' : 'Confirm Cancellation'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── NewOrderModal ─────────────────────────────────────────────
export default function NewOrderModal() {
  const {
    incomingOrder,
    showGlobalModal,
    setShowGlobalModal,
    acceptOrder,
    declineOrder,
  } = useOrder();

  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [accepting, setAccepting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Unmount cleanup guard: guarantee sound stops if modal unmounts
  useEffect(() => {
    return () => {
      stopAlarm();
      Vibration.cancel();
    };
  }, []);

  // Reset timer whenever modal becomes visible with a new order
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (showGlobalModal && incomingOrder) {
      Vibration.vibrate([1000, 1000, 1000], true); // Loop vibration
      setTimeLeft(TIMER_DURATION);
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Timer expired: stop alarm and close popup.
            // Order stays Pending in DB — driver can still accept from Orders tab.
            stopAlarm();
            Vibration.cancel();
            setShowGlobalModal(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      Vibration.cancel();
    }
    return () => {
      clearInterval(timer);
      Vibration.cancel();
    };
  }, [showGlobalModal, incomingOrder?.id]);

  const handleAccept = async () => {
    if (!incomingOrder || accepting) return;
    setAccepting(true);
    Vibration.cancel();
    try {
      await acceptOrder(String(incomingOrder.id));
    } catch (e) {
      logger.error('[NewOrderModal] handleAccept error:', e);
    } finally {
      setAccepting(false);
    }
  };

  // Tapping Decline or X on the main popup → open cancel reason sheet
  // Stop alarm immediately and hide the main popup while reason sheet is open
  const handleDeclineTap = () => {
    stopAlarm();
    Vibration.cancel();
    setShowGlobalModal(false);
    setShowCancelModal(true);
  };

  // Called when driver selects a reason and taps "Confirm Cancellation"
  const handleCancelSubmit = async (reason: string) => {
    if (!incomingOrder) return;

    // Stop alarm (failsafe)
    stopAlarm();
    Vibration.cancel();

    try {
      let { error } = await supabase
        .from('orders')
        .update({ status: 'Cancelled', cancellation_reason: reason, cancelled_by: 'driver' })
        .eq('id', incomingOrder.id);

      // Failsafe: If 'cancellation_reason' column doesn't exist, fallback to status only
      if (error && error.code === 'PGRST204') {
        logger.warn('[NewOrderModal] cancellation_reason column missing, falling back to status only.');
        const fallback = await supabase
          .from('orders')
          .update({ status: 'Cancelled' })
          .eq('id', incomingOrder.id);
        error = fallback.error;
      }

      if (error) {
        logger.error('[NewOrderModal] cancel supabase error:', error.message);
      }
    } catch (e) {
      logger.error('[NewOrderModal] handleCancelSubmit unexpected error:', e);
    }

    // Close modals and clear context state regardless of DB outcome
    setShowCancelModal(false);
    await declineOrder(String(incomingOrder.id));
  };

  // Dismiss the cancel reason sheet WITHOUT cancelling the order
  // → driver goes back to seeing the popup
  const handleCancelDismiss = () => {
    setShowCancelModal(false);
    setShowGlobalModal(true); // Restore popup
  };

  // Guard: don't render at all if no incoming order
  // (We stay mounted if showCancelModal is true, so the cancel sheet can still show even if global modal is false)
  if ((!showGlobalModal && !showCancelModal) || !incomingOrder) return null;

  // SVG countdown ring — turns amber in last 30s, red in last 10s
  const radius = 24;
  const strokeWidth = 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / TIMER_DURATION) * circumference;
  const ringColor = timeLeft <= 10 ? '#EF4444' : timeLeft <= 30 ? '#F59E0B' : BRAND_GREEN;

  // Format mm:ss for 3-minute timer
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerLabel = `${mins}:${secs.toString().padStart(2, '0')}`;

  const getRestaurantName = (orderData: any) => {
    if (!orderData) return 'Restaurant';
    if (orderData.restaurant_name) return orderData.restaurant_name;
    if (orderData.restaurant) return orderData.restaurant;
    if (Array.isArray(orderData.items) && orderData.items[0]?.restaurant_name) {
      return orderData.items[0].restaurant_name;
    }
    return 'Restaurant';
  };

  // Display helpers
  const restaurantName = getRestaurantName(incomingOrder);
  const customerAddress =
    incomingOrder.delivery_address || incomingOrder.address || 'Unknown Address';
  const totalPrice = (incomingOrder.total_price ?? 0).toFixed(2);

  return (
    <>
      {showGlobalModal && (
        <Modal
          transparent
          visible={showGlobalModal}
          animationType="slide"
          statusBarTranslucent
          onRequestClose={handleDeclineTap}
        >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>

            {/* ── Header ── */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.dismissBtn} onPress={handleDeclineTap}>
                <X size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <Text style={styles.title}>New Delivery! 🚀</Text>
              <Text style={styles.subtitle}>You have an incoming order</Text>
            </View>

            {/* ── Details Card ── */}
            <View style={styles.card}>

              {/* Restaurant */}
              <View style={styles.detailRow}>
                <View style={styles.iconBox}>
                  <Store color="#D97706" size={20} />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={styles.label}>Restaurant</Text>
                  <Text style={styles.value}>{restaurantName}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Customer Address */}
              <View style={styles.detailRow}>
                <View style={styles.iconBox}>
                  <MapPin color={DARK_TEXT} size={20} />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={styles.label}>Deliver To</Text>
                  <Text style={styles.value}>{customerAddress}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Total Price */}
              <View style={styles.detailRow}>
                <View style={styles.iconBox}>
                  <CircleDollarSign color={BRAND_GREEN} size={20} />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text style={styles.label}>Order Total</Text>
                  <Text style={styles.earningValue}>${totalPrice}</Text>
                </View>
              </View>

              {/* ── Action Row ── */}
              <View style={styles.actionsContainer}>

                {/* Countdown ring */}
                <View style={styles.timerContainer}>
                  <Svg width={60} height={60} viewBox="0 0 60 60">
                    <Circle
                      cx="30" cy="30" r={radius}
                      stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none"
                    />
                    <Circle
                      cx="30" cy="30" r={radius}
                      stroke={ringColor}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform="rotate(-90 30 30)"
                    />
                  </Svg>
                  <View style={styles.timerTextContainer}>
                    <Text style={[styles.timerText, { color: ringColor }]}>
                      {timerLabel}
                    </Text>
                  </View>
                </View>

                {/* Accept */}
                <TouchableOpacity
                  style={[styles.acceptBtn, accepting && { opacity: 0.7 }]}
                  onPress={handleAccept}
                  activeOpacity={0.8}
                  disabled={accepting}
                >
                  <Text style={styles.btnText}>
                    {accepting ? 'Accepting…' : 'Accept'}
                  </Text>
                </TouchableOpacity>

                {/* Decline → opens cancel reason modal */}
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={handleDeclineTap}
                  activeOpacity={0.8}
                  disabled={accepting}
                >
                  <Text style={styles.btnText}>Decline</Text>
                </TouchableOpacity>

              </View>

              {/* Hint: order stays visible in Orders tab */}
              <Text style={styles.hintText}>
                ⏳ Order stays in the Pending tab if dismissed
              </Text>

            </View>
          </View>
        </View>
      </Modal>
      )}

      {/* Cancel Reason Modal — layered on top.
          onDismiss goes BACK to the main popup, not silently away. */}
      <CancelReasonModal
        visible={showCancelModal}
        onSubmit={handleCancelSubmit}
        onDismiss={handleCancelDismiss}
      />
    </>
  );
}

// ── Main Modal Styles ─────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    maxHeight: height * 0.9,
  },
  header: {
    backgroundColor: BRAND_GREEN,
    paddingTop: 28,
    paddingBottom: 44,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
  },
  dismissBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#FFF',
    fontSize: 15,
    opacity: 0.85,
  },
  card: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: -22,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  detailTextContainer: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: GREY_TEXT,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  earningValue: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND_GREEN,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  timerContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 12,
    fontWeight: '800',
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: BRAND_GREEN,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: RED_BTN,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: RED_BTN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hintText: {
    textAlign: 'center',
    fontSize: 12,
    color: GREY_TEXT,
    marginTop: 14,
  },
});

// ── Cancel Reason Modal Styles ────────────────────────────────
const cr = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.78,
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: GREY_TEXT,
    marginBottom: 16,
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
    gap: 12,
    backgroundColor: '#FAFAFA',
  },
  optionSelected: {
    borderColor: RED_BTN,
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
  radioSelected: {
    borderColor: RED_BTN,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RED_BTN,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: DARK_TEXT,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: RED_BTN,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: DARK_TEXT,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  submitBtn: {
    backgroundColor: RED_BTN,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: RED_BTN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
