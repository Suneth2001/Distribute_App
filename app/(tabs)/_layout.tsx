import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
    return (
        <Tabs screenOptions={{
            headerShown: true,
            tabBarActiveTintColor: '#3B82F6',
            tabBarStyle: {
                elevation: 8,
                shadowColor: '#000',
                borderTopWidth: 0,
                height: 60,
                paddingBottom: 8,
                paddingTop: 8
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
