import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props { children: ReactNode; fallbackTitle?: string; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary] Caught unhandled error:', error?.message, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <Text style={eb.icon}>⚠️</Text>
          <Text style={eb.title}>{this.props.fallbackTitle || 'Something went wrong'}</Text>
          <Text style={eb.sub}>An unexpected error occurred. Please retry or restart the app.</Text>
          {__DEV__ && this.state.error?.message ? (
            <Text style={eb.devMsg}>{this.state.error.message}</Text>
          ) : null}
          <TouchableOpacity style={eb.btn} onPress={this.handleRetry} activeOpacity={0.85}>
            <Text style={eb.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', padding: 32 },
  icon: { fontSize: 52, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  devMsg: { fontSize: 11, color: '#DC2626', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 16, width: '100%' },
  btn: { backgroundColor: '#1F933F', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
