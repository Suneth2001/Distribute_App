import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { startAutoBackupWatcher, stopAutoBackupWatcher } from '../src/services/googleDriveBackup';

export default function RootLayout() {
    const isDark = useColorScheme() === 'dark';

    useEffect(() => {
        startAutoBackupWatcher();
        return () => {
            stopAutoBackupWatcher();
        };
    }, []);

    return (
        <SafeAreaProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </SafeAreaProvider>
    );
}
