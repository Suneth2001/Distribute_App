import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { getCategories, getProducts, getShops, setProducts } from '../../src/store/database';

export default function ProductsScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);

    const [products, setProductsList] = useState<any[]>([]);
    const [categories, setCategoriesList] = useState<any[]>([]);
    const [shops, setShopsList] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // New Product State
    const [productId, setProductId] = useState('');
    const [nameEnglish, setNameEnglish] = useState('');
    const [nameSinhala, setNameSinhala] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [baseCost, setBaseCost] = useState('');
    const [marketPrice, setMarketPrice] = useState('');
    const [defaultPrice, setDefaultPrice] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Custom Alert State
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'warning' | null }>({
        title: '',
        message: '',
        type: null
    });

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning') => {
        setAlertConfig({ title, message, type });
        setAlertVisible(true);
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const p = await getProducts();
        const c = await getCategories();
        const s = await getShops();
        setProductsList(p);
        setCategoriesList(c);
        setShopsList(s);
        if (c.length > 0) setCategoryId(c[0].id);
    };

    const saveProduct = async () => {
        if (!productId.trim()) {
            showAlert('Validation Error', 'Product ID / Code is required.', 'error');
            return;
        }
        if (!nameEnglish.trim()) {
            showAlert('Validation Error', 'English Name is required.', 'error');
            return;
        }
        if (!baseCost) {
            showAlert('Validation Error', 'Product Cost is required.', 'error');
            return;
        }
        if (!defaultPrice) {
            showAlert('Validation Error', 'Selling Price is required.', 'error');
            return;
        }

        if (!isEditing && products.some(p => p.id === productId.trim())) {
            showAlert('Duplicate ID', 'A product with this Product ID already exists. Please use a unique ID.', 'error');
            return;
        }

        const newProduct = {
            id: productId.trim(),
            nameEnglish,
            nameSinhala,
            categoryId,
            baseCost: parseFloat(baseCost),
            marketPrice: parseFloat(marketPrice) || parseFloat(defaultPrice),
            defaultPrice: parseFloat(defaultPrice)
        };

        if (isEditing) {
            const updated = products.map(p => p.id === productId.trim() ? newProduct : p);
            await setProducts(updated);
            setProductsList(updated);
            setModalVisible(false);
            setTimeout(() => {
                showAlert('Success', 'Product has been updated!', 'success');
            }, 300);
            return;
        }

        const updated = [...products, newProduct];
        await setProducts(updated);
        setProductsList(updated);
        setModalVisible(false);

        setTimeout(() => {
            showAlert('Success', 'Product has been successfully saved to the database!', 'success');
        }, 300); // slight delay so the form modal closing doesn't clash with alert modal opening
    };

    const resetForm = () => {
        setProductId('');
        setNameEnglish('');
        setNameSinhala('');
        setBaseCost('');
        setMarketPrice('');
        setDefaultPrice('');
        setIsEditing(false);
    };

    const handleAddClick = () => {
        resetForm();

        let nextNum = 1;
        if (products.length > 0) {
            const numIds = products.map(p => {
                const match = p.id.match(/^PID-(\d+)$/i);
                return match ? parseInt(match[1], 10) : 0;
            }).filter(n => !isNaN(n));

            if (numIds.length > 0) {
                nextNum = Math.max(...numIds) + 1;
            }
        }
        setProductId(`PID-${nextNum.toString().padStart(3, '0')}`);
        setModalVisible(true);
    };

    const handleEditClick = (item: any) => {
        setProductId(item.id);
        setNameEnglish(item.nameEnglish);
        setNameSinhala(item.nameSinhala || '');
        setBaseCost(item.baseCost ? String(item.baseCost) : '');
        setMarketPrice(item.marketPrice ? String(item.marketPrice) : '');
        setDefaultPrice(item.defaultPrice ? String(item.defaultPrice) : '');
        setIsEditing(true);
        setModalVisible(true);
    };

    const handleDeleteClick = (id: string) => {
        Alert.alert(
            "Delete Product",
            "Are you sure you want to delete this product?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const updated = products.filter(p => p.id !== id);
                        await setProducts(updated);
                        setProductsList(updated);
                    }
                }
            ]
        );
    };

    const renderProduct = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconWrapper}>
                    <Ionicons name="cube" size={24} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{item.nameEnglish} <Text style={styles.productIdText}>(#{item.id})</Text></Text>
                    {item.nameSinhala ? <Text style={styles.sinhalaName}>{item.nameSinhala}</Text> : null}
                </View>
            </View>

            <View style={styles.priceRow}>
                <View style={styles.priceData}>
                    <Text style={styles.priceLabel}>Base Cost</Text>
                    <Text style={styles.priceValue}>Rs {item.baseCost}</Text>
                </View>
                <View style={styles.priceData}>
                    <Text style={styles.priceLabel}>Market Price</Text>
                    <Text style={[styles.priceValue, { color: isDark ? '#F59E0B' : '#D97706' }]}>Rs {item.marketPrice || item.defaultPrice}</Text>
                </View>
                <View style={styles.priceData}>
                    <Text style={styles.priceLabel}>Selling Price</Text>
                    <Text style={[styles.priceValue, { color: isDark ? '#60A5FA' : '#1D4ED8' }]}>Rs {item.defaultPrice}</Text>
                </View>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEditClick(item)}>
                    <Ionicons name="pencil" size={16} color={isDark ? '#F9FAFB' : '#4B5563'} />
                    <Text style={styles.actionBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteClick(item.id)}>
                    <Ionicons name="trash" size={16} color={isDark ? '#FCA5A5' : '#DC2626'} />
                    <Text style={[styles.actionBtnText, { color: isDark ? '#FCA5A5' : '#DC2626' }]}>Delete</Text>
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
                        placeholder="Search products..."
                        placeholderTextColor={isDark ? '#9CA3AF' : '#999'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <TouchableOpacity style={styles.addButton} onPress={handleAddClick}>
                    <Ionicons name="add" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={products.filter(p =>
                    p.nameEnglish.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.nameSinhala && p.nameSinhala.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    p.id.toLowerCase().includes(searchQuery.toLowerCase())
                )}
                keyExtractor={item => item.id}
                renderItem={renderProduct}
                contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 100 }}
            />

            <Modal visible={modalVisible} animationType="slide">
                <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50 }]}>
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Product' : 'Add Product'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={28} color={isDark ? '#F9FAFB' : '#333'} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                            <Text style={styles.label}>Product ID / Code (Auto-Generated)</Text>
                            <TextInput style={[styles.input, { backgroundColor: isDark ? '#374151' : '#F3F4F6', color: isDark ? '#9CA3AF' : '#9CA3AF' }]} value={productId} editable={false} />

                            <Text style={styles.label}>Product Name (English)</Text>
                            <TextInput style={styles.input} value={nameEnglish} onChangeText={setNameEnglish} placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                            <Text style={styles.label}>Product Name (Sinhala)</Text>
                            <TextInput style={styles.input} value={nameSinhala} onChangeText={setNameSinhala} placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                            <Text style={styles.label}>Product Cost (Rs)</Text>
                            <TextInput style={styles.input} value={baseCost} onChangeText={setBaseCost} keyboardType="numeric" placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                            <Text style={styles.label}>Market Price / Printed Price (Rs)</Text>
                            <TextInput style={styles.input} value={marketPrice} onChangeText={setMarketPrice} keyboardType="numeric" placeholder="e.g 300" placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                            <Text style={styles.label}>Default Selling Price (Rs)</Text>
                            <TextInput style={styles.input} value={defaultPrice} onChangeText={setDefaultPrice} keyboardType="numeric" placeholderTextColor={isDark ? '#9CA3AF' : '#999'} />

                            <TouchableOpacity style={styles.saveButton} onPress={saveProduct}>
                                <Text style={styles.saveButtonText}>{isEditing ? 'Update Product' : 'Save Product'}</Text>
                            </TouchableOpacity>

                            {/* extra space for keyboard scrolling */}
                            <View style={{ height: 40 }} />
                        </ScrollView>

                        {/* Sweet Alert Overlay IN-MODAL for Error Validations */}
                        {alertVisible && alertConfig.type !== 'success' && (
                            <View style={styles.inModalAlertOverlay}>
                                <View style={styles.alertBox}>
                                    <View style={[styles.alertIconCircle, { backgroundColor: '#FEE2E2' }]}>
                                        <Ionicons name="close" size={40} color="#EF4444" />
                                    </View>
                                    <Text style={styles.alertTitle}>{alertConfig.title}</Text>
                                    <Text style={styles.alertMessage}>{alertConfig.message}</Text>
                                    <TouchableOpacity
                                        style={[styles.alertButton, { backgroundColor: '#EF4444' }]}
                                        onPress={() => setAlertVisible(false)}
                                    >
                                        <Text style={styles.alertButtonText}>OK</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Custom Sweet Alert for Success (Outside Modal) */}
            <Modal visible={alertVisible && alertConfig.type === 'success'} transparent={true} animationType="fade">
                <View style={styles.alertOverlay}>
                    <View style={styles.alertBox}>
                        <View style={[styles.alertIconCircle, alertConfig.type === 'success' ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons
                                name={alertConfig.type === 'success' ? 'checkmark' : 'close'}
                                size={40}
                                color={alertConfig.type === 'success' ? '#10B981' : '#EF4444'}
                            />
                        </View>
                        <Text style={styles.alertTitle}>{alertConfig.title}</Text>
                        <Text style={styles.alertMessage}>{alertConfig.message}</Text>
                        <TouchableOpacity
                            style={[styles.alertButton, alertConfig.type === 'success' ? { backgroundColor: '#10B981' } : { backgroundColor: '#EF4444' }]}
                            onPress={() => setAlertVisible(false)}
                        >
                            <Text style={styles.alertButtonText}>OK</Text>
                        </TouchableOpacity>
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

    addButton: {
        backgroundColor: '#2563EB',
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
    },
    addButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    card: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconWrapper: { backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE', padding: 8, borderRadius: 10, marginRight: 12 },
    productName: { fontSize: 18, fontWeight: '800', color: isDark ? '#F9FAFB' : '#111827' },
    productIdText: { fontSize: 14, fontWeight: 'normal', color: isDark ? '#9CA3AF' : '#6B7280' },
    sinhalaName: { fontSize: 14, color: isDark ? '#D1D5DB' : '#4B5563', marginTop: 2 },

    priceRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: isDark ? '#374151' : '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 10 },
    priceData: { flex: 1 },
    priceLabel: { fontSize: 11, color: isDark ? '#D1D5DB' : '#6B7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    priceValue: { fontSize: 16, fontWeight: '900', color: isDark ? '#F9FAFB' : '#1F2937' },

    actionRow: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderColor: isDark ? '#374151' : '#F3F4F6', paddingTop: 12, marginTop: 4 },
    editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#374151' : '#F3F4F6', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 20, marginRight: 12 },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#451a1a' : '#FEF2F2', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 20 },
    actionBtnText: { marginLeft: 6, fontWeight: '700', color: isDark ? '#F9FAFB' : '#4B5563' },

    modalContainer: { flex: 1, backgroundColor: isDark ? '#1F2937' : '#FFF' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#1F2937' },
    label: { fontSize: 14, color: isDark ? '#D1D5DB' : '#374151', marginBottom: 6, fontWeight: '500' },
    input: { borderWidth: 1, borderColor: isDark ? '#4B5563' : '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16, backgroundColor: isDark ? '#374151' : '#FFF', color: isDark ? '#F9FAFB' : '#111827' },
    saveButton: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 8, marginTop: 24, alignItems: 'center', marginBottom: 40 },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

    // Sweet Alert Styles
    alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    inModalAlertOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    alertBox: { width: '80%', backgroundColor: isDark ? '#1F2937' : '#FFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    alertIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    alertTitle: { fontSize: 22, fontWeight: '900', color: isDark ? '#F9FAFB' : '#111827', marginBottom: 8, textAlign: 'center' },
    alertMessage: { fontSize: 15, color: isDark ? '#D1D5DB' : '#4B5563', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    alertButton: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center' },
    alertButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
