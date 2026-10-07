import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { getCurrentUser, getSecuritySettings, loginUser } from '../src/store/database';

export default function LoginScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { quickAccess } = useLocalSearchParams();
    const [security, setSecurity] = useState<any>(null);
    const [showPinInput, setShowPinInput] = useState(false);
    const [pinCode, setPinCode] = useState('');

    const loadSecurity = async () => {
        const settings = await getSecuritySettings();
        setSecurity(settings);

        // If user is returning (quickAccess from index.tsx)
        if (quickAccess === 'true') {
            if (settings.biometricsEnabled) {
                // Wait a tiny bit for the screen to settle
                setTimeout(() => handleBiometricLogin(), 500);
            } else if (settings.pinEnabled) {
                setShowPinInput(true);
            } else {
                // If logged in but no extra security, just go home
                router.replace('/(tabs)');
            }
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadSecurity();
            return () => {
                setPinCode('');
                setShowPinInput(false);
            };
        }, [quickAccess])
    );

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert('Access Denied', 'Please enter your Admin credentials.');
            return;
        }

        setIsLoading(true);
        try {
            await loginUser(username, password);
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Access Error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBiometricLogin = async () => {
        try {
            if (!LocalAuthentication?.hasHardwareAsync) {
                Alert.alert('Configuration Error', 'Biometric module is still initializing or missing.');
                return;
            }
            const compatible = await LocalAuthentication.hasHardwareAsync();
            if (!compatible) {
                Alert.alert('Hardware Error', 'This device does not support biometric auth.');
                return;
            }

            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (!enrolled) {
                Alert.alert('Setup Required', 'Please enable Face ID / Fingerprint in your phone settings.');
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Authenticate to access Admin Dashboard',
                fallbackLabel: 'Use PIN instead',
            });

            if (result.success) {
                await loginUser('Admin', 'admin123');
                router.replace('/(tabs)');
            }
        } catch (error) {
            Alert.alert('Auth Error', 'Biometric authentication failed.');
        }
    };

    const handlePinSubmit = async () => {
        if (pinCode === security?.pin) {
            await loginUser('Admin', 'admin123');
            router.replace('/(tabs)');
        } else {
            Alert.alert('Invalid PIN', 'The PIN you entered is incorrect.');
            setPinCode('');
        }
    };

    if (showPinInput) {
        return (
            <View style={styles.container}>
                <View style={styles.pinHeader}>
                    <Ionicons name="lock-closed" size={50} color="#3B82F6" />
                    <Text style={styles.pinTitle}>Enter Security PIN</Text>
                    <Text style={styles.pinSubtitle}>Access Restricted to Administrator</Text>
                </View>

                <View style={styles.pinGrid}>
                    <TextInput
                        style={styles.pinDisplay}
                        value={pinCode}
                        secureTextEntry
                        maxLength={4}
                        editable={false}
                        placeholder="----"
                        placeholderTextColor="#9CA3AF"
                    />

                    {/* Simplified PIN Pad logic for the UI */}
                    <View style={styles.numPad}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <TouchableOpacity key={num} style={styles.numBtn} onPress={() => pinCode.length < 4 && setPinCode((prev: string) => prev + String(num))}>
                                <Text style={styles.numTxt}>{num}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.numBtn} onPress={() => setPinCode('')}>
                            <Ionicons name="refresh-outline" size={24} color={isDark ? '#F9FAFB' : '#1F2937'} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.numBtn} onPress={() => pinCode.length < 4 && setPinCode((prev: string) => prev + '0')}>
                            <Text style={styles.numTxt}>0</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.numBtn, { backgroundColor: '#3B82F6' }]} onPress={handlePinSubmit}>
                            <Ionicons name="checkmark" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity onPress={() => setShowPinInput(false)} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>Use Admin Credentials</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.logoSection}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="shield-checkmark" size={60} color="#FFF" />
                    </View>
                    <Text style={styles.appName}>Dilki Distributors</Text>

                </View>

                <View style={styles.loginCard}>
                    <Text style={styles.welcomeText}>Welcome back, Admin</Text>
                    <Text style={styles.subtext}>Only authorized personnel can access this terminal.</Text>

                    <View style={styles.inputGroup}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color="#3B82F6" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Admin Name"
                                placeholderTextColor="#9CA3AF"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#3B82F6" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Admin Password"
                                placeholderTextColor="#9CA3AF"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                        <Text style={styles.loginBtnText}>Secure Access Log In</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    </TouchableOpacity>

                    {/* Biometric & PIN Row */}
                    {(security?.biometricsEnabled || security?.pinEnabled) && (
                        <View style={styles.divider}>
                            <View style={styles.line} />
                            <Text style={styles.dividerText}>OR QUICK ACCESS</Text>
                            <View style={styles.line} />
                        </View>
                    )}

                    <View style={styles.quickAccessRow}>
                        {security?.biometricsEnabled && (
                            <TouchableOpacity style={styles.quickBtn} onPress={handleBiometricLogin}>
                                <Ionicons name="finger-print" size={30} color="#3B82F6" />
                                <Text style={styles.quickBtnText}>Face ID / Touch</Text>
                            </TouchableOpacity>
                        )}
                        {security?.pinEnabled && (
                            <TouchableOpacity style={styles.quickBtn} onPress={() => setShowPinInput(true)}>
                                <Ionicons name="grid-outline" size={30} color="#10B981" />
                                <Text style={styles.quickBtnText}>Security PIN</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerNote}>Restricted Application Territory</Text>
                    <Text style={styles.footerWarning}>UNAUTHORIZED ACCESS IS PROHIBITED</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC', padding: 24, justifyContent: 'center' },

    logoSection: { alignItems: 'center', marginBottom: 40 },
    logoCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', elevation: 15, shadowColor: '#3B82F6', shadowOpacity: 0.5, shadowRadius: 20 },
    appName: { fontSize: 24, fontWeight: '900', color: isDark ? '#F8FAFC' : '#0F172A', marginTop: 20, letterSpacing: 2 },
    appDev: { fontSize: 14, color: '#3B82F6', fontWeight: 'bold', marginTop: 5 },

    loginCard: { backgroundColor: isDark ? '#1E293B' : '#FFF', padding: 30, borderRadius: 30, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    welcomeText: { fontSize: 22, fontWeight: 'bold', color: isDark ? '#F8FAFC' : '#0F172A', textAlign: 'center' },
    subtext: { fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 20 },

    inputGroup: { marginTop: 30 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#0F172A' : '#F1F5F9', borderRadius: 15, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: isDark ? '#334155' : '#E2E8F0' },
    inputIcon: { marginRight: 15 },
    input: { flex: 1, height: 55, color: isDark ? '#F8FAFC' : '#0F172A', fontSize: 16, fontWeight: '600' },

    loginBtn: { backgroundColor: '#3B82F6', height: 60, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15, elevation: 5, shadowColor: '#3B82F6', shadowOpacity: 0.3, shadowRadius: 10 },
    loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginRight: 10 },

    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
    line: { flex: 1, height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0' },
    dividerText: { marginHorizontal: 15, color: '#94A3B8', fontSize: 10, fontWeight: 'bold' },

    quickAccessRow: { flexDirection: 'row', justifyContent: 'space-around' },
    quickBtn: { alignItems: 'center' },
    quickBtnText: { fontSize: 11, fontWeight: '700', color: isDark ? '#94A3B8' : '#64748B', marginTop: 8 },

    footer: { marginTop: 40, alignItems: 'center' },
    footerNote: { fontSize: 12, color: isDark ? '#475569' : '#94A3B8', fontWeight: 'bold' },
    footerWarning: { fontSize: 10, color: '#EF4444', fontWeight: '900', marginTop: 5, letterSpacing: 1 },

    // PIN Pad Styles
    pinHeader: { alignItems: 'center', marginBottom: 40 },
    pinTitle: { fontSize: 22, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#1F2937', marginTop: 20 },
    pinSubtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 5 },
    pinGrid: { alignItems: 'center' },
    pinDisplay: { width: 240, height: 70, borderBottomWidth: 2, borderColor: '#3B82F6', textAlign: 'center', color: isDark ? '#F9FAFB' : '#111827', fontSize: 32, marginBottom: 40 },
    numPad: { width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 },
    numBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: isDark ? '#1E293B' : '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    numTxt: { fontSize: 24, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#1F2937' },
    backBtn: { marginTop: 40, alignSelf: 'center' },
    backBtnText: { color: '#3B82F6', fontWeight: 'bold', textDecorationLine: 'underline' }
});
