import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme, SectionList } from 'react-native';
import { generateId, getExpenses, setExpenses } from '../../src/store/database';

const CATEGORIES = [
    { id: 'fuel', name: 'Fuel', icon: 'speedometer', color: '#EF4444' },
    { id: 'food', name: 'Tea & Food', icon: 'restaurant', color: '#F59E0B' },
    { id: 'vehicle', name: 'Vehicle', icon: 'car', color: '#3B82F6' },
    { id: 'shop', name: 'Shop Bills', icon: 'business', color: '#10B981' },
    { id: 'other', name: 'General', icon: 'receipt', color: '#6B7280' },
];

export default function ExpensesScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);
    const router = useRouter();

    const [expenses, setExpensesList] = useState<any[]>([]);
    const [isModalVisible, setModalVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [todayTotal, setTodayTotal] = useState(0);
    const [expenseDate, setExpenseDate] = useState(new Date());
    const [isDatePickerVisible, setDatePickerVisible] = useState(false);

    const loadData = async () => {
        const ex = await getExpenses();
        // Sort by newest first
        const sorted = ex.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpensesList(sorted);

        // Calculate Today's Total
        const today = new Date().toLocaleDateString();
        const total = sorted
            .filter(e => new Date(e.date).toLocaleDateString() === today)
            .reduce((sum, e) => sum + e.amount, 0);
        setTodayTotal(total);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const addExpense = async () => {
        if (!title || !amount) {
            Alert.alert('Error', 'Please enter title and amount');
            return;
        }
        const newDoc = {
            id: generateId(),
            title: title.trim(),
            amount: parseFloat(amount),
            category: selectedCategory.id,
            date: expenseDate.toISOString()
        };
        const updated = [newDoc, ...expenses];
        await setExpenses(updated);
        setExpensesList(updated);

        // Reset and close
        setTitle('');
        setAmount('');
        setExpenseDate(new Date());
        setModalVisible(false);
        loadData();
    };

    const deleteExpense = (id: string) => {
        Alert.alert('Delete', 'Delete this expense entry?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const updated = expenses.filter(e => e.id !== id);
                    await setExpenses(updated);
                    setExpensesList(updated);
                    loadData();
                }
            }
        ]);
    };

    const renderExpense = ({ item }: { item: any }) => {
        const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[4];
        const date = new Date(item.date);

        return (
            <View style={styles.card}>
                <View style={[styles.iconBox, { backgroundColor: cat.color + '20' }]}>
                    <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                </View>
                <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.amount}>- Rs {item.amount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.cardFooter}>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                        <Text style={styles.dateText}>
                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteExpense(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        );
    };

    // Grouping logic for the list
    const sections: any[] = [];
    const todayStr = new Date().toLocaleDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString();

    const grouped = expenses.reduce((groups, expense) => {
        const date = new Date(expense.date).toLocaleDateString();
        let title = date;
        if (date === todayStr) title = 'Today';
        else if (date === yesterdayStr) title = 'Yesterday';

        if (!groups[title]) groups[title] = [];
        groups[title].push(expense);
        return groups;
    }, {});

    const sectionData = Object.keys(grouped)
        .sort((a, b) => {
            if (a === 'Today') return -1;
            if (b === 'Today') return 1;
            if (a === 'Yesterday') return -1;
            if (b === 'Yesterday') return 1;
            return new Date(b).getTime() - new Date(a).getTime();
        })
        .map(title => ({
            title,
            data: grouped[title]
        }));

    return (
        <View style={styles.container}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#F9FAFB' : '#111827' }}>Expenses</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, backgroundColor: isDark ? '#1F2937' : '#E5E7EB', borderRadius: 20 }}>
                    <Ionicons name="close" size={24} color={isDark ? '#FFF' : '#000'} />
                </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>TODAY'S TOTAL EXPENSES</Text>
                <Text style={styles.summaryValue}>Rs {todayTotal.toFixed(2)}</Text>
                <TouchableOpacity style={styles.floatingAddBtn} onPress={() => setModalVisible(true)}>
                    <Ionicons name="add" size={24} color="#FFF" />
                    <Text style={styles.floatingAddText}>Add Expense</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {sectionData.map((section, idx) => (
                    <View key={idx}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        {section.data.map((item: any) => (
                            <View key={item.id} style={{ paddingHorizontal: 16 }}>
                                {renderExpense({ item })}
                            </View>
                        ))}
                    </View>
                ))}
            </ScrollView>

            <Modal visible={isModalVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Expense</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={28} color={isDark ? '#F9FAFB' : '#1F2937'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1, padding: 20 }}>
                            <Text style={styles.label}>Select Category</Text>
                            <View style={styles.categoryGrid}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.catBtn,
                                            selectedCategory.id === cat.id && { backgroundColor: cat.color, borderColor: cat.color }
                                        ]}
                                        onPress={() => setSelectedCategory(cat)}
                                    >
                                        <Ionicons name={cat.icon as any} size={20} color={selectedCategory.id === cat.id ? '#FFF' : cat.color} />
                                        <Text style={[styles.catBtnText, selectedCategory.id === cat.id && { color: '#FFF' }]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Expense Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Vehicle Fuel, Morning Tea"
                                placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
                                value={title}
                                onChangeText={setTitle}
                            />

                            <Text style={styles.label}>Amount (Rs)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="numeric"
                            />

                            <Text style={styles.label}>Date</Text>
                            <TouchableOpacity
                                style={styles.input}
                                onPress={() => setDatePickerVisible(true)}
                            >
                                <Ionicons name="calendar-outline" size={20} color={isDark ? '#F9FAFB' : '#111827'} style={{ marginRight: 10 }} />
                                <Text style={{ color: isDark ? '#F9FAFB' : '#111827', fontWeight: 'bold' }}>
                                    {expenseDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.saveBtn} onPress={addExpense}>
                                <Text style={styles.saveBtnText}>Save Expense Entry</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* Custom Date Picker Modal (Nested for visibility) */}
                        <Modal visible={isDatePickerVisible} transparent={true} animationType="fade">
                            <View style={styles.alertOverlay}>
                                <View style={[styles.alertBox, { width: '90%', padding: 15 }]}>
                                    <View style={styles.modalHeaderTransparent}>
                                        <Text style={styles.modalTitle}>Select Date</Text>
                                        <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                                            <Ionicons name="close" size={24} color={isDark ? '#F9FAFB' : '#1F2937'} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 }}>
                                        <TouchableOpacity onPress={() => {
                                            const d = new Date(expenseDate);
                                            d.setMonth(d.getMonth() - 1);
                                            setExpenseDate(d);
                                        }}>
                                            <Ionicons name="chevron-back" size={24} color={isDark ? '#3B82F6' : '#2563EB'} />
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' }}>
                                            {expenseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => {
                                                const d = new Date(expenseDate);
                                                d.setMonth(d.getMonth() + 1);
                                                if (d <= new Date()) {
                                                    setExpenseDate(d);
                                                }
                                            }}
                                            disabled={new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 1) > new Date()}
                                            style={{ opacity: new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 1) > new Date() ? 0.3 : 1 }}
                                        >
                                            <Ionicons name="chevron-forward" size={24} color={isDark ? '#3B82F6' : '#2563EB'} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        {Array.from({ length: new Date(expenseDate.getFullYear(), expenseDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                            const dateAtDay = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), day);
                                            const isFuture = dateAtDay > new Date();
                                            const isSelected = expenseDate.getDate() === day;

                                            return (
                                                <TouchableOpacity
                                                    key={day}
                                                    disabled={isFuture}
                                                    onPress={() => {
                                                        if (!isFuture) {
                                                            const d = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), day);
                                                            setExpenseDate(d);
                                                            setDatePickerVisible(false);
                                                        }
                                                    }}
                                                    style={{
                                                        width: 40, height: 40, margin: 4, borderRadius: 20,
                                                        backgroundColor: isSelected ? '#3B82F6' : 'transparent',
                                                        justifyContent: 'center', alignItems: 'center',
                                                        borderWidth: 1,
                                                        borderColor: isSelected ? '#3B82F6' : (isDark ? '#374151' : '#E5E7EB'),
                                                        opacity: isFuture ? 0.2 : 1
                                                    }}
                                                >
                                                    <Text style={{ color: isSelected ? '#FFF' : (isDark ? '#F9FAFB' : '#4B5563'), fontWeight: isSelected ? 'bold' : 'normal' }}>{day}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.saveBtn, { marginTop: 20, paddingVertical: 12 }]}
                                        onPress={() => setDatePickerVisible(false)}
                                    >
                                        <Text style={styles.saveBtnText}>Confirm Date</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#111827' : '#F9FAFB' },

    summaryCard: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        padding: 24,
        paddingTop: 20,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
        margin: 20,
        zIndex: 10
    },
    summaryLabel: { color: isDark ? '#9CA3AF' : '#6B7280', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    summaryValue: { color: '#EF4444', fontSize: 36, fontWeight: '900', marginVertical: 8 },
    floatingAddBtn: { backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, marginTop: 10 },
    floatingAddText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },

    sectionTitle: { fontSize: 13, fontWeight: '800', color: isDark ? '#4B5563' : '#9CA3AF', textTransform: 'uppercase', marginLeft: 20, marginTop: 24, marginBottom: 12 },

    card: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 2,
        borderWidth: 1, borderColor: isDark ? '#374151' : '#F3F4F6'
    },
    iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    cardContent: { flex: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 16, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    amount: { fontSize: 16, fontWeight: '900', color: '#EF4444' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    categoryName: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' },
    dateText: { fontSize: 12, color: isDark ? '#4B5563' : '#9CA3AF' },
    deleteBtn: { padding: 8 },

    // Modal
    modalContainer: { flex: 1, backgroundColor: isDark ? '#111827' : '#FFF', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#F3F4F6' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#1F2937' },
    label: { fontSize: 14, fontWeight: 'bold', color: isDark ? '#D1D5DB' : '#374151', marginBottom: 10, marginTop: 20 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    catBtn: {
        paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB', flexDirection: 'row', alignItems: 'center'
    },
    catBtnText: { marginLeft: 8, fontSize: 13, fontWeight: '600', color: isDark ? '#9CA3AF' : '#4B5563' },
    input: {
        backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
        padding: 16, borderRadius: 12, borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        color: isDark ? '#F9FAFB' : '#111827',
        fontSize: 16
    },
    saveBtn: { backgroundColor: '#EF4444', padding: 18, borderRadius: 12, marginTop: 40, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

    // Alert & Common Modal Overlays
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    alertBox: {
        width: '85%', backgroundColor: isDark ? '#1F2937' : '#FFF', borderRadius: 24, padding: 24,
        elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 10
    },
    modalHeaderTransparent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }
});
