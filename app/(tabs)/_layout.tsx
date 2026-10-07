import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const isDark = useColorScheme() === 'dark';
    const insets = useSafeAreaInsets();

    // Ensure the tab bar is never covered by the Android system navigation bar (3-button or pill)
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 8);
    const tabBarHeight = 58 + bottomPadding;

    return (
        <Tabs screenOptions={{
            headerShown: true,
            headerStyle: {
                backgroundColor: isDark ? '#1F2937' : '#FFF',
                borderBottomColor: isDark ? '#374151' : '#E5E7EB',
                borderBottomWidth: 1,
            },
            headerTintColor: isDark ? '#F9FAFB' : '#111827',
            tabBarActiveTintColor: isDark ? '#60A5FA' : '#3B82F6',
            tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#6B7280',
            tabBarItemStyle: {
                paddingVertical: 4,
            },
            tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
            },
            tabBarStyle: {
                backgroundColor: isDark ? '#1F2937' : '#FFF',
                elevation: 8,
                shadowColor: '#000',
                borderTopColor: isDark ? '#374151' : '#E5E7EB',
                borderTopWidth: 1,
                height: tabBarHeight,
                paddingBottom: bottomPadding,
                paddingTop: 6,
            }
        }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="products"
                options={{
                    title: 'Products',
                    tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="shops"
                options={{
                    title: 'Shops',
                    tabBarIcon: ({ color }) => <Ionicons name="storefront-outline" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: 'History',
                    tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="summary"
                options={{
                    title: 'Summary',
                    tabBarIcon: ({ color }) => <Ionicons name="pie-chart-outline" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="expenses"
                options={{
                    title: 'Expenses',
                    href: null,
                    tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />
                }}
            />
        </Tabs>
    );
}
