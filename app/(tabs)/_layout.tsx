import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
    const isDark = useColorScheme() === 'dark';

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
            tabBarStyle: {
                backgroundColor: isDark ? '#1F2937' : '#FFF',
                elevation: 8,
                shadowColor: '#000',
                borderTopColor: isDark ? '#374151' : '#E5E7EB',
                borderTopWidth: 1,
                height: 75,
                paddingBottom: 20,
                paddingTop: 10
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
