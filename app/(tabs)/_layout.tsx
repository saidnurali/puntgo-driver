import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Home, ClipboardList, DollarSign, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND_GREEN = '#1F933F';
const TAB_INACTIVE = '#9CA3AF';
const BG_WHITE = '#FFFFFF';

function TabIcon({ Icon, focused }: { Icon: any; focused: boolean }) {
  return (
    <View style={styles.iconWrapper}>
      <Icon
        size={24}
        color={focused ? BRAND_GREEN : TAB_INACTIVE}
        strokeWidth={focused ? 2.5 : 2}
      />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 8,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: 60 + Math.max(insets.bottom, 12),
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 8,
        },
        tabBarActiveTintColor: BRAND_GREEN,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <View style={styles.tabBarBg} />,
      }}
    >
      {/* ── Visible 4 tabs ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="active-order"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => <TabIcon Icon={ClipboardList} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ focused }) => <TabIcon Icon={DollarSign} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
        }}
      />

      {/* ── Hidden screens (no tab button) ── */}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: BG_WHITE,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 6,
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: BG_WHITE,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
