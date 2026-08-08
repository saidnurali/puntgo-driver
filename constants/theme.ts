export const Colors = {
  // Brand
  primary: '#00BFA5',
  primaryDark: '#008E76',
  primaryLight: '#4DFFD8',

  // Backgrounds
  background: '#0A0E1A',
  surface: '#111827',
  surfaceElevated: '#1C2333',
  surfaceBorder: '#2A3444',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#4B5563',
  textInverse: '#0A0E1A',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerDark: '#B91C1C',
  info: '#3B82F6',

  // Accent
  gold: '#FFD700',
  goldDark: '#B8860B',

  // Online / Offline
  online: '#10B981',
  offline: '#6B7280',

  // Tab bar
  tabActive: '#00BFA5',
  tabInactive: '#4B5563',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#00BFA5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
} as const;
