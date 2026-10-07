import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { generateId, getShops, setShops } from '../../src/store/database';
import { useFocusEffect } from 'expo-router';

export default function ShopsScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);

    const [shops, setShopsList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Add Shop State
    const [isAddModalVisible, setAddModalVisible] = useState(false);
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [contact, setContact] = useState('');
    const [initialCredit, setInitialCredit] = useState('');

    // Update Credit State
    const [isCreditModalVisible, setCreditModalVisible] = useState(false);
    const [selectedShop, setSelectedShop] = useState<any>(null);
    const [creditUpdateAmount, setCreditUpdateAmount] = useState('');

    useFocusEffect(
        useCallback(() => {
            loadShops();
        }, [])
    );

    const loadShops = async () => {
        const s = await getShops();
        setShopsList(s);
    };

    const addShop = async () => {
        if (!name.trim()) {
            Alert.alert('Validation Error', 'Shop name is required.');
            return;
        }
        const newShop = {
            id: generateId(),
            name,
            address,
            contact,
            creditBalance: parseFloat(initialCredit) || 0
        };
        const updated = [...shops, newShop];
        await setShops(updated);
        setShopsList(updated);

        // Reset form
        setName('');
        setAddress('');
        setContact('');
        setInitialCredit('');
        setAddModalVisible(false);
    };

    const handleUpdateCredit = async (action: 'add' | 'pay') => {
        const amount = parseFloat(creditUpdateAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid amount.');
            return;
        }

        const updatedShops = shops.map(shop => {
            if (shop.id === selectedShop.id) {
                const currentBalance = shop.creditBalance || 0;
                let newBalance = currentBalance;
                if (action === 'add') {
                    newBalance += amount; // Shop took more on credit
                } else if (action === 'pay') {
                    newBalance -= amount; // Shop paid some debt
                }
                return { ...shop, creditBalance: newBalance };
            }
            return shop;
        });

        await setShops(updatedShops);
        setShopsList(updatedShops);
        setCreditUpdateAmount('');
        setCreditModalVisible(false);
        Alert.alert('Success', 'Shop credit balance updated successfully.');
    };

    const handleDeleteShop = (id: string) => {
        Alert.alert(
            "Delete Shop",
            "Are you sure you want to delete this shop? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const updated = shops.filter(s => s.id !== id);
                        await setShops(updated);
                        setShopsList(updated);
                    }
                }
            ]
        );
    };

    const renderShop = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.shopIconContainer}>
                    <Ionicons name="storefront" size={24} color="#3B82F6" />
                </View>
                <View style={styles.shopInfo}>
                    <Text style={styles.shopName}>{item.name}</Text>
                    {item.address ? <Text style={styles.shopDetail}><Ionicons name="location-outline" size={12} /> {item.address}</Text> : null}
                    {item.contact ? <Text style={styles.shopDetail}><Ionicons name="call-outline" size={12} /> {item.contact}</Text> : null}
                </View>
                <TouchableOpacity style={styles.deleteShopBtn} onPress={() => handleDeleteShop(item.id)}>
                    <Ionicons name="trash" size={20} color="#DC2626" />
                </TouchableOpacity>
            </View>

            <View style={styles.creditSection}>
                <View>
                    <Text style={styles.creditLabel}>Outstanding Debt</Text>
                    <Text style={[styles.creditValue, (item.creditBalance > 0) ? { color: '#EF4444' } : { color: '#10B981' }]}>
                        Rs {item.creditBalance || 0}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.updateCreditBtn}
                    onPress={() => {
                        setSelectedShop(item);
                        setCreditModalVisible(true);
                    }}
                >
                    <Text style={styles.updateCreditBtnText}>Manage Credit</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.topActionRow}>
                <View style={styles.searchSection}>
                    <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: isDark ? '#FFF' : '#111827' }]}
                        placeholder="Search shops by name..."
                        placeholderTextColor={isDark ? '#9CA3AF' : '#999'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <TouchableOpacity style={styles.mainAddButton} onPress={() => setAddModalVisible(true)}>
                    <Ionicons name="add" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={shops.filter(s =>
                    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (s.contact && s.contact.includes(searchQuery))
                )}
                keyExtractor={item => item.id}
                renderItem={renderShop}
                contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 100 }}
            />

            {/* ADD SHOP MODAL */}
            <Modal visible={isAddModalVisible} animationType="slide">
                <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50 }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Add Shop / Customer</Text>
                        <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                            <Ionicons name="close" size={28} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 16 }}>
                        <Text style={styles.label}>Shop Name *</Text>
                        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Sunil Stores" placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                        <Text style={styles.label}>Location / Address</Text>
                        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="e.g. 123 Main St, Colombo" placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                        <Text style={styles.label}>Contact Number (Optional)</Text>
                        <TextInput style={styles.input} value={contact} onChangeText={setContact} placeholder="071..." keyboardType="phone-pad" placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                        <Text style={styles.label}>Previous Debt / Credit Balance (Rs)</Text>
                        <TextInput style={styles.input} value={initialCredit} onChangeText={setInitialCredit} placeholder="0.00" keyboardType="numeric" placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                        <TouchableOpacity style={styles.saveButton} onPress={addShop}>
                            <Text style={styles.saveButtonText}>Save Shop</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>

            {/* MANAGE CREDIT MODAL */}
            <Modal visible={isCreditModalVisible} transparent={true} animationType="fade">
                <View style={styles.alertOverlay}>
                    <View style={styles.alertBox}>
                        <View style={styles.modalHeaderTransparent}>
                            <Text style={styles.modalTitle}>Manage Credit</Text>
                            <TouchableOpacity onPress={() => setCreditModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        {selectedShop && (
                            <Text style={styles.creditShopName}>{selectedShop.name}</Text>
                        )}
                        <Text style={styles.label}>Current Debt: Rs {selectedShop?.creditBalance || 0}</Text>

                        <Text style={[styles.label, { marginTop: 12 }]}>Amount (Rs)</Text>
                        <TextInput
                            style={styles.input}
                            value={creditUpdateAmount}
                            onChangeText={setCreditUpdateAmount}
                            placeholder="e.g. 5000"
                            placeholderTextColor={isDark ? '#9CA3AF' : '#999'}
                            keyboardType="numeric"
                            autoFocus
                        />

                        <View style={styles.actionRow}>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleUpdateCredit('add')}>
                                <Ionicons name="arrow-up" size={16} color="#FFF" style={{ marginRight: 4 }} />
                                <Text style={styles.actionBtnText}>Add Debt</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleUpdateCredit('pay')}>
                                <Ionicons name="arrow-down" size={16} color="#FFF" style={{ marginRight: 4 }} />
                                <Text style={styles.actionBtnText}>Pay Debt</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#111827' : '#EFF6FF' },

    topActionRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 16 },
    searchSection: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1F2937' : '#FFF', borderRadius: 12, paddingHorizontal: 12, height: 50, borderWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginRight: 10 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, color: isDark ? '#F9FAFB' : '#111827' },

    mainAddButton: {
        backgroundColor: '#2563EB',
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
    },

    card: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    shopIconContainer: { backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE', padding: 8, borderRadius: 10, marginRight: 12 },
    shopInfo: { flex: 1 },
    shopName: { fontSize: 18, fontWeight: '800', color: isDark ? '#F9FAFB' : '#111827' },
    shopContact: { fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 4 },
    shopDetail: { fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 3 },
    deleteShopBtn: { padding: 8, backgroundColor: isDark ? '#451a1a' : '#FEF2F2', borderRadius: 8 },

    creditSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? '#374151' : '#F9FAFB', padding: 12, borderRadius: 10, marginTop: 8 },
    creditLabel: { fontSize: 11, color: isDark ? '#D1D5DB' : '#6B7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    creditValue: { fontSize: 18, fontWeight: '900' },
    updateCreditBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    updateCreditBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },

    // Modal Add
    modalContainer: { flex: 1, backgroundColor: isDark ? '#1F2937' : '#FFF' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#1F2937' },
    label: { fontSize: 14, color: isDark ? '#D1D5DB' : '#374151', marginBottom: 6, fontWeight: '500' },
    input: { borderWidth: 1, borderColor: isDark ? '#4B5563' : '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16, backgroundColor: isDark ? '#374151' : '#FFF', color: isDark ? '#F9FAFB' : '#111827', width: '100%' },
    saveButton: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 8, marginTop: 24, alignItems: 'center', marginBottom: 40 },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

    // Credit Modals
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    alertBox: { width: '85%', backgroundColor: isDark ? '#1F2937' : '#FFF', borderRadius: 20, padding: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    modalHeaderTransparent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    creditShopName: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#60A5FA' : '#1D4ED8', marginBottom: 8 },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 8, marginHorizontal: 4 },
    actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});
