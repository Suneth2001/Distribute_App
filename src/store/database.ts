import AsyncStorage from '@react-native-async-storage/async-storage';

const USERS_KEY = '@pos_users';
const CURRENT_USER_KEY = '@pos_current_user';
const PRODUCTS_KEY = '@pos_products';
const CATEGORIES_KEY = '@pos_categories';
const SHOPS_KEY = '@pos_shops';
const TRANSACTIONS_KEY = '@pos_transactions';
const EXPENSES_KEY = '@pos_expenses';

// Utility for ID generation
export const generateId = () => Math.random().toString(36).substring(2, 15);

// --- Auth & Users ---
export const getUsers = async (): Promise<any[]> => {
    const data = await AsyncStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
};

export const registerUser = async (username: string, password: string) => {
    const users = await getUsers();
    if (users.find((u: any) => u.username === username)) {
        throw new Error('User already exists');
    }
    const newUser = { id: generateId(), username, password };
    users.push(newUser);
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

    // auto login after registration
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    return newUser;
};

export const loginUser = async (username: string, password: string) => {
    const users = await getUsers();
    const user = users.find((u: any) => u.username === username && u.password === password);
    if (!user) throw new Error('Invalid credentials');

    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
};

export const getCurrentUser = async (): Promise<any> => {
    const data = await AsyncStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
};

export const logoutUser = async () => {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
};

// --- Products & Categories ---
export const getCategories = async (): Promise<any[]> => {
    const data = await AsyncStorage.getItem(CATEGORIES_KEY);
    // Default categories if empty
    if (!data) {
        const defaultData = [{ id: 'c1', name: 'General' }];
        await setCategories(defaultData);
        return defaultData;
    }
    return JSON.parse(data);
};

export const setCategories = async (categories: any[]) => {
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
};

export const getProducts = async (): Promise<any[]> => {
    const data = await AsyncStorage.getItem(PRODUCTS_KEY);
    return data ? JSON.parse(data) : [];
};

export const setProducts = async (products: any[]) => {
    await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
};

// --- Shops (For Custom Pricing) ---
export const getShops = async (): Promise<any[]> => {
    const data = await AsyncStorage.getItem(SHOPS_KEY);
    if (!data) {
        const defaultShops = [{ id: 's1', name: 'Default Shop', defaultPriceMultiplier: 1.0 }];
        await setShops(defaultShops);
        return defaultShops;
    }
    return JSON.parse(data);
};

export const setShops = async (shops: any[]) => {
    await AsyncStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
};

// --- Transactions / Sales ---
export const getTransactions = async (): Promise<any[]> => {
    const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
};

export const setTransactions = async (trans: any[]) => {
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(trans));
};

// --- Expenses ---
export const getExpenses = async (): Promise<any[]> => {
    const data = await AsyncStorage.getItem(EXPENSES_KEY);
    return data ? JSON.parse(data) : [];
};

export const setExpenses = async (expenses: any[]) => {
    await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
};

// Seed db if empty
export const seedDatabase = async () => {
    await getCategories();
    await getShops();
};
