import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { getExpenses, getTransactions } from '../../src/store/database';

export default function SummaryScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);

    const [sales, setSales] = useState(0);
    const [costs, setCosts] = useState(0);
    const [expenses, setExpensesState] = useState(0);
    const [topItems, setTopItems] = useState<any[]>([]);
    const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        setRefreshing(true);
        const trans = await getTransactions();
        const exps = await getExpenses();

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Calculate start of week (Sunday)
        const tempDate = new Date(now);
        const diff = tempDate.getDate() - tempDate.getDay();
        const startOfWeek = new Date(tempDate.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const filteredTrans = trans.filter(t => {
            const tDate = new Date(t.date);
            if (filter === 'today') return tDate >= startOfDay;
            if (filter === 'week') return tDate >= startOfWeek;
            if (filter === 'month') return tDate >= startOfMonth;
            return true;
        });

        const filteredExps = exps.filter(e => {
            const eDate = new Date(e.date);
            if (filter === 'today') return eDate >= startOfDay;
            if (filter === 'week') return eDate >= startOfWeek;
            if (filter === 'month') return eDate >= startOfMonth;
            return true;
        });

        let tSales = 0;
        let tCosts = 0;
        const itemMap: { [key: string]: { name: string, qty: number, total: number } } = {};

        filteredTrans.forEach(t => {
            tSales += typeof t.total === 'number' ? t.total : (parseFloat(t.total) || 0);
            tCosts += typeof t.totalCost === 'number' ? t.totalCost : (parseFloat(t.totalCost) || 0);

            const itemsList = Array.isArray(t.items) ? t.items : (Array.isArray(t.products) ? t.products : []);
            itemsList.forEach((item: any) => {
                if (item.isReturned) return; // Skip returned items
                const id = item.id || item.productId || item.nameEnglish || 'unknown';
                if (!itemMap[id]) {
                    itemMap[id] = { name: item.nameEnglish || item.name || item.title || 'Product', qty: 0, total: 0 };
                }
                const q = typeof item.qty === 'number' ? item.qty : (parseFloat(item.qty) || 0);
                const tot = typeof item.totalPrice === 'number' ? item.totalPrice : (parseFloat(item.totalPrice) || 0);
                itemMap[id].qty += q;
                itemMap[id].total += tot;
            });
        });

        const sortedItems = Object.values(itemMap)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        let tExp = 0;
        filteredExps.forEach(e => {
            tExp += e.amount;
        });

        setSales(tSales);
        setCosts(tCosts);
        setExpensesState(tExp);
        setTopItems(sortedItems);
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [filter])
    );

    const profitFromGoods = sales - costs;
    const netProfit = profitFromGoods - expenses;

    const screenWidth = Dimensions.get("window").width;

    const chartConfig = {
        backgroundGradientFrom: isDark ? "#1F2937" : "#1E293B",
        backgroundGradientTo: isDark ? "#111827" : "#0F172A",
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.6,
        useShadowColorFromDataset: false
    };

    const pieData = [
        { name: "Costs", population: costs, color: "#F59E0B", legendFontColor: isDark ? "#9CA3AF" : "#4B5563", legendFontSize: 12 },
        { name: "Expenses", population: expenses, color: "#EF4444", legendFontColor: isDark ? "#9CA3AF" : "#4B5563", legendFontSize: 12 },
        { name: "Profit", population: Math.max(0, netProfit), color: "#10B981", legendFontColor: isDark ? "#9CA3AF" : "#4B5563", legendFontSize: 12 }
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Financial Summary</Text>
                <Text style={styles.headerSubtitle}>Overview of all recorded transactions</Text>
            </View>

            {/* Filter Section */}
            <View style={styles.filterContainer}>
                {(['today', 'week', 'month', 'all'] as const).map((f) => (
                    <TouchableOpacity
                        key={f}
                        style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Quick Stats Grid */}
            <View style={styles.statsGrid}>
                <View style={[styles.gridCard, { borderTopColor: '#3B82F6', borderTopWidth: 4 }]}>
                    <Text style={styles.gridLabel}>Revenue</Text>
                    <Text style={[styles.gridValue, { color: isDark ? '#60A5FA' : '#1D4ED8' }]}>Rs {sales.toFixed(2)}</Text>
                </View>
                <View style={[styles.gridCard, { borderTopColor: '#F59E0B', borderTopWidth: 4 }]}>
                    <Text style={styles.gridLabel}>Costs</Text>
                    <Text style={[styles.gridValue, { color: isDark ? '#FBBF24' : '#B45309' }]}>Rs {costs.toFixed(2)}</Text>
                </View>
                <View style={[styles.gridCard, { borderTopColor: '#EF4444', borderTopWidth: 4 }]}>
                    <Text style={styles.gridLabel}>Expenses</Text>
                    <Text style={[styles.gridValue, { color: isDark ? '#F87171' : '#B91C1C' }]}>Rs {expenses.toFixed(2)}</Text>
                </View>
                <View style={[styles.gridCard, { borderTopColor: netProfit >= 0 ? '#10B981' : '#EF4444', borderTopWidth: 4 }]}>
                    <Text style={styles.gridLabel}>Net Profit</Text>
                    <Text style={[styles.gridValue, { color: netProfit >= 0 ? (isDark ? '#34D399' : '#047857') : (isDark ? '#F87171' : '#B91C1C') }]}>
                        Rs {netProfit.toFixed(2)}
                    </Text>
                </View>
            </View>

            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Business Breakdown</Text>
                <PieChart
                    data={pieData}
                    width={screenWidth - 32}
                    height={200}
                    chartConfig={chartConfig}
                    accessor={"population"}
                    backgroundColor={"transparent"}
                    paddingLeft={"15"}
                    absolute
                />
            </View>

            {/* Top Items List */}
            <View style={styles.topItemsContainer}>
                <Text style={styles.chartTitle}>Top 5 Selling Items</Text>
                {topItems.length > 0 ? topItems.map((item, index) => (
                    <View key={index} style={styles.topItemRow}>
                        <View style={styles.itemRank}>
                            <Text style={styles.rankText}>{index + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemSubText}>{item.qty} units sold</Text>
                        </View>
                        <Text style={styles.itemTotal}>Rs {item.total.toFixed(0)}</Text>
                    </View>
                )) : (
                    <Text style={{ textAlign: 'center', color: isDark ? '#9CA3AF' : '#6B7280', marginVertical: 20 }}>No items sold in this period</Text>
                )}
            </View>

            <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>Revenue vs Profit Analysis</Text>
                    <View style={[styles.statusBadge, { backgroundColor: netProfit > 0 ? '#D1FAE5' : '#FEE2E2' }]}>
                        <Text style={[styles.statusText, { color: netProfit > 0 ? '#065F46' : '#991B1B' }]}>
                            {netProfit > 0 ? 'Healthy' : 'Action Needed'}
                        </Text>
                    </View>
                </View>

                <View style={styles.insightBox}>
                    <Ionicons name="trending-up" size={16} color="#3B82F6" />
                    <Text style={styles.insightText}>
                        Net Margin: <Text style={{ fontWeight: 'bold' }}>{sales > 0 ? ((netProfit / sales) * 100).toFixed(1) : 0}%</Text>
                    </Text>
                    <View style={{ width: 10 }} />
                    <Ionicons name="pie-chart" size={16} color="#10B981" />
                    <Text style={styles.insightText}>
                        Profit: <Text style={{ fontWeight: 'bold' }}>Rs {netProfit.toFixed(0)}</Text>
                    </Text>
                </View>

                <BarChart
                    data={{
                        labels: ["Sales", "Costs", "Exps", "Profit"],
                        datasets: [
                            {
                                data: [sales, costs, expenses, Math.max(0, netProfit)]
                            }
                        ]
                    }}
                    width={screenWidth - 64}
                    height={220}
                    yAxisLabel="Rs "
                    yAxisSuffix=""
                    fromZero
                    chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) => isDark ? `rgba(96, 165, 250, ${opacity})` : `rgba(37, 99, 235, ${opacity})`,
                        labelColor: (opacity = 1) => isDark ? `rgba(209, 213, 219, ${opacity})` : `rgba(75, 85, 99, ${opacity})`,
                        barPercentage: 0.7,
                        decimalPlaces: 0,
                    }}
                    style={{ borderRadius: 16, marginVertical: 8 }}
                    showValuesOnTopOfBars
                />
            </View>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#111827' : '#F9FAFB' },
    header: { padding: 20, paddingTop: 30, backgroundColor: isDark ? '#1F2937' : '#FFF', borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB' },
    headerTitle: { fontSize: 26, fontWeight: '900', color: isDark ? '#F9FAFB' : '#111827', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 4, fontWeight: '500' },

    filterContainer: { flexDirection: 'row', backgroundColor: isDark ? '#1F2937' : '#FFF', padding: 8, margin: 16, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB' },
    filterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    filterBtnActive: { backgroundColor: '#3B82F6' },
    filterBtnText: { fontSize: 12, color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: 'bold' },
    filterBtnTextActive: { color: '#FFF' },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        justifyContent: 'space-between'
    },
    gridCard: {
        width: '48%',
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2
    },
    gridLabel: { fontSize: 13, color: isDark ? '#D1D5DB' : '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6 },
    gridValue: { fontSize: 20, fontWeight: '900', color: isDark ? '#F9FAFB' : '#111827' },

    chartContainer: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3
    },
    chartTitle: { fontSize: 16, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827', marginBottom: 12 },

    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: 'bold' },

    insightBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#374151' : '#F3F4F6', padding: 12, borderRadius: 12, marginBottom: 16 },
    insightText: { fontSize: 13, color: isDark ? '#D1D5DB' : '#4B5563', marginLeft: 4 },

    topItemsContainer: { backgroundColor: isDark ? '#1F2937' : '#FFF', padding: 16, marginHorizontal: 16, marginTop: 12, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
    topItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#F3F4F6' },
    itemRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    rankText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    itemName: { fontSize: 14, fontWeight: 'bold', color: isDark ? '#F9FAFB' : '#111827' },
    itemSubText: { fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280' },
    itemTotal: { fontSize: 14, fontWeight: 'bold', color: isDark ? '#60A5FA' : '#3B82F6' }
});
