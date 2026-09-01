import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../contexts/AuthContext';
import { Phone, Eye, EyeOff } from 'lucide-react-native';

const BRAND_GREEN = '#1F933F';
const LIGHT_BG = '#F9FAFB';
const WHITE = '#FFFFFF';
const DARK_TEXT = '#1A1A1A';
const GREY_TEXT = '#757575';
const BORDER_COLOR = '#E5E7EB';
const ERROR_COLOR = '#D32F2F';

const ADMIN_SUPPORT_PHONE = '+252904678886'; // Set your admin support phone number

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setErrorMsg('');
    if (!phone.trim()) {
      setErrorMsg('Please enter your phone number.');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Please enter your password.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(phone, password);
    setLoading(false);
    if (error) {
      setErrorMsg('Phone or PIN Code is incorrect.');
    } else {
      // Navigating to the tabs layout which contains the orders dashboard
      router.replace('/(tabs)');
    }
  };

  const handleContactAdmin = async () => {
    const whatsappUrl = `whatsapp://send?phone=${ADMIN_SUPPORT_PHONE}&text=Koomo: Waxaan ahay Driver, waxaan u baahanahay caawinaad akaunka!`;
    
    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to phone dialer if WhatsApp is not installed
        await Linking.openURL(`tel:${ADMIN_SUPPORT_PHONE}`);
      }
    } catch (error) {
      Alert.alert('Contact Admin', `Fadlan si toos ah u wac Admin-ka: ${ADMIN_SUPPORT_PHONE}`);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password?',
      'Please contact the administrator to reset your password or PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Contact Admin', onPress: handleContactAdmin }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/app_logo.png')}
              style={{
                width: 120,
                height: 120,
                resizeMode: 'contain',
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Login to your driver account</Text>
          </View>

          {/* Error message */}
          {!!errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* ── Form ── */}
          <View style={styles.form}>
            {/* Phone Number Field */}
            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>Phone Number</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Phone size={20} color={DARK_TEXT} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+252 61 2345678"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={(t) => { setPhone(t); setErrorMsg(''); }}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.labelText}>PIN Code / Password</Text>
              </View>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={DARK_TEXT} />
                  ) : (
                    <Eye size={20} color={DARK_TEXT} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={WHITE} size="small" />
              ) : (
                <Text style={styles.loginBtnText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={handleContactAdmin}>
              <Text style={styles.footerLink}>Contact admin</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 40,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: GREY_TEXT,
  },

  // ── Error ──
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    color: ERROR_COLOR,
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Form ──
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 24,
    position: 'relative',
  },
  labelContainer: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: LIGHT_BG,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  labelText: {
    fontSize: 13,
    color: GREY_TEXT,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: DARK_TEXT,
    height: '100%',
  },
  eyeButton: {
    padding: 4,
  },

  // ── Forgot Password ──
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Button ──
  loginBtn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: WHITE,
  },

  // ── Footer ──
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: GREY_TEXT,
    marginBottom: 8,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_GREEN,
  },
});
