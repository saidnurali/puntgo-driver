import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

const BRAND_GREEN = '#1F933F';
const LIGHT_BG = '#F9FAFB';

export default function ForceUpdateScreen() {
  const handleUpdate = () => {
    // In production, use your actual app store links
    const link = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/idYOUR_APP_ID'
      : 'market://details?id=com.puntgo.punteatsdriver';
    
    Linking.openURL(link).catch(() => {
      // Fallback if market link fails
      Linking.openURL('https://play.google.com/store/apps/details?id=com.puntgo.punteatsdriver');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <AlertTriangle color="#F59E0B" size={48} />
        </View>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.description}>
          You are using an older version of the PuntGo Driver app. 
          Please update to the latest version to continue receiving orders and using the app securely.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleUpdate} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Update Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: BRAND_GREEN,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
