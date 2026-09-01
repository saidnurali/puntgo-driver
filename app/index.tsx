import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

const BRAND_GREEN = '#2E7D32';
const BRAND_YELLOW = '#FFC107';
const WHITE = '#FFFFFF';

export default function SplashScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();

  // Fade-in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (loading) return;
    // Small delay so the splash is visible at least briefly
    const timer = setTimeout(() => {
      if (session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }, 1400);
    return () => clearTimeout(timer);
  }, [session, loading]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* ── PuntEats Logo ── */}
        <View style={styles.logoCircle}>
          {/* White bold "P" */}
          <Text style={styles.logoLetter}>P</Text>

          {/* Yellow spoon — positioned on the right of the P */}
          <View style={styles.spoonWrapper}>
            {/* spoon head (oval) */}
            <View style={styles.spoonHead} />
            {/* spoon handle */}
            <View style={styles.spoonHandle} />
          </View>
        </View>

        {/* ── Brand name ── */}
        <View style={styles.brandRow}>
          <Text style={styles.brandWhite}>Punt</Text>
          <Text style={styles.brandYellow}>Eats</Text>
        </View>

        {/* ── Sub-label ── */}
        <Text style={styles.driverLabel}>Driver</Text>
      </Animated.View>

      {/* ── Spinner at bottom ── */}
      <View style={styles.spinnerContainer}>
        <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    alignItems: 'center',
  },

  // ── Logo circle ──
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoLetter: {
    fontSize: 64,
    fontWeight: '800',
    color: WHITE,
    lineHeight: 70,
    letterSpacing: -2,
    marginLeft: -6,
  },

  // ── Yellow spoon ──
  spoonWrapper: {
    position: 'absolute',
    top: 22,
    right: 22,
    alignItems: 'center',
  },
  spoonHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BRAND_YELLOW,
  },
  spoonHandle: {
    width: 5,
    height: 22,
    borderRadius: 2.5,
    backgroundColor: BRAND_YELLOW,
    marginTop: 2,
  },

  // ── Text ──
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandWhite: {
    fontSize: 36,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.5,
  },
  brandYellow: {
    fontSize: 36,
    fontWeight: '800',
    color: BRAND_YELLOW,
    letterSpacing: -0.5,
  },
  driverLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  // ── Spinner ──
  spinnerContainer: {
    position: 'absolute',
    bottom: 70,
  },
});
