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

// Date normalization utility for all historical backup formats
export const normalizeDate = (rawDate: any): string => {
    if (!rawDate) return new Date().toISOString();
    if (rawDate instanceof Date) {
        return isNaN(rawDate.getTime()) ? new Date().toISOString() : rawDate.toISOString();
    }
    if (typeof rawDate === 'number') {
        const d = new Date(rawDate);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
    if (typeof rawDate === 'string') {
        const trimmed = rawDate.trim();
        // If it's a numeric timestamp string e.g. "1715493829000"
        if (/^\d{10,13}$/.test(trimmed)) {
            const num = parseInt(trimmed, 10);
            const d = new Date(num);
            if (!isNaN(d.getTime())) return d.toISOString();
        }
        // Try direct parse
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) return d.toISOString();

        // Try formats like DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(.*)$/);
        if (dmyMatch) {
            const [, day, month, year, rest] = dmyMatch;
            const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}${rest || 'T12:00:00.000Z'}`);
            if (!isNaN(parsed.getTime())) return parsed.toISOString();
        }
    }
    return new Date().toISOString();
};

const getMonthKey = (dateStr?: string | Date | number): string => {
    const iso = normalizeDate(dateStr);
    const d = new Date(iso);
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
    const unique = Array.from(new Set(months.filter(m => m && !m.includes('NaN')))).sort().reverse();
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
 * Bulk overwrite / rewrite transactions (used for returns, edits, or full sync / restore).
 */
export const setTransactions = async (trans: any[]) => {
    try {
        if (!Array.isArray(trans)) return;

        // Normalize transactions and ensure clean item arrays and date fields
        const normalized = trans.map((tx: any, idx: number) => {
            const dateIso = normalizeDate(tx.date || tx.createdAt || tx.timestamp || tx.time || tx.billDate);
            const rawItems = Array.isArray(tx.items) ? tx.items : (Array.isArray(tx.products) ? tx.products : []);
            
            const cleanItems = rawItems.map((item: any, iIdx: number) => {
                const qty = typeof item.qty === 'number' ? item.qty : (parseFloat(item.qty) || 1);
                const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : (parseFloat(item.unitPrice) || parseFloat(item.price) || 0);
                const totalPrice = typeof item.totalPrice === 'number' ? item.totalPrice : (parseFloat(item.totalPrice) || (unitPrice * qty));
                const cost = typeof item.cost === 'number' ? item.cost : (parseFloat(item.cost) || 0);
                return {
                    ...item,
                    id: item.id || `item_${idx}_${iIdx}`,
                    nameEnglish: item.nameEnglish || item.name || item.title || 'Product',
                    nameSinhala: item.nameSinhala || '',
                    qty,
                    unitPrice,
                    totalPrice,
                    cost,
                    isReturned: !!item.isReturned,
                    returnedQty: item.returnedQty || 0,
                };
            });

            const total = typeof tx.total === 'number' ? tx.total : (parseFloat(tx.total) || cleanItems.reduce((sum: number, it: any) => sum + (it.totalPrice || 0), 0));
            const totalCost = typeof tx.totalCost === 'number' ? tx.totalCost : (parseFloat(tx.totalCost) || cleanItems.reduce((sum: number, it: any) => sum + (it.cost || 0), 0));
            const netTotal = typeof tx.netTotal === 'number' ? tx.netTotal : total;
            const profit = typeof tx.profit === 'number' ? tx.profit : (total - totalCost);

            return {
                ...tx,
                id: tx.id || `TX_${Date.now()}_${idx}`,
                date: dateIso,
                shopId: tx.shopId || 's1',
                shopName: tx.shopName || tx.customerName || 'Default Shop',
                items: cleanItems,
                total,
                netTotal,
                totalCost,
                profit,
                paidAmount: typeof tx.paidAmount === 'number' ? tx.paidAmount : (parseFloat(tx.paidAmount) || total),
                change: typeof tx.change === 'number' ? tx.change : (parseFloat(tx.change) || 0),
                paymentMethod: tx.paymentMethod || 'cash'
            };
        });

        // Group by month
        const groups: { [month: string]: any[] } = {};
        normalized.forEach((tx: any) => {
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
 * Universal restore: safely parses backups from any past app version,
 * AsyncStorage dump, or direct table arrays.
 */
export const restoreDatabaseBackup = async (backupInput: string | any): Promise<{
    restoredBills: number;
    restoredProducts: number;
    restoredShops: number;
    restoredExpenses: number;
    restoredCategories: number;
}> => {
    try {
        let parsed: any = backupInput;
        if (typeof backupInput === 'string') {
            const cleanStr = backupInput.replace(/^\uFEFF/, '').trim();
            parsed = JSON.parse(cleanStr);
            // In case of double stringified JSON
            if (typeof parsed === 'string') {
                try {
                    parsed = JSON.parse(parsed);
                } catch {}
            }
        }

        if (!parsed) {
            throw new Error('Invalid backup file: file is empty.');
        }

        // 1. Check if it's an array of key-value tuples: [ ["@pos_products", "..."], ... ]
        if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0]) && typeof parsed[0][0] === 'string') {
            const dict: any = {};
            for (const [key, val] of parsed) {
                try {
                    dict[key] = typeof val === 'string' ? JSON.parse(val) : val;
                } catch {
                    dict[key] = val;
                }
            }
            parsed = dict;
        }

        // 2. Extract data payload
        let rawData = parsed.data || parsed.payload || parsed;
        if (typeof rawData === 'string') {
            try {
                rawData = JSON.parse(rawData);
            } catch {}
        }

        let restoredProducts = 0;
        let restoredShops = 0;
        let restoredBills = 0;
        let restoredExpenses = 0;
        let restoredCategories = 0;

        // Products extraction (products / items / @pos_products)
        let productsList = rawData.products || rawData.items || rawData[PRODUCTS_KEY] || parsed[PRODUCTS_KEY];
        if (typeof productsList === 'string') {
            try { productsList = JSON.parse(productsList); } catch {}
        }
        if (Array.isArray(productsList) && productsList.length > 0) {
            await setProducts(productsList);
            restoredProducts = productsList.length;
        } else if (productsList && typeof productsList === 'object' && Object.keys(productsList).length > 0) {
            const arr = Object.values(productsList);
            await setProducts(arr);
            restoredProducts = arr.length;
        }

        // Shops extraction (shops / customers / clients / @pos_shops)
        let shopsList = rawData.shops || rawData.customers || rawData.clients || rawData[SHOPS_KEY] || parsed[SHOPS_KEY];
        if (typeof shopsList === 'string') {
            try { shopsList = JSON.parse(shopsList); } catch {}
        }
        if (Array.isArray(shopsList) && shopsList.length > 0) {
            await setShops(shopsList);
            restoredShops = shopsList.length;
        } else if (shopsList && typeof shopsList === 'object' && Object.keys(shopsList).length > 0) {
            const arr = Object.values(shopsList);
            await setShops(arr);
            restoredShops = arr.length;
        }

        // Categories extraction
        let categoriesList = rawData.categories || rawData.category || rawData[CATEGORIES_KEY] || parsed[CATEGORIES_KEY];
        if (typeof categoriesList === 'string') {
            try { categoriesList = JSON.parse(categoriesList); } catch {}
        }
        if (Array.isArray(categoriesList) && categoriesList.length > 0) {
            await setCategories(categoriesList);
            restoredCategories = categoriesList.length;
        }

        // Transactions extraction (transactions / bills / history / orders / sales / @pos_transactions)
        let transactionsList = rawData.transactions || rawData.bills || rawData.history || rawData.orders || rawData.sales || rawData[LEGACY_TRANSACTIONS_KEY] || parsed[LEGACY_TRANSACTIONS_KEY];
        if (typeof transactionsList === 'string') {
            try { transactionsList = JSON.parse(transactionsList); } catch {}
        }

        // If root was an array of transactions
        if (!transactionsList && Array.isArray(parsed) && parsed.length > 0 && (parsed[0].items || parsed[0].total !== undefined || parsed[0].shopId || parsed[0].shopName)) {
            transactionsList = parsed;
        }

        if (Array.isArray(transactionsList) && transactionsList.length > 0) {
            await setTransactions(transactionsList);
            restoredBills = transactionsList.length;
        } else if (transactionsList && typeof transactionsList === 'object' && Object.keys(transactionsList).length > 0) {
            const arr = Object.values(transactionsList);
            await setTransactions(arr);
            restoredBills = arr.length;
        }

        // Expenses extraction
        let expensesList = rawData.expenses || rawData.costs || rawData[EXPENSES_KEY] || parsed[EXPENSES_KEY];
        if (typeof expensesList === 'string') {
            try { expensesList = JSON.parse(expensesList); } catch {}
        }
        if (Array.isArray(expensesList) && expensesList.length > 0) {
            await setExpenses(expensesList);
            restoredExpenses = expensesList.length;
        }

        // Security extraction
        let sec = rawData.security || rawData.securitySettings || rawData[SECURITY_SETTINGS_KEY] || parsed[SECURITY_SETTINGS_KEY];
        if (typeof sec === 'string') {
            try { sec = JSON.parse(sec); } catch {}
        }
        if (sec && typeof sec === 'object') {
            await setSecuritySettings(sec);
        }

        // Ensure default admin & shops exist
        await seedDatabase();

        return {
            restoredBills,
            restoredProducts,
            restoredShops,
            restoredExpenses,
            restoredCategories,
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
