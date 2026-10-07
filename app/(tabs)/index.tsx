import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { addTransaction, getNextBillNumber, getProducts, getShops, setShops as setShopsDb } from '../../src/store/database';

export default function HomePOSScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);
    const insets = useSafeAreaInsets();

    const [products, setProducts] = useState<any[]>([]);
    const [shops, setShops] = useState<any[]>([]);
    const [selectedShop, setSelectedShop] = useState<string | null>(null);
    const [cart, setCart] = useState<{ [key: string]: number }>({}); // { [productId]: quantity }
    const [cartOrder, setCartOrder] = useState<string[]>([]); // Keeps track of insertion order so latest items appear at the top
    const [customPrices, setCustomPrices] = useState<{ [key: string]: string }>({}); // { [productId]: overrides_price_string }
    const [searchQuery, setSearchQuery] = useState('');
    const [shopSearchQuery, setShopSearchQuery] = useState('');
    const [isShopModalVisible, setIsShopModalVisible] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Checkout State
    const [isCheckoutModalVisible, setCheckoutModalVisible] = useState(false);
    const [paidAmount, setPaidAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

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

        setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
        // Put the most recently added item at the top of the table list
        setCartOrder(prev => [productId, ...prev.filter(id => id !== productId)]);
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => {
            const newCart = { ...prev };
            if (newCart[productId] > 1) {
                newCart[productId] -= 1;
            } else {
                delete newCart[productId];
                setCartOrder(order => order.filter(id => id !== productId));

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
            setCartOrder(order => order.filter(id => id !== productId));

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
        let marketTotal = 0;
        Object.keys(cart).forEach((id: string) => {
            const p = products.find(prod => prod.id === id);
            if (p) {
                const qty = cart[id];
                const price = getProductPrice(p);
                total += price * qty;
                cost += p.baseCost * qty;
                marketTotal += (p.marketPrice || p.defaultPrice) * qty;
            }
        });
        return { total, cost, profit: total - cost, marketTotal };
    };

    const handleCheckoutPress = () => {
        if (Object.keys(cart).length === 0) {
            Alert.alert('Empty Cart', 'Please add items to sell.');
            return;
        }
        if (!selectedShop) {
            Alert.alert('Shop Missing', 'Please select a shop/destination.');
            return;
        }
        setPaidAmount(''); // Reset
        setCheckoutModalVisible(true);
    };

    const processCheckout = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const { total, cost, profit, marketTotal } = calculateTotals();
            const shopDetail = shops.find(s => s.id === selectedShop);

            const transactionItems = Object.keys(cart).map((id: string) => {
                const p = products.find(prod => prod.id === id);
                return {
                    id: p.id,
                    nameEnglish: p.nameEnglish,
                    nameSinhala: p.nameSinhala,
                    qty: cart[id],
                    unitPrice: getProductPrice(p),
                    totalPrice: getProductPrice(p) * cart[id],
                    marketPrice: p.marketPrice || p.defaultPrice,
                    cost: p.baseCost * cart[id]
                };
            });

            const discountAmt = marketTotal - total; // Market Price - Selling Price = Customer Discount
            const netTotal = total; // Net total added to shop debt is the total price
            const paid = parseFloat(paidAmount) || 0;
            const currentDebt = shopDetail?.creditBalance || 0;
            const newDebt = (currentDebt + netTotal) - paid;

            // Generate daily bill number fast
            const billNumber = await getNextBillNumber();

            const newTransaction = {
                id: billNumber,
                date: new Date().toISOString(),
                type: 'sale',
                shopId: selectedShop,
                shopName: shopDetail?.name || 'Unknown',
                items: transactionItems,
                total,
                discount: discountAmt,
                netTotal,
                totalCost: cost,
                profit: profit, // keep exact profit tracking
                paidAmount: paid
            };

            // Fast partition append into database
            await addTransaction(newTransaction);

            // Update Shop Credit
            const updatedShops = shops.map(s => {
                if (s.id === selectedShop) {
                    return { ...s, creditBalance: newDebt };
                }
                return s;
            });
            await setShopsDb(updatedShops); // Save to local storage database
            setShops(updatedShops); // Update React state

            // Clear cart & close modal immediately so UI is completely unblocked
            setCart({}); // clear cart
            setCartOrder([]);
            setCustomPrices({}); // clear overrides
            setPaidAmount('');
            setCheckoutModalVisible(false);

            // Print receipt asynchronously without freezing checkout flow
            setTimeout(() => {
                printReceipt(newTransaction, currentDebt, discountAmt, paid, newDebt, netTotal);
            }, 150);

        } catch (error: any) {
            console.error('Checkout error:', error);
            Alert.alert('Checkout Error', error?.message || 'Failed to complete transaction. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const printReceipt = async (transaction: any, currentDebt: number, discountAmt: number, paidAmt: number, newDebt: number, netTotal: number) => {
        const htmlLines = transaction.items.map((i: any, index: number) => `
      <tr>
        <td colspan="4" style="padding: 8px 0 2px 0; text-align: left;  font-size: 38px; line-height: 1.1;">
            ${index + 1}. ${i.nameSinhala || i.nameEnglish}
        </td>
      </tr>
      <tr>
        <td style="padding: 0 0 12px 0; text-align: left; font-size: 34px; line-height: 1.0; font-weight: 700;">${i.qty}</td>
        <td style="padding: 0 0 12px 0; text-align: center; font-size: 34px; line-height: 1.0;">${parseFloat(i.marketPrice).toFixed(2)}</td>
        <td style="padding: 0 0 12px 0; text-align: center; font-size: 34px; line-height: 1.0;">${parseFloat(i.unitPrice).toFixed(2)}</td>
        <td style="padding: 0 0 12px 0; text-align: right; font-size: 34px; font-weight: 900; line-height: 1.0;">${parseFloat(i.totalPrice).toFixed(2)}</td>
      </tr>
    `).join('');

        const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              @page {
                size: auto;
                margin: 0;
              }
              html, body {
                width: 100%;
                margin: 0;
                padding: 0;
                color: #000;
                font-family: sans-serif;
                -webkit-print-color-adjust: exact;
                line-height: 1.0;
              }
              body { 
                text-align: center; 
                padding: 0 4px;
              }
              .header-title { font-size: 60px; font-weight: 900; margin: 5px 0 0 0; padding: 0; line-height: 1.0; }
              .header-sub { font-size: 34px; margin: 4px 0; padding: 0; font-weight: 700; }
              .divider { border-bottom: 2px dashed #000; margin: 12px 0; }
              .solid-divider { border-bottom: 3px solid #000; margin: 12px 0; }
              
              .info-table { width: 100%; font-size: 34px; text-align: left; margin: 5px 0; font-weight: 700; border-collapse: collapse; }
              .info-table td { padding: 6px 0; line-height: 1.1; }
              
              .items-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
              .items-table thead, .items-table tbody, .items-table tr, .items-table td, .items-table th {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .items-table thead {
                display: table-row-group !important; /* Prevents browser repeating header on page breaks */
              }
              .items-table thead tr {
                background-color: #333;
                color: #fff;
              }
              .items-table th { 
                padding: 12px 4px; 
                font-weight: 900; 
                font-size: 32px; 
                text-align: center;
                line-height: 1.0;
                color: #fff !important; 
              }
              
              .summary-table { width: 100%; font-size: 38px; text-align: left; margin: 25px 0; font-weight: 800; border-collapse: collapse; }
              .summary-table td { padding: 8px 0; line-height: 1.1; }
              
              .profit-box { 
                text-align: center; 
                font-size: 48px; 
                font-weight: 900; 
                margin: 15px 0; 
                border: 4px solid #000;
                padding: 15px;
                border-radius: 12px;
                line-height: 1.2;
                width: 100%;
              }
              
              .footer { text-align: center; font-size: 34px; margin-top: 15px; line-height: 1.2; font-weight: 700; }
              .notice { font-size: 26px; font-weight: 800; margin: 10px 0; border-top: 2px solid #000; padding-top: 8px; }
              .brand { font-size: 22px; color: #333; margin-top: 12px; font-weight: normal; line-height: 1.1; }
          </style>
        </head>
        <body>
          <div class="header-title">Dilki Distributors</div>
          <div class="header-sub">Rathkarawwa, Maspotha</div>
          <div class="header-sub">072 3272457 / 076 1773163</div>
          
          <div class="divider"></div>
          
          <table class="info-table">
            <tr>
              <td>බිල් අංකය :</td>
              <td style="text-align: right;">${transaction.id}</td>
            </tr>
            <tr>
              <td>ගනුදෙනුකරු :</td>
              <td style="text-align: right;">${transaction.shopName}</td>
            </tr>
            <tr>
              <td>දිනය සහ වේලාව :</td>
              <td style="text-align: right;">${new Date(transaction.date).toLocaleString()}</td>
            </tr>
          </table>
          
          <div class="solid-divider"></div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left;">ප්‍රමාණය</th>
                <th style="text-align: center;">සඳහන් මිල</th>
                <th style="text-align: center;">අපේ මිල</th>
                <th style="text-align: right;">එකතුව</th>
              </tr>
            </thead>
            <tbody>
              ${htmlLines}
            </tbody>
          </table>
          
          <div class="divider"></div>
          
          <div style="font-size: 36px; text-align: left; margin: 12px 0; font-weight: 900; line-height: 1.0;">
            අයිතම සංඛ්‍යාව : ${transaction.items.length}
          </div>
          
          <table class="summary-table">
            ${currentDebt > 0 ? `
            <tr>
              <td>පෙර ණය</td>
              <td style="text-align: right;">රු. ${currentDebt.toFixed(2)}</td>
            </tr>` : ''}
            <tr>
              <td>මුළු එකතුව</td>
              <td style="text-align: right;">රු. ${parseFloat(transaction.total).toFixed(2)}</td>
            </tr>
            <tr>
              <td>ගෙවිය යුතු මුදල</td>
              <td style="text-align: right;">රු. ${(currentDebt + transaction.total).toFixed(2)}</td>
            </tr>
            <tr>
              <td>ගෙවූ මුදල</td>
              <td style="text-align: right;">රු. ${paidAmt.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="font-weight: 1000; font-size: 45px; border-top: 4px solid #000; padding-top: 12px; margin-top: 12px;">ණය මුදල</td>
              <td style="font-weight: 1000; font-size: 45px; text-align: right; border-top: 4px solid #000; padding-top: 12px; margin-top: 12px;">රු. ${newDebt.toFixed(2)}</td>
            </tr>
          </table>
          
          <div class="profit-box">
            ඔබ ලැබූ මුළු ලාභය<br/>
            රු. ${discountAmt.toFixed(2)}
          </div>
          
          <div class="solid-divider"></div>
          
          <div class="footer">
            <div class="notice">
                        ඔබගේ විශ්වාසයට ස්තූති!<br/>
            </div>
            <div class="brand">
              Develop & Designed by ZipZipy<br/>
              076 659 5714
            </div>
          </div>
        </body>
      </html>
    `;

        try {
            const itemCount = transaction.items?.length || 0;
            const continuousHeight = Math.max(700, 380 + (itemCount * 85) + 520);
            const { uri } = await Print.printToFileAsync({
                html,
                width: 560, // Optimized for thermal printers
                height: continuousHeight, // Single continuous strip (no page splits)
            });
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Print Receipt with 4Barcode',
                UTI: 'com.adobe.pdf'
            });
        } catch (error) {
            Alert.alert('Print Error', 'Could not open print / share manager');
        }
    };

    const { total } = calculateTotals();
    const selectedShopDetail = shops.find(s => s.id === selectedShop);
    const currentDebt = selectedShopDetail?.creditBalance || 0;

    // Custom modern aesthetics
    return (
        <View style={styles.container}>


            <View style={styles.shopSelector}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={styles.selectorLabel}>Selling to Shop:</Text>
                    {selectedShopDetail && (
                        <Text style={[styles.selectorLabel, (currentDebt > 0) ? { color: '#EF4444' } : { color: '#10B981' }]}>
                            Debt: Rs {currentDebt.toLocaleString()}
                        </Text>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setIsShopModalVisible(true)}
                >
                    <Text style={[styles.dropdownButtonText, { flex: 1 }]} numberOfLines={1}>
                        {selectedShopDetail?.name || "Select a shop..."}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {selectedShopDetail && (
                            <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 6,
                                backgroundColor: (currentDebt > 0)
                                    ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                                    : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5'),
                                marginRight: 8,
                            }}>
                                <Text style={{
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                    color: (currentDebt > 0) ? '#EF4444' : '#10B981'
                                }}>
                                    {(currentDebt > 0) ? `Rs ${currentDebt.toLocaleString()}` : 'Rs 0'}
                                </Text>
                            </View>
                        )}
                        <Ionicons name="chevron-down" size={20} color="#6B7280" />
                    </View>
                </TouchableOpacity>
            </View>

            <View style={{ zIndex: 10 }}>
                <View style={styles.searchSection}>
                    <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: isDark ? '#FFF' : '#111827' }]}
                        placeholder="Search products to add..."
                        placeholderTextColor={isDark ? '#9CA3AF' : '#999'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {searchQuery.length > 0 && (
                    <ScrollView style={styles.searchResultsContainer} keyboardShouldPersistTaps="handled">
                        {products.filter(p =>
                            (p.nameEnglish && p.nameEnglish.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (p.nameSinhala && p.nameSinhala.toLowerCase().includes(searchQuery.toLowerCase()))
                        ).slice(0, 10).map(p => (
                            <TouchableOpacity key={p.id} style={styles.searchResultItem} onPress={() => {
                                addToCart(p.id);
                                setSearchQuery('');
                            }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.searchResultName}>{p.nameEnglish}</Text>
                                    {p.nameSinhala ? <Text style={styles.searchResultSinhala}>{p.nameSinhala}</Text> : null}
                                    <Text style={styles.searchResultPrice}>Rs {getProductPrice(p)}</Text>
                                </View>
                                <Ionicons name="add-circle" size={28} color="#10B981" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            <View style={styles.tableContainer}>
                <View style={[styles.tableHeader, { paddingLeft: 16 }]}>
                    <Text style={[styles.headerText, { flex: 2 }]}>Product</Text>
                    <Text style={[styles.headerText, { flex: 1 }]}>MRP</Text>
                    <Text style={[styles.headerText, { flex: 1.2 }]}>Unit (Rs)</Text>
                    <Text style={[styles.headerText, { flex: 1.8, textAlign: 'right' }]}>Quantity</Text>
                </View>

                <FlatList
                    data={cartOrder
                        .map(id => products.find((p: any) => p.id === id))
                        .filter((p: any) => p && cart[p.id] !== undefined)}
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
                                    <Text style={styles.productName} numberOfLines={2}>
                                        {item.nameSinhala ? item.nameSinhala : item.nameEnglish}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <Text style={[styles.cellText, { textDecorationLine: 'line-through', color: '#9CA3AF' }]}>Rs {item.marketPrice || item.defaultPrice}</Text>
                                </View>

                                <View style={{ flex: 1.2, justifyContent: 'center' }}>
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
                                        <Ionicons name="remove" size={16} color={isDark ? '#F9FAFB' : '#4B5563'} />
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
                                        <Ionicons name="add" size={16} color={isDark ? '#F9FAFB' : '#4B5563'} />
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
                <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckoutPress}>
                    <Ionicons name="cart" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.checkoutText}>Checkout</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={isShopModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    setIsShopModalVisible(false);
                    setShopSearchQuery('');
                }}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => {
                        setIsShopModalVisible(false);
                        setShopSearchQuery('');
                    }}
                >
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Shop</Text>
                            <TouchableOpacity onPress={() => {
                                setIsShopModalVisible(false);
                                setShopSearchQuery('');
                            }}>
                                <Ionicons name="close" size={24} color={isDark ? "#9CA3AF" : "#6B7280"} />
                            </TouchableOpacity>
                        </View>

                        {/* Search shop inside modal */}
                        <View style={[styles.searchSection, { marginHorizontal: 0, marginBottom: 12, backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                            <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                            <TextInput
                                style={[styles.searchInput, { color: isDark ? '#FFF' : '#111827', fontSize: 14 }]}
                                placeholder="Search shop..."
                                placeholderTextColor={isDark ? '#9CA3AF' : '#999'}
                                value={shopSearchQuery}
                                onChangeText={setShopSearchQuery}
                            />
                            {shopSearchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setShopSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <FlatList
                            data={shops.filter(s =>
                                (s.name && s.name.toLowerCase().includes(shopSearchQuery.toLowerCase())) ||
                                (s.address && s.address.toLowerCase().includes(shopSearchQuery.toLowerCase()))
                            )}
                            keyExtractor={s => s.id}
                            keyboardShouldPersistTaps="handled"
                            ListEmptyComponent={
                                <Text style={{ textAlign: 'center', color: isDark ? '#9CA3AF' : '#6B7280', marginVertical: 20 }}>
                                    No shops found
                                </Text>
                            }
                            renderItem={({ item }) => {
                                const debt = item.creditBalance || 0;
                                const isSelected = selectedShop === item.id;
                                return (
                                    <TouchableOpacity
                                        style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                                        onPress={() => {
                                            setSelectedShop(item.id);
                                            setIsShopModalVisible(false);
                                            setShopSearchQuery('');
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                            <Ionicons
                                                name="storefront-outline"
                                                size={20}
                                                color={isSelected ? (isDark ? "#60A5FA" : "#1D4ED8") : (isDark ? "#94A3B8" : "#6B7280")}
                                                style={{ marginRight: 10 }}
                                            />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]} numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                {item.contact ? (
                                                    <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#6B7280', marginTop: 1 }}>
                                                        {item.contact}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 8,
                                                backgroundColor: debt > 0
                                                    ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                                                    : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5'),
                                                marginRight: isSelected ? 8 : 0,
                                            }}>
                                                <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: '700',
                                                    color: debt > 0 ? '#EF4444' : '#10B981',
                                                }}>
                                                    {debt > 0 ? `Debt: Rs ${debt.toLocaleString()}` : 'Rs 0'}
                                                </Text>
                                            </View>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={22} color="#3B82F6" />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Checkout Payment Modal */}

            <Modal
                visible={isCheckoutModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setCheckoutModalVisible(false)}
            >

                <View style={[styles.checkoutOverlay, { paddingTop: insets.top }]}>
                    <StatusBar style={isDark ? 'light' : 'dark'} />
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View style={styles.checkoutContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Complete Sale</Text>
                                <TouchableOpacity onPress={() => setCheckoutModalVisible(false)}>
                                    <Ionicons name="close" size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView keyboardShouldPersistTaps="handled">
                                <View style={styles.summaryBox}>
                                    <Text style={styles.summaryTitle}>{selectedShopDetail?.name}</Text>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Current Debt:</Text>
                                        <Text style={styles.summaryValue}>Rs {currentDebt}</Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>New Items Total:</Text>
                                        <Text style={styles.summaryValue}>+ Rs {total}</Text>
                                    </View>
                                    <View style={[styles.summaryRow, styles.summaryDivider]}>
                                        <Text style={[styles.summaryLabel, { fontWeight: 'bold' }]}>Total Amount Due:</Text>
                                        <Text style={[styles.summaryValue, { fontWeight: 'bold', fontSize: 18, color: '#1D4ED8' }]}>Rs {currentDebt + total}</Text>
                                    </View>
                                </View>

                                <Text style={styles.label}>Paid Amount (Rs) *</Text>
                                <TextInput
                                    style={[styles.input, { fontSize: 24, paddingVertical: 16 }]}
                                    value={paidAmount}
                                    onChangeText={setPaidAmount}
                                    placeholder="0"
                                    placeholderTextColor={isDark ? '#9CA3AF' : '#999'}
                                    keyboardType="numeric"
                                    autoFocus
                                />

                                <View style={styles.newDebtPreview}>
                                    <Text style={styles.newDebtLabel}>New Outstanding Debt</Text>
                                    <Text style={[styles.newDebtValue, ((currentDebt + total) - (parseFloat(paidAmount) || 0)) > 0 ? { color: '#EF4444' } : { color: '#10B981' }]}>
                                        Rs {(currentDebt + total) - (parseFloat(paidAmount) || 0)}
                                    </Text>
                                </View>

                                <TouchableOpacity 
                                    style={[styles.confirmCheckoutBtn, isProcessing && { opacity: 0.7 }]} 
                                    onPress={processCheckout}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <>
                                            <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.confirmCheckoutBtnText}>Processing Sale...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-done" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.confirmCheckoutBtnText}>Confirm & Print Bill</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#111827' : '#F3F4F6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: isDark ? '#1F2937' : '#FFF', alignItems: 'center', borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#1F2937' },
    shopSelector: { padding: 12, backgroundColor: isDark ? '#1F2937' : '#FFF', marginBottom: 8 },
    selectorLabel: { fontSize: 13, color: isDark ? '#D1D5DB' : '#6B7280', fontWeight: 'bold' },
    dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? '#374151' : '#F9FAFB', borderWidth: 1, borderColor: isDark ? '#4B5563' : '#D1D5DB', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
    dropdownButtonText: { fontSize: 16, color: isDark ? '#F9FAFB' : '#1F2937', fontWeight: '500' },

    // Modal Select
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: isDark ? '#1F2937' : '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#F3F4F6' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: isDark ? '#374151' : '#F9FAFB' },
    modalOptionActive: { backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE', borderColor: isDark ? '#1D4ED8' : '#BFDBFE', borderWidth: 1 },
    modalOptionText: { fontSize: 16, color: isDark ? '#D1D5DB' : '#4B5563', fontWeight: '500' },
    modalOptionTextActive: { color: isDark ? '#60A5FA' : '#1D4ED8', fontWeight: 'bold' },

    // Checkout Modal
    checkoutOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    checkoutContent: { backgroundColor: isDark ? '#1F2937' : '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    summaryBox: { backgroundColor: isDark ? '#374151' : '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: isDark ? '#4B5563' : '#E5E7EB' },
    summaryTitle: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827', marginBottom: 12 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    summaryLabel: { fontSize: 14, color: isDark ? '#D1D5DB' : '#4B5563' },
    summaryValue: { fontSize: 14, color: isDark ? '#F9FAFB' : '#111827', fontWeight: '600' },
    summaryDivider: { borderTopWidth: 1, borderColor: isDark ? '#4B5563' : '#D1D5DB', paddingTop: 8, marginTop: 4 },
    label: { fontSize: 14, color: isDark ? '#D1D5DB' : '#374151', marginBottom: 6, fontWeight: 'bold' },
    input: { borderWidth: 1, borderColor: isDark ? '#4B5563' : '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16, backgroundColor: isDark ? '#374151' : '#FFF', color: isDark ? '#FFF' : '#000' },
    newDebtPreview: { alignItems: 'center', marginVertical: 12, padding: 12, backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF', borderRadius: 8 },
    newDebtLabel: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', fontWeight: 'bold' },
    newDebtValue: { fontSize: 24, fontWeight: '900', marginTop: 4 },
    confirmCheckoutBtn: { backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 12 },
    confirmCheckoutBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

    searchSection: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1F2937' : '#FFF',
        marginHorizontal: 12, marginBottom: 12, borderRadius: 8, paddingHorizontal: 12,
        borderWidth: 1, borderColor: isDark ? '#374151' : '#D1D5DB', height: 48
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16, color: isDark ? '#F9FAFB' : '#1F2937' },

    searchResultsContainer: {
        backgroundColor: isDark ? '#374151' : '#FFF', marginHorizontal: 12, marginBottom: 16, borderRadius: 8,
        borderWidth: 1, borderColor: isDark ? '#4B5563' : '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 15,
        position: 'absolute', top: 52, left: 0, right: 0, zIndex: 100 // ensure overlay
    },
    searchResultItem: {
        flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: isDark ? '#4B5563' : '#F3F4F6'
    },
    searchResultName: { fontSize: 16, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#1F2937' },
    searchResultSinhala: { fontSize: 13, color: isDark ? '#D1D5DB' : '#374151' },
    searchResultPrice: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 },

    emptyCartContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
    emptyCartText: { fontSize: 16, color: isDark ? '#9CA3AF' : '#9CA3AF', marginTop: 12, textAlign: 'center' },

    // --- Table Design Elements ---
    tableContainer: {
        flex: 1,
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E2E8F0',
        shadowColor: '#3B82F6', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6,
        overflow: 'hidden'
    },
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 14,
        backgroundColor: isDark ? '#1E3A8A' : '#2563EB',
        borderBottomWidth: 1,
        borderColor: isDark ? '#1D4ED8' : '#1D4ED8',
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
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        borderBottomWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
        marginVertical: 2
    },
    productName: { fontSize: 13, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#1F2937' },
    productSinhalaName: { fontSize: 11, color: isDark ? '#D1D5DB' : '#4B5563' },
    cellText: { fontSize: 13, color: isDark ? '#D1D5DB' : '#374151', fontWeight: 'bold' },
    subCellText: { fontSize: 10, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2, fontStyle: 'italic' },

    priceInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: isDark ? '#4B5563' : '#D1D5DB',
        borderRadius: 6,
        backgroundColor: isDark ? '#374151' : '#FFF',
        paddingHorizontal: 4,
        paddingVertical: 4,
        width: 75
    },
    currencyPrefix: { fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280', marginRight: 4 },
    priceInputTable: {
        flex: 1, fontSize: 14, color: isDark ? '#F9FAFB' : '#111827', fontWeight: 'bold', padding: 0
    },

    qtyInputTable: {
        borderWidth: 1, borderColor: isDark ? '#4B5563' : '#D1D5DB', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 0,
        width: 36, fontSize: 13, color: isDark ? '#F9FAFB' : '#111827', fontWeight: 'bold', backgroundColor: isDark ? '#374151' : '#FFF', textAlign: 'center',
        marginHorizontal: 4
    },
    qtyButtonTable: {
        width: 26, height: 26, borderRadius: 13, backgroundColor: isDark ? '#4B5563' : '#F3F4F6',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#6B7280' : '#E5E7EB'
    },

    cartFooter: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4
    },
    totalText: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    itemsLabel: { fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 },
    checkoutButton: { backgroundColor: '#3B82F6', flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    checkoutText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
