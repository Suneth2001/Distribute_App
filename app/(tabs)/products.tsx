import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { generateId, getCategories, getProducts, getShops, setProducts } from '../../src/store/database';

export default function ProductsScreen() {
    const [products, setProductsList] = useState<any[]>([]);
    const [categories, setCategoriesList] = useState<any[]>([]);
    const [shops, setShopsList] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    // New Product State
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [baseCost, setBaseCost] = useState('');
    const [defaultPrice, setDefaultPrice] = useState('');
    const [stock, setStock] = useState('');
    const [shopPrices, setProductShopPrices] = useState<{ [key: string]: string }>({}); // { shopId: price_string }

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
        if (!name || !baseCost || !defaultPrice) {
            Alert.alert('Error', 'Please fill name, cost, and default price');
            return;
        }
        const newProduct = {
            id: generateId(),
            name,
            categoryId,
            baseCost: parseFloat(baseCost),
            defaultPrice: parseFloat(defaultPrice),
            stock: parseInt(stock || '0'),
            shopPrices: Object.keys(shopPrices).reduce((acc: { [key: string]: number }, key: string) => {
                if (shopPrices[key]) acc[key] = parseFloat(shopPrices[key]);
                return acc;
            }, {})
        };

        const updated = [...products, newProduct];
        await setProducts(updated);
        setProductsList(updated);
        setModalVisible(false);
        resetForm();
    };

    const resetForm = () => {
        setName('');
        setBaseCost('');
        setDefaultPrice('');
        setStock('');
        setProductShopPrices({});
    };

    const handleShopPriceChange = (shopId: string, value: string) => {
        setProductShopPrices(prev => ({ ...prev, [shopId]: value }));
    };

    const renderProduct = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconWrapper}>
                    <Ionicons name="cube" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.productName}>{item.name}</Text>
                <View style={[styles.stockBadge, { backgroundColor: item.stock > 0 ? '#D1FAE5' : '#FEE2E2' }]}>
                    <Text style={[styles.stockBadgeText, { color: item.stock > 0 ? '#059669' : '#DC2626' }]}>
                        {item.stock} in stock
                    </Text>
                </View>
            </View>

            <View style={styles.priceRow}>
                <View style={styles.priceData}>
                    <Text style={styles.priceLabel}>Base Cost</Text>
                    <Text style={styles.priceValue}>Rs {item.baseCost}</Text>
                </View>
                <View style={styles.priceData}>
                    <Text style={styles.priceLabel}>Default Selling Price</Text>
                    <Text style={[styles.priceValue, { color: '#1D4ED8' }]}>Rs {item.defaultPrice}</Text>
                </View>
            </View>

            {Object.keys(item.shopPrices || {}).length > 0 && (
                <View style={styles.shopPricesContainer}>
                    <Text style={styles.shopPricesTitle}>Custom Wholesale Rates</Text>
                    {Object.entries(item.shopPrices).map(([shopId, price]) => {
                        const shop = shops.find(s => s.id === shopId);
                        return (
                            <View key={shopId} style={styles.shopPriceItem}>
                                <Text style={styles.shopPriceTextName}>{shop?.name || shopId}</Text>
                                <Text style={styles.shopPriceTextVal}>Rs {String(price)}</Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                <Ionicons name="add" size={24} color="#FFF" />
                <Text style={styles.addButtonText}>Add New Product</Text>
            </TouchableOpacity>

            <FlatList
                data={products}
                keyExtractor={item => item.id}
                renderItem={renderProduct}
                contentContainerStyle={{ padding: 16 }}
            />

            <Modal visible={modalVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Add Product</Text>
                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                            <Ionicons name="close" size={28} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 16 }}>
                        <Text style={styles.label}>Product Name</Text>
                        <TextInput style={styles.input} value={name} onChangeText={setName} />

                        <Text style={styles.label}>Product Cost (Rs)</Text>
                        <TextInput style={styles.input} value={baseCost} onChangeText={setBaseCost} keyboardType="numeric" />

                        <Text style={styles.label}>Default Selling Price (Rs)</Text>
                        <TextInput style={styles.input} value={defaultPrice} onChangeText={setDefaultPrice} keyboardType="numeric" />

                        <Text style={styles.label}>Initial Stock</Text>
                        <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="numeric" />

                        <Text style={styles.sectionTitle}>Custom Shop Prices</Text>
                        <Text style={styles.subtext}>Leave empty to use default price</Text>

                        {shops.map(shop => (
                            <View key={shop.id} style={styles.shopPriceInputRow}>
                                <Text style={styles.shopNameText}>{shop.name}</Text>
                                <TextInput
                                    style={styles.shopPriceInput}
                                    placeholder={"Rs " + defaultPrice}
                                    value={shopPrices[shop.id] || ''}
                                    onChangeText={val => handleShopPriceChange(shop.id, val)}
                                    keyboardType="numeric"
                                />
                            </View>
                        ))}

                        <TouchableOpacity style={styles.saveButton} onPress={saveProduct}>
                            <Text style={styles.saveButtonText}>Save Product</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#EFF6FF' },
    addButton: {
        backgroundColor: '#2563EB',
        flexDirection: 'row',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
    },
    addButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    card: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconWrapper: { backgroundColor: '#DBEAFE', padding: 8, borderRadius: 10, marginRight: 12 },
    productName: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1 },
    stockBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    stockBadgeText: { fontWeight: 'bold', fontSize: 12 },

    priceRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10 },
    priceData: { flex: 1 },
    priceLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    priceValue: { fontSize: 16, fontWeight: '900', color: '#1F2937' },

    shopPricesContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: '#F3F4F6' },
    shopPricesTitle: { fontSize: 13, fontWeight: 'bold', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 },
    shopPriceItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, paddingVertical: 4 },
    shopPriceTextName: { fontSize: 14, color: '#374151', fontWeight: '600' },
    shopPriceTextVal: { fontSize: 14, color: '#059669', fontWeight: '800' },

    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#E5E7EB' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
    label: { fontSize: 14, color: '#374151', marginBottom: 6, fontWeight: '500' },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginTop: 10, marginBottom: 4 },
    subtext: { fontSize: 12, color: '#6B7280', marginBottom: 16 },
    shopPriceInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    shopNameText: { flex: 1, fontSize: 14, color: '#374151' },
    shopPriceInput: { width: 100, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, padding: 8, textAlign: 'right' },
    saveButton: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 8, marginTop: 24, alignItems: 'center', marginBottom: 40 },
    saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
