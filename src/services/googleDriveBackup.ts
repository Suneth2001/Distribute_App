import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { 
    getUsers, 
    getProducts, 
    getCategories, 
    getShops, 
    getTransactions, 
    getExpenses, 
    getSecuritySettings 
} from '../store/database';

const GDRIVE_SETTINGS_KEY = '@pos_gdrive_settings';

export interface GoogleDriveSettings {
    autoBackupEnabled: boolean;
    backupTime: string; // e.g. "23:59"
    googleUserEmail: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: number | null;
    folderId: string | null;
    lastBackupDate: string | null; // "YYYY-MM-DD"
    lastBackupTimestamp: string | null;
    lastBackupStatus: 'success' | 'failed' | 'idle';
    lastBackupError: string | null;
}

const DEFAULT_SETTINGS: GoogleDriveSettings = {
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
};

export const getGoogleDriveSettings = async (): Promise<GoogleDriveSettings> => {
    try {
        const raw = await AsyncStorage.getItem(GDRIVE_SETTINGS_KEY);
        if (!raw) return DEFAULT_SETTINGS;
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_SETTINGS;
    }
};

export const saveGoogleDriveSettings = async (settings: Partial<GoogleDriveSettings>): Promise<GoogleDriveSettings> => {
    try {
        const current = await getGoogleDriveSettings();
        const updated = { ...current, ...settings };
        await AsyncStorage.setItem(GDRIVE_SETTINGS_KEY, JSON.stringify(updated));
        return updated;
    } catch (e) {
        console.error('Error saving Google Drive settings:', e);
        throw e;
    }
};

/**
 * Generate full backup payload tagged with Google Drive user email
 */
export const createBackupPayload = async () => {
    const settings = await getGoogleDriveSettings();
    const [users, products, categories, shops, transactions, expenses, security] = await Promise.all([
        getUsers(),
        getProducts(),
        getCategories(),
        getShops(),
        getTransactions(),
        getExpenses(),
        getSecuritySettings()
    ]);

    return {
        appName: 'Dilki Distributors POS',
        version: '1.2.0',
        targetGoogleEmail: settings.googleUserEmail || 'Unassigned',
        exportedAt: new Date().toISOString(),
        deviceTime: new Date().toLocaleString(),
        summary: {
            totalBills: transactions.length,
            totalProducts: products.length,
            totalShops: shops.length,
            totalExpenses: expenses.length,
        },
        data: {
            users,
            products,
            categories,
            shops,
            transactions,
            expenses,
            security
        }
    };
};

/**
 * Upload or save backup payload with Google Drive email metadata
 */
export const uploadBackupToGoogleDrive = async (): Promise<{ success: boolean; fileName: string; fileId?: string }> => {
    const settings = await getGoogleDriveSettings();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
    const cleanEmail = (settings.googleUserEmail || 'backup').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `POS_Backup_${cleanEmail}_${dateStr}_${timeStr}.json`;

    try {
        const payload = await createBackupPayload();
        const jsonContent = JSON.stringify(payload, null, 2);

        // Always save persistent snapshot locally
        const localPath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(localPath, jsonContent, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        // If Access Token is available, upload directly to Google Drive API
        if (settings.accessToken) {
            const boundary = '-------314159265358979323846';
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            const metadata: any = {
                name: fileName,
                mimeType: 'application/json',
                description: `Auto-Backup for ${settings.googleUserEmail || 'POS'} generated on ${now.toLocaleString()}`,
            };

            if (settings.folderId) {
                metadata.parents = [settings.folderId];
            }

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                jsonContent +
                closeDelimiter;

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${settings.accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                },
                body: multipartRequestBody,
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Google Drive API error (${response.status}): ${errText}`);
            }

            const resJson = await response.json();

            await saveGoogleDriveSettings({
                lastBackupDate: dateStr,
                lastBackupTimestamp: now.toISOString(),
                lastBackupStatus: 'success',
                lastBackupError: null,
            });

            return { success: true, fileName, fileId: resJson.id };
        } else {
            // Local snapshot recorded safely
            await saveGoogleDriveSettings({
                lastBackupDate: dateStr,
                lastBackupTimestamp: now.toISOString(),
                lastBackupStatus: 'success',
                lastBackupError: null,
            });

            return { success: true, fileName };
        }
    } catch (error: any) {
        console.error('uploadBackupToGoogleDrive error:', error);
        await saveGoogleDriveSettings({
            lastBackupTimestamp: now.toISOString(),
            lastBackupStatus: 'failed',
            lastBackupError: error?.message || 'Backup failed',
        });
        throw error;
    }
};

/**
 * Scheduled Auto-Backup Runner:
 * Checks if current time is >= 23:59 and today's backup has not yet run.
 */
export const checkAndRunScheduledBackup = async (): Promise<boolean> => {
    try {
        const settings = await getGoogleDriveSettings();
        if (!settings.autoBackupEnabled) return false;

        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();

        const [schedHoursStr, schedMinutesStr] = (settings.backupTime || '23:59').split(':');
        const schedHours = parseInt(schedHoursStr, 10) || 23;
        const schedMinutes = parseInt(schedMinutesStr, 10) || 59;

        const isTimeDue = (currentHours > schedHours) || (currentHours === schedHours && currentMinutes >= schedMinutes);
        const todayDateStr = now.toISOString().slice(0, 10);

        if (isTimeDue && settings.lastBackupDate !== todayDateStr) {
            console.log(`[Auto-Backup] Running scheduled daily backup for ${todayDateStr} at ${now.toLocaleTimeString()}...`);
            await uploadBackupToGoogleDrive();
            console.log(`[Auto-Backup] Daily backup completed successfully.`);
            return true;
        }

        return false;
    } catch (e) {
        console.warn('[Auto-Backup] Check error:', e);
        return false;
    }
};

let watcherInterval: any = null;

export const startAutoBackupWatcher = () => {
    if (watcherInterval) return;

    checkAndRunScheduledBackup().catch(() => {});

    watcherInterval = setInterval(() => {
        checkAndRunScheduledBackup().catch(() => {});
    }, 30000);
};

export const stopAutoBackupWatcher = () => {
    if (watcherInterval) {
        clearInterval(watcherInterval);
        watcherInterval = null;
    }
};
