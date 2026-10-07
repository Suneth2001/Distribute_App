import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const USERS_KEY = '@pos_users';
const CURRENT_USER_KEY = '@pos_current_user';
const PRODUCTS_KEY = '@pos_products';
const CATEGORIES_KEY = '@pos_categories';
const SHOPS_KEY = '@pos_shops';
const EXPENSES_KEY = '@pos_expenses';
const SECURITY_SETTINGS_KEY = '@pos_security_settings';

// Partitioned transactions storage keys
const LEGACY_TRANSACTIONS_KEY = '@pos_transactions';
const TRANSACTIONS_MONTHS_KEY = '@pos_tx_months';
const TX_MONTH_PREFIX = '@pos_tx_';
const BILL_COUNTER_PREFIX = '@pos_bill_cnt_';

// Utility for ID generation
export const generateId = () => Math.random().toString(36).substring(2, 15);

// --- Auth & Users ---
export const getUsers = async (): Promise<any[]> => {
    try {
        const data = await AsyncStorage.getItem(USERS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const seedAdmin = async () => {
    try {
        const users = await getUsers();
        const hasAdmin = users.find((u: any) => u.username === 'Admin');
        if (!hasAdmin) {
            const adminUser = { id: 'admin-id', username: 'Admin', password: 'admin123' };
            users.push(adminUser);
            await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
    } catch (e) {
        console.warn('seedAdmin error:', e);
    }
};

export const loginUser = async (username: string, password: string) => {
    if (username === 'Admin' && password === 'admin123') {
        const user = { id: 'admin-id', username: 'Admin', password: 'admin123' };
        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        return user;
    }
    throw new Error('Invalid credentials. Only Admin occupies this application.');
};

export const registerUser = async (username: string, password: string) => {
    throw new Error('Registration is disabled. Please use Admin credentials.');
};

export const getCurrentUser = async (): Promise<any> => {
    try {
        const data = await AsyncStorage.getItem(CURRENT_USER_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};

export const logoutUser = async () => {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
};

export const updatePassword = async (newPassword: string) => {
    const data = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!data) return;
    const current = JSON.parse(data);

    const usersData = await AsyncStorage.getItem(USERS_KEY);
    if (!usersData) return;
    const users = JSON.parse(usersData);

    const updatedUsers = users.map((u: any) => {
        if (u.id === current.id) {
            return { ...u, password: newPassword };
        }
        return u;
    });

    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ ...current, password: newPassword }));
};

// --- Products & Categories ---
export const getCategories = async (): Promise<any[]> => {
    try {
        const data = await AsyncStorage.getItem(CATEGORIES_KEY);
        if (!data) {
            const defaultData = [{ id: 'c1', name: 'General' }];
            await setCategories(defaultData);
            return defaultData;
        }
        return JSON.parse(data);
    } catch {
        return [{ id: 'c1', name: 'General' }];
    }
};

export const setCategories = async (categories: any[]) => {
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
};

export const getProducts = async (): Promise<any[]> => {
    try {
        const data = await AsyncStorage.getItem(PRODUCTS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const setProducts = async (products: any[]) => {
    await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
};

// --- Shops (For Custom Pricing) ---
export const getShops = async (): Promise<any[]> => {
    try {
        const data = await AsyncStorage.getItem(SHOPS_KEY);
        if (!data) {
            const defaultShops = [{ id: 's1', name: 'Default Shop', defaultPriceMultiplier: 1.0, creditBalance: 0 }];
            await setShops(defaultShops);
            return defaultShops;
        }
        return JSON.parse(data);
    } catch {
        return [{ id: 's1', name: 'Default Shop', defaultPriceMultiplier: 1.0, creditBalance: 0 }];
    }
};

export const setShops = async (shops: any[]) => {
    await AsyncStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
};

// --- Partitioned / Chunked Transactions for High Performance & Zero-Freeze ---

const getMonthKey = (dateStr?: string | Date): string => {
    const d = dateStr ? new Date(dateStr) : new Date();
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${yyyy}-${mm}`;
};

const getStoredMonths = async (): Promise<string[]> => {
    try {
        const data = await AsyncStorage.getItem(TRANSACTIONS_MONTHS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

const setStoredMonths = async (months: string[]) => {
    const unique = Array.from(new Set(months)).sort().reverse();
    await AsyncStorage.setItem(TRANSACTIONS_MONTHS_KEY, JSON.stringify(unique));
};

/**
 * Migration helper: if old monolithic @pos_transactions exists, safely partition it
 * into month chunks so Android never hits CursorWindow limits.
 */
const migrateLegacyTransactionsIfNeeded = async (): Promise<any[] | null> => {
    try {
        const legacyData = await AsyncStorage.getItem(LEGACY_TRANSACTIONS_KEY);
        if (!legacyData) return null;

        const transactions: any[] = JSON.parse(legacyData);
        if (!Array.isArray(transactions) || transactions.length === 0) {
            await AsyncStorage.removeItem(LEGACY_TRANSACTIONS_KEY);
            return null;
        }

        // Group by month
        const groups: { [month: string]: any[] } = {};
        transactions.forEach((tx: any) => {
            const month = getMonthKey(tx.date);
            if (!groups[month]) groups[month] = [];
            groups[month].push(tx);
        });

        const months = Object.keys(groups);
        const pairs: [string, string][] = months.map(m => [
            `${TX_MONTH_PREFIX}${m}`,
            JSON.stringify(groups[m])
        ]);

        await AsyncStorage.multiSet(pairs);
        await setStoredMonths(months);

        // Remove legacy huge key to save space and prevent SQLite CursorWindow crash
        await AsyncStorage.removeItem(LEGACY_TRANSACTIONS_KEY);
        return transactions;
    } catch (e) {
        console.warn('Migration error (fallback to safe read):', e);
        return null;
    }
};

/**
 * Load all transactions across all monthly chunks safely.
 */
export const getTransactions = async (): Promise<any[]> => {
    try {
        // Check for legacy migration first
        const migrated = await migrateLegacyTransactionsIfNeeded();
        if (migrated) return migrated;

        const months = await getStoredMonths();
        if (months.length === 0) return [];

        const keys = months.map(m => `${TX_MONTH_PREFIX}${m}`);
        const entries = await AsyncStorage.multiGet(keys);

        const allTransactions: any[] = [];
        for (const [, val] of entries) {
            if (val) {
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) {
                        allTransactions.push(...parsed);
                    }
                } catch (err) {
                    console.warn('Error parsing transaction chunk:', err);
                }
            }
        }

        return allTransactions;
    } catch (error) {
        console.error('getTransactions error:', error);
        return [];
    }
};

/**
 * High-performance single transaction append without loading or serializing months of data!
 */
export const addTransaction = async (newTransaction: any): Promise<void> => {
    try {
        const month = getMonthKey(newTransaction.date);
        const monthKey = `${TX_MONTH_PREFIX}${month}`;

        // 1. Read only current month's chunk
        const currentMonthData = await AsyncStorage.getItem(monthKey);
        const monthTransactions: any[] = currentMonthData ? JSON.parse(currentMonthData) : [];

        // 2. Append new transaction
        monthTransactions.push(newTransaction);
        await AsyncStorage.setItem(monthKey, JSON.stringify(monthTransactions));

        // 3. Update month list if new month
        const storedMonths = await getStoredMonths();
        if (!storedMonths.includes(month)) {
            await setStoredMonths([month, ...storedMonths]);
        }

        // 4. Update daily bill counter
        const todayStr = newTransaction.id ? newTransaction.id.substring(0, 8) : null;
        if (todayStr && newTransaction.id) {
            const numPart = parseInt(newTransaction.id.substring(8), 10);
            if (!isNaN(numPart)) {
                await AsyncStorage.setItem(`${BILL_COUNTER_PREFIX}${todayStr}`, numPart.toString());
            }
        }
    } catch (error) {
        console.error('addTransaction error:', error);
        throw error;
    }
};

/**
 * Fast daily bill number generator using dedicated counter key.
 */
export const getNextBillNumber = async (date: Date = new Date()): Promise<string> => {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;
    const counterKey = `${BILL_COUNTER_PREFIX}${datePrefix}`;

    try {
        const cachedCount = await AsyncStorage.getItem(counterKey);
        if (cachedCount) {
            const nextNum = parseInt(cachedCount, 10) + 1;
            await AsyncStorage.setItem(counterKey, nextNum.toString());
            return `${datePrefix}${nextNum.toString().padStart(4, '0')}`;
        }

        // If counter doesn't exist yet for today, check only current month's transactions
        const month = `${yyyy}-${mm}`;
        const currentMonthData = await AsyncStorage.getItem(`${TX_MONTH_PREFIX}${month}`);
        let nextNum = 1;

        if (currentMonthData) {
            const txs: any[] = JSON.parse(currentMonthData);
            const todayTxs = txs.filter((t: any) => t.id && t.id.startsWith(datePrefix));
            if (todayTxs.length > 0) {
                todayTxs.sort((a: any, b: any) => b.id.localeCompare(a.id));
                const lastNumStr = todayTxs[0].id.substring(8);
                const lastNum = parseInt(lastNumStr, 10);
                if (!isNaN(lastNum)) {
                    nextNum = lastNum + 1;
                }
            }
        }

        await AsyncStorage.setItem(counterKey, nextNum.toString());
        return `${datePrefix}${nextNum.toString().padStart(4, '0')}`;
    } catch (error) {
        console.warn('getNextBillNumber error, generating fallback:', error);
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `${datePrefix}${rand}`;
    }
};

/**
 * Bulk overwrite / rewrite transactions (used for returns, edits, or full sync).
 */
export const setTransactions = async (trans: any[]) => {
    try {
        if (!Array.isArray(trans)) return;

        // Group by month
        const groups: { [month: string]: any[] } = {};
        trans.forEach((tx: any) => {
            const month = getMonthKey(tx.date);
            if (!groups[month]) groups[month] = [];
            groups[month].push(tx);
        });

        const newMonths = Object.keys(groups);
        const oldMonths = await getStoredMonths();

        // Remove old month keys that no longer exist
        const monthsToRemove = oldMonths.filter(m => !newMonths.includes(m));
        if (monthsToRemove.length > 0) {
            await AsyncStorage.multiRemove(monthsToRemove.map(m => `${TX_MONTH_PREFIX}${m}`));
        }

        // Save new month chunks
        const pairs: [string, string][] = newMonths.map(m => [
            `${TX_MONTH_PREFIX}${m}`,
            JSON.stringify(groups[m])
        ]);

        if (pairs.length > 0) {
            await AsyncStorage.multiSet(pairs);
        }

        await setStoredMonths(newMonths);
    } catch (error) {
        console.error('setTransactions error:', error);
        throw error;
    }
};

/**
 * Delete transactions older than specified days and purge obsolete monthly chunks.
 */
export const deleteOldTransactions = async (days: number = 30): Promise<{ deletedCount: number, keptCount: number }> => {
    try {
        const all = await getTransactions();
        const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

        const initialCount = all.length;
        const kept = all.filter((t: any) => {
            const tDate = new Date(t.date).getTime();
            return !isNaN(tDate) && tDate >= cutoffTime;
        });

        const deletedCount = initialCount - kept.length;
        await setTransactions(kept);

        return { deletedCount, keptCount: kept.length };
    } catch (error) {
        console.error('deleteOldTransactions error:', error);
        throw error;
    }
};

// --- Expenses ---
export const getExpenses = async (): Promise<any[]> => {
    try {
        const data = await AsyncStorage.getItem(EXPENSES_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const setExpenses = async (expenses: any[]) => {
    await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
};

// --- Security Settings ---
export const getSecuritySettings = async () => {
    try {
        const data = await AsyncStorage.getItem(SECURITY_SETTINGS_KEY);
        return data ? JSON.parse(data) : { biometricsEnabled: false, pinEnabled: false, pin: '' };
    } catch {
        return { biometricsEnabled: false, pinEnabled: false, pin: '' };
    }
};

export const setSecuritySettings = async (settings: any) => {
    await AsyncStorage.setItem(SECURITY_SETTINGS_KEY, JSON.stringify(settings));
};

// --- Database Maintenance, Backup & Statistics ---

export const getDatabaseStats = async () => {
    const products = await getProducts();
    const shops = await getShops();
    const transactions = await getTransactions();
    const expenses = await getExpenses();

    return {
        productsCount: products.length,
        shopsCount: shops.length,
        transactionsCount: transactions.length,
        expensesCount: expenses.length,
    };
};

export const exportDatabaseBackup = async (): Promise<string> => {
    try {
        const [users, products, categories, shops, transactions, expenses, security] = await Promise.all([
            getUsers(),
            getProducts(),
            getCategories(),
            getShops(),
            getTransactions(),
            getExpenses(),
            getSecuritySettings()
        ]);

        const backupData = {
            version: '1.2.0',
            exportedAt: new Date().toISOString(),
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

        const jsonString = JSON.stringify(backupData, null, 2);
        const fileName = `POS_Backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now().toString().slice(-4)}.json`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(filePath, jsonString, {
            encoding: FileSystem.EncodingType.UTF8
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
            await Sharing.shareAsync(filePath, {
                mimeType: 'application/json',
                dialogTitle: 'Export POS Database Backup',
                UTI: 'public.json'
            });
        }

        return filePath;
    } catch (error) {
        console.error('exportDatabaseBackup error:', error);
        throw error;
    }
};

/**
 * Restore complete database from a backup object or JSON string
 */
export const restoreDatabaseBackup = async (backupInput: string | any): Promise<{
    restoredBills: number;
    restoredProducts: number;
    restoredShops: number;
    restoredExpenses: number;
}> => {
    try {
        let parsed: any;
        if (typeof backupInput === 'string') {
            parsed = JSON.parse(backupInput);
        } else {
            parsed = backupInput;
        }

        const data = parsed.data || parsed;
        if (!data) {
            throw new Error('Invalid backup file structure: missing data payload.');
        }

        let restoredProducts = 0;
        let restoredShops = 0;
        let restoredBills = 0;
        let restoredExpenses = 0;

        if (Array.isArray(data.products)) {
            await setProducts(data.products);
            restoredProducts = data.products.length;
        }

        if (Array.isArray(data.shops)) {
            await setShops(data.shops);
            restoredShops = data.shops.length;
        }

        if (Array.isArray(data.categories)) {
            await setCategories(data.categories);
        }

        if (Array.isArray(data.transactions)) {
            await setTransactions(data.transactions);
            restoredBills = data.transactions.length;
        }

        if (Array.isArray(data.expenses)) {
            await setExpenses(data.expenses);
            restoredExpenses = data.expenses.length;
        }

        if (data.security) {
            await setSecuritySettings(data.security);
        }

        return {
            restoredBills,
            restoredProducts,
            restoredShops,
            restoredExpenses,
        };
    } catch (error) {
        console.error('restoreDatabaseBackup error:', error);
        throw error;
    }
};

// Seed db if empty
export const seedDatabase = async () => {
    await getCategories();
    await getShops();
    await seedAdmin();
};
