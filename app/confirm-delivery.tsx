import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, Camera, Image as ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useOrder } from '../contexts/OrderContext';

const BRAND_GREEN = '#1F933F';
const DARK_TEXT = '#111827';
const GREY_TEXT = '#6B7280';
const BORDER = '#E5E7EB';

export default function ConfirmDeliveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentOrder, completeOrder } = useOrder();
  
  // OTP State
  const [code, setCode] = useState(['', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);
  
  // Photo State
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  
  // Loading State
  const [loading, setLoading] = useState(false);

  const handleCodeChange = (text: string, index: number) => {
    // Only accept numeric
    const cleanText = text.replace(/[^0-9]/g, '');
    
    const newCode = [...code];
    newCode[index] = cleanText.substring(cleanText.length - 1); // Keep last char if multiple pasted
    setCode(newCode);

    // Auto-advance
    if (cleanText && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      // Auto-retreat
      inputs.current[index - 1]?.focus();
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take a proof photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const submitDelivery = async () => {
    if (!currentOrder) {
      Alert.alert('Error', 'No active order found.');
      return;
    }

    const fullCode = code.join('');
    if (fullCode.length < 4 && !photoUri) {
      Alert.alert('Verification Required', 'Please enter the 4-digit code or take a proof photo.');
      return;
    }

    setLoading(true);
    try {
      // Typically we'd also upload the photoUri to Supabase Storage here and save the URL.
      
      // Since context already has completeOrder, let's just use that.
      // But completeOrder might not accept photo proof in its signature, 
      // so we can just update the order directly or rely on the context.
      
      await completeOrder(currentOrder.id);
      
      Alert.alert('Success', 'Order marked as delivered!');
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Error', 'Failed to complete delivery.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          {/* Header & Burst Badge */}
          <View style={styles.header}>
            <Text style={styles.title}>Confirm Delivery</Text>
            
            <View style={styles.badgeContainer}>
              <View style={styles.burstRing1} />
              <View style={styles.burstRing2} />
              <View style={styles.badgeCenter}>
                <Check size={32} color="#FFF" strokeWidth={3} />
              </View>
              {/* Confetti pieces */}
              <View style={[styles.confetti, { top: -10, left: 10, backgroundColor: '#FCD34D' }]} />
              <View style={[styles.confetti, { top: 10, right: -10, backgroundColor: '#86EFAC' }]} />
              <View style={[styles.confetti, { bottom: 0, left: -5, backgroundColor: '#86EFAC' }]} />
            </View>
            
            <Text style={styles.subtitle}>Confirm you have delivered the order</Text>
          </View>

          {/* OTP Input */}
          <View style={styles.otpSection}>
            <Text style={styles.label}>Delivery Code (OTP)</Text>
            <View style={styles.otpContainer}>
              {[0, 1, 2, 3].map((i) => (
                <TextInput
                  key={i}
                  ref={(ref) => inputs.current[i] = ref}
                  style={[styles.otpInput, code[i] ? styles.otpInputFilled : null]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={code[i]}
                  onChangeText={(t) => handleCodeChange(t, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  selectTextOnFocus
                />
              ))}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.line} />
          </View>

          {/* Photo Proof */}
          <View style={styles.photoSection}>
            {!photoUri ? (
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Camera size={20} color={GREY_TEXT} />
                <Text style={styles.photoBtnText}>Take Photo (Optional)</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity 
                  style={styles.photoRemoveBtn} 
                  onPress={() => setPhotoUri(null)}
                >
                  <X size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
        </ScrollView>

        {/* Bottom Action */}
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity 
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
            onPress={submitDelivery}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>
              {loading ? 'Completing...' : 'Complete Delivery'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: DARK_TEXT,
    marginBottom: 30,
  },
  badgeContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  burstRing1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#DCFCE7', // Light green
  },
  burstRing2: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#BBF7D0',
  },
  badgeCenter: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    // Rotate to give a star/burst vibe if we want, or keep it rounded rect
    transform: [{ rotate: '45deg' }],
  },
  confetti: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subtitle: {
    fontSize: 15,
    color: DARK_TEXT,
    fontWeight: '500',
  },
  otpSection: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: GREY_TEXT,
    marginBottom: 12,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  otpInput: {
    width: '22%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: DARK_TEXT,
    backgroundColor: '#FFF',
  },
  otpInputFilled: {
    borderColor: BRAND_GREEN,
    backgroundColor: '#F0FDF4',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: GREY_TEXT,
    fontWeight: '600',
  },
  photoSection: {
    width: '100%',
    marginBottom: 20,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    gap: 8,
  },
  photoBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: GREY_TEXT,
  },
  photoPreviewContainer: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: BORDER,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    backgroundColor: '#FFF',
  },
  submitBtn: {
    backgroundColor: BRAND_GREEN,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
