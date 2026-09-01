/**
 * components/ErrorBoundary.tsx
 * ─────────────────────────────────────────────────────────────────
 * React class ErrorBoundary — the last line of defence against
 * unhandled render/lifecycle errors crashing the native process.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeScreen />
 *   </ErrorBoundary>
 *
 *   Or with a custom fallback:
 *   <ErrorBoundary fallbackTitle="Orders failed to load">
 *     <OrdersScreen />
 *   </ErrorBoundary>
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────

interface Props {
  children: ReactNode;
  /** Optional custom title shown on the fallback screen */
  fallbackTitle?: string;
  /** Optional custom message shown on the fallback screen */
  fallbackMessage?: string;
  /** Called when the user taps "Try Again" — if omitted, resets the boundary */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
}

// ─── ErrorBoundary ────────────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      errorStack: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message ?? 'An unexpected error occurred.',
      errorStack: error?.stack ?? '',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.critical('[ErrorBoundary] Unhandled render error caught:', error);
    logger.critical('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    // Always reset the boundary so the tree re-mounts
    this.setState({ hasError: false, errorMessage: '', errorStack: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.props.fallbackTitle ?? 'Something went wrong';
    const message =
      this.props.fallbackMessage ??
      'The app ran into an unexpected error. Tap "Try Again" to recover.';

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View style={styles.iconWrapper}>
            <Text style={styles.icon}>⚠️</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Error detail (dev only) */}
          {__DEV__ && !!this.state.errorMessage && (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>DEV ERROR DETAIL</Text>
              <Text style={styles.devText}>{this.state.errorMessage}</Text>
            </View>
          )}

          {/* Try Again */}
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={this.handleReset}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>🔄 Try Again</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

// ─── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  devBox: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    width: '100%',
  },
  devLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 1,
    marginBottom: 6,
  },
  devText: {
    fontSize: 12,
    color: '#D1FAE5',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: '#1F933F',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    shadowColor: '#1F933F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
