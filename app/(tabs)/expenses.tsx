import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { generateId, getExpenses, setExpenses } from '../../src/store/database';

export default function ExpensesScreen() {
    const [expenses, setExpensesList] = useState<any[]>([]);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const ex = await getExpenses();
        setExpensesList(ex);
    };

    const addExpense = async () => {
        if (!title || !amount) {
            Alert.alert('Error', 'Please enter title and amount');
            return;
        }
        const newDoc = {
            id: generateId(),
            title,
            amount: parseFloat(amount),
            date: new Date().toISOString()
        };
        const updated = [...expenses, newDoc];
        await setExpenses(updated);
        setExpensesList(updated);
        setTitle('');
        setAmount('');
    };

    const renderExpense = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.leftCol}>
                <Ionicons name="receipt" size={24} color="#EF4444" style={{ marginRight: 12 }} />
                <View>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
                </View>
            </View>
            <Text style={styles.amount}>- Rs {item.amount}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.addSection}>
                <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder="Tea, Fuel..."
                    value={title}
                    onChangeText={setTitle}
                />
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Rs 0"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                />
                <TouchableOpacity style={styles.addButton} onPress={addExpense}>
                    <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={expenses}
                keyExtractor={item => item.id}
                renderItem={renderExpense}
                contentContainerStyle={{ padding: 16 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    addSection: {
        flexDirection: 'row', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E5E7EB'
    },
    input: {
        borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, marginRight: 8, backgroundColor: '#F9FAFB'
    },
    addButton: {
        backgroundColor: '#EF4444', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 8
    },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    card: {
        backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    leftCol: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
    date: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    amount: { fontSize: 16, fontWeight: 'bold', color: '#EF4444' }
});
