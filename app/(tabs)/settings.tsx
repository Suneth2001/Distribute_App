import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { 
    getCurrentUser, 
    getSecuritySettings, 
    logoutUser, 
    setSecuritySettings, 
    updatePassword, 
    getDatabaseStats, 
    exportDatabaseBackup, 
    restoreDatabaseBackup,
    deleteOldTransactions 
} from '../../src/store/database';
import { 
    getGoogleDriveSettings, 
    saveGoogleDriveSettings,
    GoogleDriveSettings
} from '../../src/services/googleDriveBackup';

export default function SettingsScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);
    const router = useRouter();

    const [user, setUser] = useState<any>(null);
    const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Security toggles
    const [biometricsEnabled, setBiometricsEnabled] = useState(false);
    const [pinEnabled, setPinEnabled] = useState(false);
    const [isPinModalVisible, setPinModalVisible] = useState(false);
    const [newPin, setNewPin] = useState('');

    // Google Drive 11:59 PM Auto-Backup & Account Config Modal
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
    const [gdriveSettings, setGdriveSettings] = useState<GoogleDriveSettings>({
        autoBackupEnabled: true,
        backupTime: '23:59',
        googleUserEmail: null,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        folderId: null,
        lastBackupDate: null,
        lastBackupTimestamp: null,
        lastBackupStatus: 'idle',
        lastBackupError: null,
    });
    const [isGDriveConfigModalVisible, setGDriveConfigModalVisible] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [folderInput, setFolderInput] = useState('');

    // Storage & Database stats
    const [stats, setStats] = useState({
        productsCount: 0,
        shopsCount: 0,
        transactionsCount: 0,
        expensesCount: 0,
    });
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);

    const loadData = async () => {
        try {
            const u = await getCurrentUser();
            setUser(u);
            const settings = await getSecuritySettings();
            setBiometricsEnabled(settings.biometricsEnabled);
            setPinEnabled(settings.pinEnabled);
            
            const dbStats = await getDatabaseStats();
            setStats(dbStats);

            const gd = await getGoogleDriveSettings();
            setGdriveSettings(gd);
            setAutoBackupEnabled(gd.autoBackupEnabled);
            setEmailInput(gd.googleUserEmail || '');
            setTokenInput(gd.accessToken || '');
            setFolderInput(gd.folderId || '');
        } catch (e) {
            console.warn('loadData settings error:', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleToggleAutoBackup = async (value: boolean) => {
        setAutoBackupEnabled(value);
        await saveGoogleDriveSettings({ autoBackupEnabled: value });
    };

    const handleSaveGoogleDriveConfig = async () => {
        const trimmedEmail = emailInput.trim();
        if (trimmedEmail && !trimmedEmail.includes('@')) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        try {
            const updated = await saveGoogleDriveSettings({
                googleUserEmail: trimmedEmail || null,
                accessToken: tokenInput.trim() || null,
                folderId: folderInput.trim() || null,
            });
            setGdriveSettings(updated);
            setGDriveConfigModalVisible(false);
            Alert.alert('Success', 'Google Drive account configuration saved successfully.');
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to save Google Drive configuration.');
        }
    };

    const handleBackupDatabase = async () => {
        if (isBackingUp) return;
        setIsBackingUp(true);
        try {
            await exportDatabaseBackup();
            Alert.alert('Backup Complete', 'Your POS database backup file has been created and is ready to share or save.');
        } catch (error: any) {
            Alert.alert('Backup Error', error?.message || 'Could not export database backup.');
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestoreDatabase = async () => {
        if (isRestoring) return;
        
        Alert.alert(
            'Restore Database',
            'Select a POS Backup JSON file (.json) to restore your products, shops, and bill history. Existing data will be updated with the backup file.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Choose File',
                    onPress: async () => {
                        try {
                            const pickerRes = await DocumentPicker.getDocumentAsync({
                                type: ['application/json', 'text/json', '*/*'],
                                copyToCacheDirectory: true,
                            });

                            if (pickerRes.canceled || !pickerRes.assets || pickerRes.assets.length === 0) {
                                return;
                            }

                            setIsRestoring(true);
                            const fileUri = pickerRes.assets[0].uri;
                            const fileContent = await FileSystem.readAsStringAsync(fileUri);

                            const res = await restoreDatabaseBackup(fileContent);
                            await loadData();

                            Alert.alert(
                                'Restore Successful',
                                `Database restored successfully!\n\n• Bills: ${res.restoredBills}\n• Products: ${res.restoredProducts}\n• Shops: ${res.restoredShops}\n• Expenses: ${res.restoredExpenses}`
                            );
                        } catch (error: any) {
                            Alert.alert('Restore Failed', error?.message || 'Invalid backup file or failed to restore.');
                        } finally {
                            setIsRestoring(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteOldHistory = async (days: number = 30) => {
        if (isCleaning) return;
        Alert.alert(
            'Clean Old Bill History',
            `Are you sure you want to delete sales bill history older than ${days} days? This will optimize performance and free up phone storage. Products, shops, and recent bills will stay safe.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clean Now',
                    style: 'destructive',
                    onPress: async () => {
                        setIsCleaning(true);
                        try {
                            const result = await deleteOldTransactions(days);
                            Alert.alert('Success', `Cleaned ${result.deletedCount} old bills. ${result.keptCount} recent bills are preserved.`);
                            await loadData();
                        } catch (error: any) {
                            Alert.alert('Error', error?.message || 'Failed to clean old history.');
                        } finally {
                            setIsCleaning(false);
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await logoutUser();
                    router.replace('/login');
                }
            }
        ]);
    };

    const toggleBiometrics = async (value: boolean) => {
        setBiometricsEnabled(value);
        const settings = await getSecuritySettings();
        await setSecuritySettings({ ...settings, biometricsEnabled: value });
    };

    const togglePin = async (value: boolean) => {
        if (value) {
            setPinModalVisible(true);
        } else {
            setPinEnabled(false);
            const settings = await getSecuritySettings();
            await setSecuritySettings({ ...settings, pinEnabled: false, pin: '' });
        }
    };

    const handleSavePin = async () => {
        if (newPin.length !== 4) {
            Alert.alert('Error', 'PIN must be exactly 4 digits');
            return;
        }
        setPinEnabled(true);
        const settings = await getSecuritySettings();
        await setSecuritySettings({ ...settings, pinEnabled: true, pin: newPin });
        setPinModalVisible(false);
        setNewPin('');
        Alert.alert('Success', 'PIN Login enabled');
    };

    const handleChangePassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        if (newPassword.length < 4) {
            Alert.alert('Error', 'Password must be at least 4 characters');
            return;
        }

        try {
            await updatePassword(newPassword);
            Alert.alert('Success', 'Password updated successfully');
            setPasswordModalVisible(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            Alert.alert('Error', 'Failed to update password');
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.profileSection}>
                <View style={styles.avatarContainer}>
                    <Ionicons name="person" size={50} color="#FFF" />
                </View>
                <Text style={styles.userName}>{user?.username || 'Admin'}</Text>
                <Text style={styles.role}>System Administrator</Text>
            </View>

            {/* Account & Security */}
            <View style={styles.settingsGroup}>
                <Text style={styles.groupTitle}>ACCOUNT SECURITY</Text>

                <TouchableOpacity style={styles.settingItem} onPress={() => setPasswordModalVisible(true)}>
                    <View style={[styles.settingIcon, { backgroundColor: '#3B82F620' }]}>
                        <Ionicons name="key-outline" size={22} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingText}>Change Password</Text>
                        <Text style={styles.settingSubtext}>Update your login credentials</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
                </TouchableOpacity>

                <View style={styles.settingItem}>
                    <View style={[styles.settingIcon, { backgroundColor: '#10B98120' }]}>
                        <Ionicons name="finger-print-outline" size={22} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingText}>Biometric Login</Text>
                        <Text style={styles.settingSubtext}>Face ID or Fingerprint</Text>
                    </View>
                    <Switch
                        value={biometricsEnabled}
                        onValueChange={toggleBiometrics}
                        trackColor={{ false: '#767577', true: '#10B981' }}
                    />
                </View>

                <View style={styles.settingItem}>
                    <View style={[styles.settingIcon, { backgroundColor: '#F59E0B20' }]}>
                        <Ionicons name="apps-outline" size={22} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingText}>PIN Login</Text>
                        <Text style={styles.settingSubtext}>4-digit secure access</Text>
                    </View>
                    <Switch
                        value={pinEnabled}
                        onValueChange={togglePin}
                        trackColor={{ false: '#767577', true: '#F59E0B' }}
                    />
                </View>

                <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/expenses')}>
                    <View style={[styles.settingIcon, { backgroundColor: '#8B5CF620' }]}>
                        <Ionicons name="receipt-outline" size={22} color="#8B5CF6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingText}>Manage Expenses</Text>
                        <Text style={styles.settingSubtext}>Track today, last week, and monthly costs</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
                    <View style={[styles.settingIcon, { backgroundColor: '#EF444420' }]}>
                        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.settingText, { color: '#EF4444' }]}>Logout</Text>
                        <Text style={styles.settingSubtext}>End your current session</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Database & Storage Management */}
            <View style={styles.settingsGroup}>
                <Text style={styles.groupTitle}>DATABASE & STORAGE MANAGEMENT</Text>

                {/* Storage Health Cards */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{stats.transactionsCount}</Text>
                        <Text style={styles.statLabel}>Sales Bills</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{stats.productsCount}</Text>
                        <Text style={styles.statLabel}>Products</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{stats.shopsCount}</Text>
                        <Text style={styles.statLabel}>Shops</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{stats.expensesCount}</Text>
                        <Text style={styles.statLabel}>Expenses</Text>
                    </View>
                </View>

                {/* Google Drive 11:59 PM Auto-Backup & Account Modal trigger */}
                <TouchableOpacity 
                    style={styles.settingItem} 
                    onPress={() => setGDriveConfigModalVisible(true)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.settingIcon, { backgroundColor: '#10B98120' }]}>
                        <Ionicons name="logo-google" size={22} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingText}>Google Drive Auto-Backup</Text>
                        <Text style={styles.settingSubtext}>
                            {gdriveSettings.googleUserEmail ? `${gdriveSettings.googleUserEmail} • 11:59 PM` : 'Configure Account • 11:59 PM Everyday'}
                        </Text>
                    </View>
                    <Switch
                        value={autoBackupEnabled}
                        onValueChange={handleToggleAutoBackup}
                        trackColor={{ false: '#767577', true: '#10B981' }}
                    />
                </TouchableOpacity>

                {/* Backup Database File */}
                <TouchableOpacity 
                    style={styles.settingItem} 
                    onPress={handleBackupDatabase}
                    disabled={isBackingUp}
                >
                    <View style={[styles.settingIcon, { backgroundColor: '#0EA5E920' }]}>
                        {isBackingUp ? (
                            <ActivityIndicator size="small" color="#0EA5E9" />
                        ) : (
                            <Ionicons name="cloud-download-outline" size={22} color="#0EA5E9" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingText}>Backup Database File</Text>
                        <Text style={styles.settingSubtext}>Export all bills, shops & products to file</Text>
                    </View>
                    <Ionicons name="share-outline" size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
                </TouchableOpacity>

                {/* Restore Database */}
                <TouchableOpacity 
                    style={styles.settingItem} 
                    onPress={handleRestoreDatabase}
                    disabled={isRestoring}
                >
                    <View style={[styles.settingIcon, { backgroundColor: '#8B5CF620' }]}>
                        {isRestoring ? (
                            <ActivityIndicator size="small" color="#8B5CF6" />
                        ) : (
                            <Ionicons name="cloud-upload-outline" size={22} color="#8B5CF6" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingText}>Restore Database</Text>
                        <Text style={styles.settingSubtext}>Import backup JSON file to restore data</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
                </TouchableOpacity>

                {/* Clean Old History */}
                <TouchableOpacity 
                    style={styles.settingItem} 
                    onPress={() => handleDeleteOldHistory(30)}
                    disabled={isCleaning}
                >
                    <View style={[styles.settingIcon, { backgroundColor: '#F9731620' }]}>
                        {isCleaning ? (
                            <ActivityIndicator size="small" color="#F97316" />
                        ) : (
                            <Ionicons name="trash-bin-outline" size={22} color="#F97316" />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingText}>Clean Old History (&gt; 30 Days)</Text>
                        <Text style={styles.settingSubtext}>Speed up app by archiving bills older than 1 month</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#4B5563' : '#D1D5DB'} />
                </TouchableOpacity>
            </View>

            {/* App Information */}
            <View style={styles.settingsGroup}>
                <Text style={styles.groupTitle}>APP INFORMATION</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>App Version</Text>
                    <Text style={styles.infoValue}>v1.2.0 (High Performance Engine)</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Auto-Save</Text>
                    <Text style={styles.infoValue}>Everyday at 11:59 PM</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Storage Architecture</Text>
                    <Text style={styles.infoValue}>Partitioned Local Storage</Text>
                </View>
            </View>

            {/* Developer Credits Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>Design and Develop by</Text>
                <Text style={styles.devName}>ZIPZIPY (PVT) LTD</Text>
                <View style={styles.contactRow}>
                    <Ionicons name="call" size={14} color="#3B82F6" />
                    <Text style={styles.contactText}>076 65 95 714</Text>
                </View>
                <Text style={styles.copyText}>© 2026 All Rights Reserved</Text>
            </View>

            {/* Google Drive Account Configuration Modal */}
            <Modal visible={isGDriveConfigModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Google Drive Configuration</Text>
                            <TouchableOpacity onPress={() => setGDriveConfigModalVisible(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#F9FAFB' : '#1F2937'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Google Drive Email Address *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="yourname@gmail.com"
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                value={emailInput}
                                onChangeText={setEmailInput}
                            />

                            <Text style={styles.inputLabel}>Google OAuth Token / API Key (Optional)</Text>
                            <TextInput
                                style={[styles.input, { minHeight: 60 }]}
                                placeholder="Paste token for direct Drive upload (optional)"
                                placeholderTextColor="#9CA3AF"
                                multiline
                                value={tokenInput}
                                onChangeText={setTokenInput}
                            />

                            <Text style={styles.inputLabel}>Drive Folder ID (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 1a2b3c4d5e6f (optional)"
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="none"
                                value={folderInput}
                                onChangeText={setFolderInput}
                            />

                            <View style={styles.gdriveNoticeBox}>
                                <Ionicons name="time" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
                                <Text style={styles.gdriveNoticeText}>
                                    The app will automatically save your entire database backup every day at 11:59 PM.
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGoogleDriveConfig}>
                                <Text style={styles.saveBtnText}>Save Configuration</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Password Modal */}
            <Modal visible={isPasswordModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Password</Text>
                            <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#F9FAFB' : '#1F2937'} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.inputLabel}>New Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter characters..."
                                placeholderTextColor="#9CA3AF"
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                            />
                            <Text style={styles.inputLabel}>Confirm New Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Repeat password..."
                                placeholderTextColor="#9CA3AF"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                            <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}>
                                <Text style={styles.saveBtnText}>Update Password</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* PIN Modal */}
            <Modal visible={isPinModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: 400 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Set 4-Digit PIN</Text>
                            <TouchableOpacity onPress={() => { setPinModalVisible(false); setPinEnabled(false); }}>
                                <Ionicons name="close" size={24} color={isDark ? '#F9FAFB' : '#1F2937'} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.inputLabel}>New PIN</Text>
                            <TextInput
                                style={[styles.input, { textAlign: 'center', letterSpacing: 10, fontSize: 24 }]}
                                placeholder="0000"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="numeric"
                                maxLength={4}
                                secureTextEntry
                                value={newPin}
                                onChangeText={setNewPin}
                            />
                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#F59E0B' }]} onPress={handleSavePin}>
                                <Text style={styles.saveBtnText}>Enable PIN Access</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#111827' : '#F9FAFB' },

    profileSection: {
        alignItems: 'center',
        paddingVertical: 50,
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
    },
    avatarContainer: {
        width: 100, height: 100, borderRadius: 50, backgroundColor: '#3B82F6',
        justifyContent: 'center', alignItems: 'center', marginBottom: 15,
        elevation: 8, shadowColor: '#3B82F6', shadowOpacity: 0.3, shadowRadius: 10
    },
    userName: { fontSize: 24, fontWeight: '900', color: isDark ? '#F9FAFB' : '#111827' },
    role: { fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 4, fontWeight: '600' },

    settingsGroup: { marginTop: 24, paddingHorizontal: 20 },
    groupTitle: { fontSize: 13, fontWeight: '800', color: isDark ? '#6B7280' : '#9CA3AF', marginBottom: 12, letterSpacing: 1 },

    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 8
    },
    statCard: {
        flex: 1,
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#F3F4F6',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3B82F6'
    },
    statLabel: {
        fontSize: 11,
        color: isDark ? '#9CA3AF' : '#6B7280',
        marginTop: 2,
        fontWeight: '600'
    },

    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1, borderColor: isDark ? '#374151' : '#F3F4F6',
        shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 2
    },
    settingIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    settingText: { fontSize: 16, fontWeight: '700', color: isDark ? '#F9FAFB' : '#111827' },
    settingSubtext: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 },

    gdriveNoticeBox: {
        flexDirection: 'row',
        backgroundColor: '#3B82F615',
        padding: 12,
        borderRadius: 12,
        marginTop: 12,
        alignItems: 'center',
    },
    gdriveNoticeText: {
        flex: 1,
        fontSize: 13,
        color: isDark ? '#93C5FD' : '#1D4ED8',
        lineHeight: 18,
    },

    infoRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        padding: 16, borderRadius: 15, marginBottom: 10,
        borderWidth: 1, borderColor: isDark ? '#374151' : '#F3F4F6'
    },
    infoLabel: { fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: '600' },
    infoValue: { fontSize: 14, color: isDark ? '#F9FAFB' : '#111827', fontWeight: 'bold' },

    // Footer
    footer: { alignItems: 'center', marginTop: 30, marginBottom: 80, padding: 20 },
    footerText: { fontSize: 12, color: isDark ? '#4B5563' : '#9CA3AF', fontWeight: '600' },
    devName: { fontSize: 16, fontWeight: '900', color: '#3B82F6', marginTop: 4 },
    contactRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    contactText: { fontSize: 14, fontWeight: 'bold', color: isDark ? '#9CA3AF' : '#6B7280', marginLeft: 6 },
    copyText: { fontSize: 10, color: isDark ? '#374151' : '#D1D5DB', marginTop: 15 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: 25, paddingBottom: 50
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    modalBody: { paddingBottom: 20 },
    inputLabel: { fontSize: 14, fontWeight: 'bold', color: isDark ? '#9CA3AF' : '#4B5563', marginBottom: 8, marginTop: 15 },
    input: {
        backgroundColor: isDark ? '#111827' : '#F9FAFB',
        padding: 16, borderRadius: 15, borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        color: isDark ? '#F9FAFB' : '#111827', fontSize: 16
    },
    saveBtn: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 15, marginTop: 30, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
