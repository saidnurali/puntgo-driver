import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../constants/theme';
import { Order } from '../contexts/OrderContext';

const { width } = Dimensions.get('window');

interface OrderRequestModalProps {
  order: Order | null;
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function OrderRequestModal({ order, visible, onAccept, onDecline }: OrderRequestModalProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!order) return null;

  const fareDisplay = `$${order.total_price?.toFixed(2) ?? '0.00'}`;
  const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
  
  const restaurantName = order.restaurant_name || order.restaurant || 'Unknown Restaurant';
  const deliveryAddress = order.delivery_address || order.address || 'Unknown Address';

  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.pulseDot} />
            <Text style={styles.headerText}>New Order Request!</Text>
            <View style={styles.fareBadge}>
              <Text style={styles.fareText}>{fareDisplay}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Restaurant info */}
          <View style={styles.restaurantRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                🍽️
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.restaurantName} numberOfLines={1}>{restaurantName}</Text>
              <Text style={styles.itemsCount}>{itemsCount} {itemsCount === 1 ? 'item' : 'items'}</Text>
            </View>
            <View style={styles.idBadge}>
              <Text style={styles.idText}>
                {String(order.id).startsWith('#') ? order.id : `#PG${order.id}`}
              </Text>
            </View>
          </View>

          {/* Route */}
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>PICKUP FROM</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {restaurantName}
                </Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: Colors.danger }]} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>DELIVER TO</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {deliveryAddress}
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline} activeOpacity={0.8}>
              <Text style={styles.declineBtnText}>✕  Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.8}>
              <Text style={styles.acceptBtnText}>✓  Accept</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  headerText: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  fareBadge: {
    backgroundColor: `${Colors.gold}22`,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${Colors.gold}55`,
  },
  fareText: {
    color: Colors.gold,
    fontWeight: FontWeight.extrabold,
    fontSize: FontSize.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  avatarText: {
    fontSize: 20,
  },
  restaurantName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  itemsCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  idBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  idText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  routeCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.surfaceBorder,
    marginLeft: 5,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: `${Colors.danger}22`,
    borderWidth: 1.5,
    borderColor: `${Colors.danger}55`,
  },
  declineBtnText: {
    color: Colors.danger,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  acceptBtn: {
    flex: 1.6,
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  acceptBtnText: {
    color: Colors.textInverse,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
