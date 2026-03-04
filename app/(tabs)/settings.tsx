import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logoutUser } from '../../src/store/database';

export default function SettingsScreen() {
    const router = useRouter();

    const handleLogout = async () => {
        await logoutUser();
        router.replace('/login');
    };

    return (
        <View style={styles.container}>
            <View style={styles.profileSection}>
                <Ionicons name="person-circle" size={80} color="#9CA3AF" />
                <Text style={styles.userName}>Distributor Admin</Text>
                <Text style={styles.role}>Logged in Account</Text>
            </View>

            <View style={styles.settingsGroup}>
                <Text style={styles.groupTitle}>ACCOUNT</Text>

                <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
                    <View style={styles.settingIcon}>
                        <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                    </View>
                    <Text style={[styles.settingText, { color: '#EF4444', fontWeight: 'bold' }]}>Logout</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.settingsGroup}>
                <Text style={styles.groupTitle}>ABOUT APP</Text>
                <View style={styles.settingItemInfo}>
                    <Text style={styles.settingText}>Version</Text>
                    <Text style={styles.settingValue}>1.0.0</Text>
                </View>
                <View style={styles.settingItemInfo}>
                    <Text style={styles.settingText}>Printer Integration</Text>
                    <Text style={styles.settingValue}>Expo Print HTML API</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 40,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderColor: '#E5E7EB'
    },
    userName: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginTop: 12 },
    role: { fontSize: 14, color: '#6B7280', marginTop: 4 },
    settingsGroup: { marginTop: 24, paddingHorizontal: 16 },
    groupTitle: { fontSize: 13, fontWeight: 'bold', color: '#6B7280', marginBottom: 8, marginLeft: 8 },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8
    },
    settingIcon: { marginRight: 12 },
    settingText: { fontSize: 16, color: '#1F2937' },
    settingItemInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8
    },
    settingValue: { fontSize: 16, color: '#6B7280' }
});
