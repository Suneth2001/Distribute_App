import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { generateId, getProducts, getShops, getTransactions, setTransactions } from '../../src/store/database';

export default function HomePOSScreen() {
    const [products, setProducts] = useState<any[]>([]);
    const [shops, setShops] = useState<any[]>([]);
    const [selectedShop, setSelectedShop] = useState<string | null>(null);
    const [cart, setCart] = useState<{ [key: string]: number }>({}); // { [productId]: quantity }
    const [customPrices, setCustomPrices] = useState<{ [key: string]: string }>({}); // { [productId]: overrides_price_string }
    const [searchQuery, setSearchQuery] = useState('');
    const [isShopModalVisible, setIsShopModalVisible] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        setIsRefreshing(true);
        const p = await getProducts();
        const s = await getShops();
        setProducts(p);
        setShops(s);
        if (s.length > 0 && !selectedShop) setSelectedShop(s[0].id);
        setIsRefreshing(false);
    };

    const getProductPrice = (product: any) => {
        // If there's a manual override, use it
        if (customPrices[product.id] !== undefined && customPrices[product.id] !== '') {
            return parseFloat(customPrices[product.id]) || 0;
        }
        if (!selectedShop) return product.defaultPrice;
        return product.shopPrices?.[selectedShop] || product.defaultPrice;
    };

    const addToCart = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        // B2B: Often products are sold even if database stock is inaccurate
        // if ((cart[productId] || 0) + 1 > product.stock) {
        //     Alert.alert('Stock Level', 'Not enough stock available');
        //     return;
        // }

        setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => {
            const newCart = { ...prev };
            if (newCart[productId] > 1) {
                newCart[productId] -= 1;
            } else {
                delete newCart[productId];

                // Clear custom price when totally removed from cart
                setCustomPrices(prevPrices => {
                    const newPrices = { ...prevPrices };
                    delete newPrices[productId];
                    return newPrices;
                });
            }
            return newCart;
        });
    };

    const deleteFromCart = (productId: string) => {
        setCart(prev => {
            const newCart = { ...prev };
            delete newCart[productId];

            setCustomPrices(prevPrices => {
                const newPrices = { ...prevPrices };
                delete newPrices[productId];
                return newPrices;
            });
            return newCart;
        });
    };

    const calculateTotals = () => {
        let total = 0;
        let cost = 0;
        Object.keys(cart).forEach((id: string) => {
            const p = products.find(prod => prod.id === id);
            if (p) {
                const qty = cart[id];
                const price = getProductPrice(p);
                total += price * qty;
                cost += p.baseCost * qty;
            }
        });
        return { total, cost, profit: total - cost };
    };

    const handleCheckout = async () => {
        if (Object.keys(cart).length === 0) {
            Alert.alert('Empty Cart', 'Please add items to sell.');
            return;
        }
        if (!selectedShop) {
            Alert.alert('Shop Missing', 'Please select a shop/destination.');
            return;
        }

        const { total, cost, profit } = calculateTotals();
        const shopDetail = shops.find(s => s.id === selectedShop);

        const transactionItems = Object.keys(cart).map((id: string) => {
            const p = products.find(prod => prod.id === id);
            return {
                id: p.id,
                name: p.name,
                qty: cart[id],
                unitPrice: getProductPrice(p),
                totalPrice: getProductPrice(p) * cart[id],
                cost: p.baseCost * cart[id]
            };
        });

        const newTransaction = {
            id: generateId(),
            date: new Date().toISOString(),
            type: 'sale',
            shopId: selectedShop,
            shopName: shopDetail?.name || 'Unknown',
            items: transactionItems,
            total,
            totalCost: cost,
            profit
        };

        const existing = await getTransactions();
        await setTransactions([...existing, newTransaction]);

        // Deduct Stock
        // Implementation of stock deduction could go here in a production app using setProducts
        printReceipt(newTransaction);
        setCart({}); // clear cart
        setCustomPrices({}); // clear overrides
    };

    const printReceipt = async (transaction: any) => {
        const htmlLines = transaction.items.map((i: any) => `
      <tr>
        <td style="padding: 4px; border-bottom: 1px dotted #ccc;">${i.name}</td>
        <td style="padding: 4px; border-bottom: 1px dotted #ccc;">${i.qty}</td>
        <td style="padding: 4px; border-bottom: 1px dotted #ccc; text-align: right;">Rs ${i.unitPrice}</td>
        <td style="padding: 4px; border-bottom: 1px dotted #ccc; text-align: right;">Rs ${i.totalPrice}</td>
      </tr>
    `).join('');

        const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        </head>
        <body style="font-family: monospace; text-align: center; padding: 20px;">
          <h2 style="margin: 0; padding: 0;">DISTRIBUTOR CO</h2>
          <p style="margin: 0; padding: 0;">Shop: ${transaction.shopName}</p>
          <p style="margin: 0; padding: 0; border-bottom: 1px dashed black;">Date: ${new Date(transaction.date).toLocaleString()}</p>
          <br/>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr>
                <td style="font-weight: bold; border-bottom: 1px solid black;">Item</td>
                <td style="font-weight: bold; border-bottom: 1px solid black;">Qty</td>
                <td style="font-weight: bold; border-bottom: 1px solid black; text-align: right;">Price</td>
                <td style="font-weight: bold; border-bottom: 1px solid black; text-align: right;">Total</td>
              </tr>
            </thead>
            <tbody>
              ${htmlLines}
            </tbody>
          </table>
          <br/>
          <div style="font-size: 18px; font-weight: bold; text-align: right; border-top: 1px dashed black; padding-top: 10px;">
            TOTAL: Rs ${transaction.total}
          </div>
          <br/>
          <p>Thank you for doing business with us!</p>
        </body>
      </html>
    `;

        try {
            await Print.printAsync({ html });
        } catch (error) {
            Alert.alert('Print Error', 'Could not open print manager');
        }
    };

    const { total } = calculateTotals();

    // Custom modern aesthetics
    return (
        <SafeAreaView style={styles.container}>


            <View style={styles.shopSelector}>
                <Text style={styles.selectorLabel}>Selling to Shop:</Text>
                <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setIsShopModalVisible(true)}
                >
                    <Text style={styles.dropdownButtonText}>
                        {shops.find(s => s.id === selectedShop)?.name || "Select a shop..."}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </TouchableOpacity>
            </View>

            <View style={{ zIndex: 10 }}>
                <View style={styles.searchSection}>
                    <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products to add..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {searchQuery.length > 0 && (
                    <ScrollView style={styles.searchResultsContainer} keyboardShouldPersistTaps="handled">
                        {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map(p => (
                            <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => {
                                if (!cart[p.id]) {
                                    addToCart(p.id);
                                }
                                setSearchQuery('');
                            }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.searchResultName}>{p.name}</Text>
                                    <Text style={styles.searchResultPrice}>Rs {getProductPrice(p)} | Stock: {p.stock}</Text>
                                </View>
                                <Ionicons name="add-circle" size={28} color="#10B981" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.headerText, { flex: 2 }]}>Product</Text>
                    <Text style={[styles.headerText, { flex: 1.2 }]}>Cost/Stk</Text>
                    <Text style={[styles.headerText, { flex: 1.5 }]}>Unit (Rs)</Text>
                    <Text style={[styles.headerText, { flex: 1.8, textAlign: 'right' }]}>Quantity</Text>
                </View>

                <FlatList
                    data={products.filter((p: any) => cart[p.id])}
                    keyExtractor={(p: any) => p.id}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        <View style={styles.emptyCartContainer}>
                            <Ionicons name="cart-outline" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyCartText}>Cart is empty. Search and add products to begin.</Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContainer}
                    refreshing={isRefreshing}
                    onRefresh={loadData}
                    renderItem={({ item }: { item: any }) => {
                        const qty = cart[item.id] || 0;

                        // Show standard price or current overridden value in the UI state
                        const displayPrice = getProductPrice(item);

                        return (
                            <View style={styles.tableRow}>
                                <View style={{ flex: 2, paddingRight: 4, justifyContent: 'center' }}>
                                    <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                                </View>

                                <View style={{ flex: 1.2, justifyContent: 'center' }}>
                                    <Text style={styles.cellText}>Rs {item.baseCost}</Text>
                                    <Text style={styles.subCellText}>{item.stock} in stock</Text>
                                </View>

                                <View style={{ flex: 1.5, justifyContent: 'center' }}>
                                    <View style={styles.priceInputContainer}>
                                        <Text style={styles.currencyPrefix}>Rs</Text>
                                        <TextInput
                                            style={styles.priceInputTable}
                                            value={customPrices[item.id] !== undefined ? String(customPrices[item.id]) : String(displayPrice)}
                                            onChangeText={(text) => {
                                                setCustomPrices(prev => ({ ...prev, [item.id]: text }));
                                            }}
                                            keyboardType="numeric"
                                            selectTextOnFocus
                                        />
                                    </View>
                                </View>

                                <View style={{ flex: 1.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                                    <TouchableOpacity style={styles.qtyButtonTable} onPress={() => removeFromCart(item.id)}>
                                        <Ionicons name="remove" size={16} color="#4B5563" />
                                    </TouchableOpacity>

                                    <TextInput
                                        style={styles.qtyInputTable}
                                        value={String(qty)}
                                        onChangeText={(text) => {
                                            const val = text.replace(/[^0-9]/g, '');
                                            setCart(prev => {
                                                const newCart = { ...prev };
                                                if (val === '' || val === '0') {
                                                    // Don't auto delete when they are just clearing the text box to type
                                                    newCart[item.id] = 0;
                                                } else {
                                                    newCart[item.id] = parseInt(val);
                                                }
                                                return newCart;
                                            });
                                        }}
                                        keyboardType="numeric"
                                        selectTextOnFocus
                                    />

                                    <TouchableOpacity style={styles.qtyButtonTable} onPress={() => addToCart(item.id)}>
                                        <Ionicons name="add" size={16} color="#4B5563" />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={{ marginLeft: 8 }} onPress={() => deleteFromCart(item.id)}>
                                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />
            </View>

            <View style={styles.cartFooter}>
                <View>
                    <Text style={styles.totalText}>Total: Rs {total}</Text>
                    <Text style={styles.itemsLabel}>{Object.keys(cart).length} Items</Text>
                </View>
                <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
                    <Ionicons name="print" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.checkoutText}>Print Bill</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={isShopModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsShopModalVisible(false)}
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsShopModalVisible(false)}>
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Shop</Text>
                            <TouchableOpacity onPress={() => setIsShopModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={shops}
                            keyExtractor={s => s.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.modalOption, selectedShop === item.id && styles.modalOptionActive]}
                                    onPress={() => {
                                        setSelectedShop(item.id);
                                        setCart({});
                                        setCustomPrices({});
                                        setIsShopModalVisible(false);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="storefront-outline" size={20} color={selectedShop === item.id ? "#1D4ED8" : "#6B7280"} style={{ marginRight: 12 }} />
                                        <Text style={[styles.modalOptionText, selectedShop === item.id && styles.modalOptionTextActive]}>
                                            {item.name}
                                        </Text>
                                    </View>
                                    {selectedShop === item.id && (
                                        <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: '#E5E7EB' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
    shopSelector: { padding: 12, backgroundColor: '#FFF', marginBottom: 8 },
    selectorLabel: { fontSize: 13, color: '#6B7280', marginBottom: 8, fontWeight: 'bold' },
    dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
    dropdownButtonText: { fontSize: 16, color: '#1F2937', fontWeight: '500' },

    // Modal Select
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#F3F4F6' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#F9FAFB' },
    modalOptionActive: { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE', borderWidth: 1 },
    modalOptionText: { fontSize: 16, color: '#4B5563', fontWeight: '500' },
    modalOptionTextActive: { color: '#1D4ED8', fontWeight: 'bold' },

    searchSection: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
        marginHorizontal: 12, marginBottom: 12, borderRadius: 8, paddingHorizontal: 12,
        borderWidth: 1, borderColor: '#D1D5DB', height: 48
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, color: '#1F2937' },

    searchResultsContainer: {
        backgroundColor: '#FFF', marginHorizontal: 12, marginBottom: 16, borderRadius: 8,
        borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 15,
        position: 'absolute', top: 52, left: 0, right: 0, zIndex: 100 // ensure overlay
    },
    searchResultItem: {
        flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: '#F3F4F6'
    },
    searchResultName: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
    searchResultPrice: { fontSize: 13, color: '#6B7280', marginTop: 2 },

    emptyCartContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
    emptyCartText: { fontSize: 16, color: '#9CA3AF', marginTop: 12, textAlign: 'center' },

    // --- Table Design Elements ---
    tableContainer: {
        flex: 1,
        backgroundColor: '#FFF',
        marginHorizontal: 12,
        marginBottom: 100, // accommodate bottom bar
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#3B82F6', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6,
        overflow: 'hidden'
    },
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 14,
        backgroundColor: '#2563EB',
        borderBottomWidth: 1,
        borderColor: '#1D4ED8',
    },
    headerText: {
        fontSize: 12,
        color: '#EFF6FF',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    listContainer: { paddingBottom: 20 },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
        marginVertical: 2
    },
    productName: { fontSize: 13, fontWeight: 'bold', color: '#1F2937' },
    cellText: { fontSize: 13, color: '#374151', fontWeight: 'bold' },
    subCellText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

    priceInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 6,
        backgroundColor: '#FFF',
        paddingHorizontal: 4,
        paddingVertical: 4,
        width: 75
    },
    currencyPrefix: { fontSize: 13, color: '#6B7280', marginRight: 4 },
    priceInputTable: {
        flex: 1, fontSize: 14, color: '#111827', fontWeight: 'bold', padding: 0
    },

    qtyInputTable: {
        borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 0,
        width: 36, fontSize: 13, color: '#111827', fontWeight: 'bold', backgroundColor: '#FFF', textAlign: 'center',
        marginHorizontal: 4
    },
    qtyButtonTable: {
        width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB'
    },

    cartFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderColor: '#E5E7EB', elevation: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
    totalText: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
    itemsLabel: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    checkoutButton: { backgroundColor: '#3B82F6', flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    checkoutText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
