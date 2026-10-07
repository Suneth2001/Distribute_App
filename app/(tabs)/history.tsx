import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { getProducts, getShops, getTransactions, setProducts, setShops, setTransactions } from '../../src/store/database';

export default function HistoryScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);
    const insets = useSafeAreaInsets();

    const [transactions, setTransactionsList] = useState<any[]>([]);
    const [shops, setShopsList] = useState<any[]>([]);
    const [products, setProductsList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBill, setSelectedBill] = useState<any>(null);
    const [isDetailModalVisible, setDetailModalVisible] = useState(false);
    const [activeMonth, setActiveMonth] = useState<Date | null>(null);
    const [availableMonths, setAvailableMonths] = useState<Date[]>([]);
    
    // Return Item States
    const [isReturnModalVisible, setReturnModalVisible] = useState(false);
    const [returningItem, setReturningItem] = useState<any>(null);
    const [returnQty, setReturnQty] = useState('');

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        const t = await getTransactions();
        const s = await getShops();
        const p = await getProducts();
        
        // Calculate all unique months available in the data
        const monthMap = new Map();
        
        // Always include current month
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthMap.set(currentMonthStart.getTime(), currentMonthStart);

        t.forEach((tx: any) => {
            const d = new Date(tx.date);
            if (!isNaN(d.getTime())) {
                const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
                monthMap.set(startOfMonth.getTime(), startOfMonth);
            }
        });

        const sortedMonths = Array.from(monthMap.values()).sort((a, b) => b.getTime() - a.getTime());
        setAvailableMonths(sortedMonths);

        // Sort by date descending
        setTransactionsList(t.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setShopsList(s);
        setProductsList(p);
    };

    const handleReturnItem = (billId: string, item: any) => {
        setReturningItem({ ...item, billId });
        setReturnQty(item.qty.toString());
        setReturnModalVisible(true);
    };

    const processReturn = async (billId: string, itemToReturn: any, qty: number) => {
        try {
            if (qty <= 0 || qty > itemToReturn.qty) {
                Alert.alert("Error", "Invalid quantity for return.");
                return;
            }

            const allTxs = await getTransactions();
            const txIndex = allTxs.findIndex(t => t.id === billId);
            if (txIndex === -1) return;

            const transaction = allTxs[txIndex];
            
            // Calculate return values based on qty
            const unitPrice = itemToReturn.unitPrice || (itemToReturn.totalPrice / itemToReturn.qty);
            const unitCost = (itemToReturn.cost || 0) / itemToReturn.qty;
            
            const returnAmount = unitPrice * qty;
            const returnCost = unitCost * qty;

            const updatedItems = transaction.items.map((i: any) => {
                if (i.id === itemToReturn.id && !i.isReturned) {
                    if (qty === i.qty) {
                        return { ...i, isReturned: true };
                    } else {
                        return { 
                            ...i, 
                            qty: i.qty - qty, 
                            totalPrice: i.totalPrice - returnAmount,
                            cost: (i.cost || 0) - returnCost,
                            returnedQty: (i.returnedQty || 0) + qty
                        };
                    }
                }
                return i;
            });

            const updatedTx = { 
                ...transaction, 
                items: updatedItems,
                total: transaction.total - returnAmount,
                netTotal: transaction.netTotal - returnAmount,
                totalCost: (transaction.totalCost || 0) - returnCost,
                profit: transaction.profit - (returnAmount - returnCost)
            };

            allTxs[txIndex] = updatedTx;
            await setTransactions(allTxs);

            // 2. Update Shop Balance
            const allShops = await getShops();
            const shopIndex = allShops.findIndex(s => s.id === transaction.shopId);
            if (shopIndex !== -1) {
                allShops[shopIndex].creditBalance = (allShops[shopIndex].creditBalance || 0) - returnAmount;
                await setShops(allShops);
            }

            // 3. Update Stock
            const allProducts = await getProducts();
            const productIndex = allProducts.findIndex(p => p.id === itemToReturn.id);
            if (productIndex !== -1) {
                allProducts[productIndex].stock = (allProducts[productIndex].stock || 0) + qty;
                await setProducts(allProducts);
            }

            Alert.alert("Success", "Return processed successfully.");
            setReturnModalVisible(false);
            setDetailModalVisible(false);
            loadData();
        } catch (error) {
            Alert.alert("Error", "Could not process return.");
        }
    };

    const handleDeleteBill = (billId: string) => {
        Alert.alert(
            "Delete Old Bill",
            "Are you sure you want to permanently delete this old bill? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const allTxs = await getTransactions();
                            const updated = allTxs.filter((t: any) => t.id !== billId);
                            await setTransactions(updated);
                            
                            Alert.alert("Deleted", "Old bill successfully removed from history.");
                            setDetailModalVisible(false);
                            loadData();
                        } catch(error) {
                            Alert.alert("Error", "Could not delete the bill.");
                        }
                    }
                }
            ]
        );
    };

    const handleReprint = async (transaction: any) => {
        if (!transaction) return;

        const htmlLines = transaction.items.map((i: any, index: number) => `
          <tr>
            <td colspan="4" style="padding: 8px 0 2px 0; text-align: left; font-size: 38px; line-height: 1.1;">
                ${index + 1}. ${i.nameSinhala || i.nameEnglish}
            </td>
          </tr>
          <tr>
            <td style="padding: 0 0 12px 0; text-align: left; font-size: 34px; line-height: 1.0; font-weight: 700;">${i.qty}</td>
            <td style="padding: 0 0 12px 0; text-align: center; font-size: 34px; line-height: 1.0;">${parseFloat(i.marketPrice || i.unitPrice || 0).toFixed(2)}</td>
            <td style="padding: 0 0 12px 0; text-align: center; font-size: 34px; line-height: 1.0;">${parseFloat(i.unitPrice || 0).toFixed(2)}</td>
            <td style="padding: 0 0 12px 0; text-align: right; font-size: 34px; font-weight: 900; line-height: 1.0;">${parseFloat(i.totalPrice || 0).toFixed(2)}</td>
          </tr>
        `).join('');

        const discountAmt = transaction.discount || 0;
        const paid = transaction.paidAmount || 0;

        const html = `
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <style>
                  * { box-sizing: border-box; margin: 0; padding: 0; }
                  @page { size: auto; margin: 0; }
                  html, body {
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    color: #000;
                    font-family: sans-serif;
                    -webkit-print-color-adjust: exact;
                    line-height: 1.0;
                  }
                  body { text-align: center; padding: 0 4px; }
                  .header-title { font-size: 60px; font-weight: 900; margin: 5px 0 0 0; line-height: 1.0; }
                  .header-sub { font-size: 34px; margin: 4px 0; font-weight: 700; }
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
                    display: table-row-group !important; /* Prevents repeating header on page breaks */
                  }
                  .items-table thead tr { background-color: #333; color: #fff; }
                  .items-table th { padding: 12px 4px; font-weight: 900; font-size: 32px; text-align: center; color: #fff !important; }
                  .summary-table { width: 100%; font-size: 38px; text-align: left; margin: 25px 0; font-weight: 800; border-collapse: collapse; }
                  .summary-table td { padding: 8px 0; line-height: 1.1; }
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
              
              <table class="summary-table">
                <tr>
                  <td>මුළු එකතුව</td>
                  <td style="text-align: right;">රු. ${parseFloat(transaction.total).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>ගෙවූ මුදල</td>
                  <td style="text-align: right;">රු. ${paid.toFixed(2)}</td>
                </tr>
              </table>
              
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
            const continuousHeight = Math.max(700, 380 + (itemCount * 85) + 400);
            const { uri } = await Print.printToFileAsync({
                html,
                width: 560,
                height: continuousHeight,
            });
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Print Receipt with 4Barcode',
                UTI: 'com.adobe.pdf'
            });
        } catch (error) {
            Alert.alert('Print Error', 'Could not open print manager');
        }
    };

    const isOlderThan30Days = (dateStr: string) => {
        const billDate = new Date(dateStr).getTime();
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        return billDate < thirtyDaysAgo;
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              t.shopName.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!activeMonth) return matchesSearch;

        const tDate = new Date(t.date);
        return matchesSearch && 
               tDate.getMonth() === activeMonth.getMonth() && 
               tDate.getFullYear() === activeMonth.getFullYear();
    });

    const formatMonth = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    const renderTransaction = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={styles.card} 
            onPress={() => {
                setSelectedBill(item);
                setDetailModalVisible(true);
            }}
        >
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.billId}>#{item.id}</Text>
                    <Text style={styles.shopName}>{item.shopName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
                    <Text style={styles.amount}>Rs {item.total?.toFixed(2)}</Text>
                </View>
            </View>
            <View style={[styles.cardFooter, { justifyContent: 'space-between' }]}>
                <Text style={styles.itemCount}>{item.items.length} Items</Text>
                
                {isOlderThan30Days(item.date) ? (
                    <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5' }}
                        onPress={() => handleDeleteBill(item.id)}
                    >
                        <Ionicons name="trash" size={14} color="#EF4444" />
                        <Text style={{ color: '#EF4444', fontSize: 12, marginLeft: 6, fontWeight: 'bold' }}>Delete Old Bill</Text>
                    </TouchableOpacity>
                ) : (
                    <Ionicons name="chevron-forward" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.searchSection}>
                <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: isDark ? '#F9FAFB' : '#111827' }]}
                    placeholder="Search by Bill ID or Shop..."
                    placeholderTextColor={isDark ? '#9CA3AF' : '#999'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Month Filter Section */}
            <View style={styles.monthSelectorContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    <TouchableOpacity 
                        style={[styles.monthBtn, activeMonth === null && styles.monthBtnActive]}
                        onPress={() => setActiveMonth(null)}
                    >
                        <Text style={[styles.monthBtnText, activeMonth === null && styles.monthBtnTextActive]}>All</Text>
                    </TouchableOpacity>
                    
                    {availableMonths.map((m) => (
                        <TouchableOpacity
                            key={m.getTime()}
                            style={[
                                styles.monthBtn, 
                                activeMonth?.getTime() === m.getTime() && styles.monthBtnActive
                            ]}
                            onPress={() => setActiveMonth(m)}
                        >
                            <Text style={[
                                styles.monthBtnText, 
                                activeMonth?.getTime() === m.getTime() && styles.monthBtnTextActive
                            ]}>
                                {formatMonth(m)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredTransactions}
                keyExtractor={item => item.id}
                renderItem={renderTransaction}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={64} color={isDark ? '#374151' : '#D1D5DB'} />
                        <Text style={styles.emptyText}>No bills found.</Text>
                    </View>
                }
            />

            <Modal visible={isDetailModalVisible} animationType="slide">
                <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
                    <StatusBar style={isDark ? 'light' : 'dark'} />
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Bill Details</Text>
                        <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                            <Ionicons name="close" size={28} color={isDark ? '#FFF' : '#000'} />
                        </TouchableOpacity>
                    </View>

                    {selectedBill && (
                        <ScrollView contentContainerStyle={{ padding: 20 }}>
                            <View style={styles.detailHeader}>
                                <Text style={styles.detailId}>Bill #{selectedBill.id}</Text>
                                <Text style={styles.detailShop}>{selectedBill.shopName}</Text>
                                <Text style={styles.detailDate}>{new Date(selectedBill.date).toLocaleString()}</Text>
                            </View>

                            <View style={styles.itemsList}>
                                <Text style={styles.sectionTitle}>Items</Text>
                                {selectedBill.items.map((item: any) => (
                                    <View key={item.id} style={[styles.itemRow, item.isReturned && styles.returnedItem]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.itemName}>{item.nameSinhala || item.nameEnglish}</Text>
                                            <Text style={styles.itemStats}>{item.qty} x Rs {item.unitPrice?.toFixed(2)}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.itemTotal}>Rs {item.totalPrice?.toFixed(2)}</Text>
                                            {item.returnedQty && item.returnedQty > 0 && (
                                                <View style={styles.returnedLabel}>
                                                    <Ionicons name="refresh-circle" size={14} color="#EF4444" />
                                                    <Text style={styles.returnedText}>Returned {item.returnedQty}</Text>
                                                </View>
                                            )}
                                            {!item.isReturned ? (
                                                <TouchableOpacity 
                                                    style={styles.returnBtn} 
                                                    onPress={() => handleReturnItem(selectedBill.id, item)}
                                                >
                                                    <Text style={styles.returnBtnText}>Return Items</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={styles.returnedLabel}>
                                                    <Ionicons name="close-circle" size={14} color="#EF4444" />
                                                    <Text style={styles.returnedText}>Full Return</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.summarySection}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Sub Total</Text>
                                    <Text style={styles.summaryValue}>Rs {selectedBill.total?.toFixed(2)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Paid Amount</Text>
                                    <Text style={styles.summaryValue}>Rs {selectedBill.paidAmount?.toFixed(2)}</Text>
                                </View>
                                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#E5E7EB', paddingTop: 10, marginTop: 10 }]}>
                                    <Text style={styles.summaryTotalLabel}>Net Total</Text>
                                    <Text style={styles.summaryTotalValue}>Rs {selectedBill.total?.toFixed(2)}</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#10B981',
                                    paddingVertical: 14,
                                    borderRadius: 14,
                                    marginTop: 20,
                                    shadowColor: '#10B981',
                                    shadowOpacity: 0.3,
                                    shadowRadius: 5,
                                    elevation: 3
                                }}
                                onPress={() => handleReprint(selectedBill)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="print-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>Print Receipt (4Barcode)</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}

                    {/* Partial Return Modal (Nested for visibility) */}
                    <Modal visible={isReturnModalVisible} transparent animationType="fade">
                        <View style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }]}>
                            <View style={[styles.modalContent, { borderRadius: 24, padding: 24, maxHeight: 350 }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Return Quantity</Text>
                                    <TouchableOpacity onPress={() => setReturnModalVisible(false)}>
                                        <Ionicons name="close" size={24} color={isDark ? '#F9FAFB' : '#1F2937'} />
                                    </TouchableOpacity>
                                </View>
                                
                                <Text style={{ textAlign: 'center', marginBottom: 15, color: isDark ? '#9CA3AF' : '#6B7280' }}>
                                    How many units of {returningItem?.nameEnglish} would you like to return? (Max: {returningItem?.qty})
                                </Text>
                                
                                <TextInput
                                    style={[styles.input, { textAlign: 'center', fontSize: 24, fontWeight: '900', color: '#EF4444' }]}
                                    keyboardType="numeric"
                                    value={returnQty}
                                    onChangeText={setReturnQty}
                                    autoFocus
                                    selectTextOnFocus
                                />

                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                                    <TouchableOpacity 
                                        style={[styles.saveBtn, { flex: 1, marginTop: 0, backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}
                                        onPress={() => setReturnModalVisible(false)}
                                    >
                                        <Text style={[styles.saveBtnText, { color: isDark ? '#F9FAFB' : '#1F2937' }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.saveBtn, { flex: 1, marginTop: 0, backgroundColor: '#EF4444' }]}
                                        onPress={() => processReturn(returningItem.billId, returningItem, parseInt(returnQty))}
                                    >
                                        <Text style={styles.saveBtnText}>Confirm Return</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#111827' : '#F3F4F6' },
    searchSection: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1F2937' : '#FFF',
        margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, height: 50,
        borderWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB',
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    monthSelectorContainer: {
        marginBottom: 12,
    },
    monthBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        marginRight: 8,
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
    },
    monthBtnActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    monthBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: isDark ? '#9CA3AF' : '#6B7280',
    },
    monthBtnTextActive: {
        color: '#FFF',
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 16 },
    card: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        borderRadius: 16, padding: 16, marginBottom: 12,
        borderWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB',
        elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    billId: { fontSize: 13, color: '#3B82F6', fontWeight: 'bold' },
    shopName: { fontSize: 17, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827', marginTop: 2 },
    date: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280' },
    amount: { fontSize: 16, fontWeight: '900', color: isDark ? '#F9FAFB' : '#111827', marginTop: 4 },
    cardFooter: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#F3F4F6'
    },
    itemCount: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: 'bold' },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 12 },

    modalContainer: { flex: 1, backgroundColor: isDark ? '#111827' : '#FFFFFF' },
    modalHeader: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
        padding: 20, borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#E5E7EB',
        backgroundColor: isDark ? '#1F2937' : '#FFFFFF' 
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    detailHeader: { marginBottom: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#1F2937' : '#F3F4F6' },
    detailId: { fontSize: 16, color: '#3B82F6', fontWeight: 'bold', textAlign: 'center' },
    detailShop: { fontSize: 24, fontWeight: '900', color: isDark ? '#F9FAFB' : '#111827', marginVertical: 4, textAlign: 'center' },
    detailDate: { fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280', textAlign: 'center' },
    itemsList: { marginTop: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827', marginBottom: 16 },
    itemRow: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#F3F4F6'
    },
    returnedItem: { opacity: 0.6 },
    itemName: { fontSize: 16, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    itemStats: { fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 2 },
    itemTotal: { fontSize: 16, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    returnBtn: { 
        backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 4, 
        borderRadius: 6, marginTop: 8, borderWidth: 1, borderColor: '#FCA5A5' 
    },
    returnBtnText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },
    returnedLabel: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    returnedText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },

    summarySection: { 
        marginTop: 30, padding: 16, backgroundColor: isDark ? '#1F2937' : '#F9FAFB', 
        borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB' 
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    summaryLabel: { fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280' },
    summaryValue: { fontSize: 14, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    summaryTotalLabel: { fontSize: 16, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    summaryTotalValue: { fontSize: 20, fontWeight: '900', color: '#10B981' },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: 25, paddingBottom: 50
    },
    input: {
        backgroundColor: isDark ? '#111827' : '#F9FAFB',
        padding: 16, borderRadius: 15, borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        color: isDark ? '#F9FAFB' : '#111827', fontSize: 16
    },
    saveBtn: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 15, marginTop: 30, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
