import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useColorScheme
} from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { getExpenses, getProducts, getTransactions } from '../../src/store/database';

interface ThreeDayItem {
    id: string;
    name: string;
    twoDaysQty: number;
    yestQty: number;
    todayQty: number;
    total3DayQty: number;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SummaryScreen() {
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(isDark);

    const [sales, setSales] = useState(0);
    const [costs, setCosts] = useState(0);
    const [expenses, setExpensesState] = useState(0);
    const [topItems, setTopItems] = useState<any[]>([]);
    const [threeDaySales, setThreeDaySales] = useState<ThreeDayItem[]>([]);
    const [filter, setFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
    const [customDate, setCustomDate] = useState<Date>(new Date());
    const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
    const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        setRefreshing(true);
        const trans = await getTransactions();
        const exps = await getExpenses();
        const allProducts = await getProducts();

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const startOfYest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        const endOfYest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);

        // Start of week (Sunday)
        const tempDate = new Date(now);
        const diff = tempDate.getDate() - tempDate.getDay();
        const startOfWeek = new Date(tempDate.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

        // Custom Date range
        const startOfCustom = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 0, 0, 0, 0);
        const endOfCustom = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 23, 59, 59, 999);

        const isDateInFilter = (d: Date) => {
            if (filter === 'today') return d >= startOfToday && d <= endOfToday;
            if (filter === 'yesterday') return d >= startOfYest && d <= endOfYest;
            if (filter === 'week') return d >= startOfWeek;
            if (filter === 'month') return d >= startOfMonth;
            if (filter === 'custom') return d >= startOfCustom && d <= endOfCustom;
            return true;
        };

        const filteredTrans = trans.filter(t => {
            const tDate = new Date(t.date);
            return !isNaN(tDate.getTime()) && isDateInFilter(tDate);
        });

        const filteredExps = exps.filter(e => {
            const eDate = new Date(e.date);
            return !isNaN(eDate.getTime()) && isDateInFilter(eDate);
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

        // --- 3-Day Sales Check List Calculation ---
        const startOf2Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0);
        const endOf2Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 23, 59, 59, 999);

        const threeDayMap: { [key: string]: ThreeDayItem } = {};

        // Seed with products
        allProducts.forEach(p => {
            threeDayMap[p.id] = {
                id: p.id,
                name: p.nameEnglish || p.name || 'Product',
                twoDaysQty: 0,
                yestQty: 0,
                todayQty: 0,
                total3DayQty: 0,
            };
        });

        // Scan all transactions for 3-day history
        trans.forEach((t: any) => {
            const tTime = new Date(t.date).getTime();
            if (isNaN(tTime)) return;

            const isToday = tTime >= startOfToday.getTime() && tTime <= endOfToday.getTime();
            const isYest = tTime >= startOfYest.getTime() && tTime <= endOfYest.getTime();
            const is2Days = tTime >= startOf2Days.getTime() && tTime <= endOf2Days.getTime();

            if (!isToday && !isYest && !is2Days) return;

            const itemsList = Array.isArray(t.items) ? t.items : (Array.isArray(t.products) ? t.products : []);
            itemsList.forEach((item: any) => {
                if (item.isReturned) return;
                const id = item.id || item.productId || item.nameEnglish || 'unknown';
                if (!threeDayMap[id]) {
                    threeDayMap[id] = {
                        id,
                        name: item.nameEnglish || item.name || item.title || 'Product',
                        twoDaysQty: 0,
                        yestQty: 0,
                        todayQty: 0,
                        total3DayQty: 0,
                    };
                }
                const q = typeof item.qty === 'number' ? item.qty : (parseFloat(item.qty) || 0);
                if (isToday) threeDayMap[id].todayQty += q;
                if (isYest) threeDayMap[id].yestQty += q;
                if (is2Days) threeDayMap[id].twoDaysQty += q;
                threeDayMap[id].total3DayQty += q;
            });
        });

        const threeDayList = Object.values(threeDayMap)
            .filter(item => item.total3DayQty > 0 || item.todayQty > 0 || item.yestQty > 0 || item.twoDaysQty > 0)
            .sort((a, b) => b.todayQty - a.todayQty || b.yestQty - a.yestQty || b.twoDaysQty - a.twoDaysQty);

        setSales(tSales);
        setCosts(tCosts);
        setExpensesState(tExp);
        setTopItems(sortedItems);
        setThreeDaySales(threeDayList);
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [filter, customDate])
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

    // Calendar Helper Functions
    const calYear = calendarViewDate.getFullYear();
    const calMonth = calendarViewDate.getMonth();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();

    const changeMonth = (offset: number) => {
        setCalendarViewDate(new Date(calYear, calMonth + offset, 1));
    };

    const handleSelectDay = (day: number) => {
        const selected = new Date(calYear, calMonth, day);
        setCustomDate(selected);
        setFilter('custom');
        setIsDatePickerVisible(false);
    };

    const getFilterSubtitle = () => {
        if (filter === 'today') return 'Summary for Today';
        if (filter === 'yesterday') return 'Summary for Yesterday';
        if (filter === 'week') return 'Summary for This Week';
        if (filter === 'month') return 'Summary for This Month';
        if (filter === 'custom') {
            return `Summary for ${customDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return 'Financial Summary Overview';
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Financial Summary</Text>
                <Text style={styles.headerSubtitle}>{getFilterSubtitle()}</Text>
            </View>

            {/* Date Range Filter Section */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterBtn, filter === 'today' && styles.filterBtnActive]}
                    onPress={() => setFilter('today')}
                >
                    <Text style={[styles.filterBtnText, filter === 'today' && styles.filterBtnTextActive]}>Today</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterBtn, filter === 'yesterday' && styles.filterBtnActive]}
                    onPress={() => setFilter('yesterday')}
                >
                    <Text style={[styles.filterBtnText, filter === 'yesterday' && styles.filterBtnTextActive]}>Yesterday</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterBtn, filter === 'week' && styles.filterBtnActive]}
                    onPress={() => setFilter('week')}
                >
                    <Text style={[styles.filterBtnText, filter === 'week' && styles.filterBtnTextActive]}>Week</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterBtn, filter === 'month' && styles.filterBtnActive]}
                    onPress={() => setFilter('month')}
                >
                    <Text style={[styles.filterBtnText, filter === 'month' && styles.filterBtnTextActive]}>Month</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterBtn, filter === 'custom' && styles.filterBtnActive, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                    onPress={() => {
                        setCalendarViewDate(new Date(customDate));
                        setIsDatePickerVisible(true);
                    }}
                >
                    <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={filter === 'custom' ? '#FFF' : (isDark ? '#9CA3AF' : '#6B7280')}
                        style={{ marginRight: 3 }}
                    />
                    <Text style={[styles.filterBtnText, filter === 'custom' && styles.filterBtnTextActive]}>
                        {filter === 'custom' ? customDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Date'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Custom Date Info Bar */}
            {filter === 'custom' && (
                <View style={styles.customDateInfoBar}>
                    <Ionicons name="time-outline" size={16} color="#3B82F6" style={{ marginRight: 6 }} />
                    <Text style={styles.customDateInfoText}>
                        Selected Date: <Text style={{ fontWeight: 'bold' }}>{customDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
                    </Text>
                    <TouchableOpacity
                        style={styles.changeDateBtn}
                        onPress={() => {
                            setCalendarViewDate(new Date(customDate));
                            setIsDatePickerVisible(true);
                        }}
                    >
                        <Text style={styles.changeDateBtnText}>Change</Text>
                    </TouchableOpacity>
                </View>
            )}

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

            {/* Performance Analysis Bar Chart */}
            <View style={styles.chartContainer}>
                <View style={styles.chartHeader}>
                    <Text style={styles.chartTitle}>Performance Analysis</Text>
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

            {/* Business Breakdown Pie Chart */}
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

            {/* Top 5 Items List */}
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

            {/* 3-Day Sales Check List Card (Page Bottom) */}
            <View style={styles.checklistCard}>
                <View style={styles.checklistHeader}>
                    <Ionicons name="list-circle" size={24} color={isDark ? "#60A5FA" : "#3B82F6"} style={{ marginRight: 8 }} />
                    <Text style={styles.checklistTitle}>3-Day Sales Check List</Text>
                </View>

                <View style={styles.tableHeaderRow}>
                    <Text style={[styles.columnHeader, { flex: 2.5, textAlign: 'left' }]}>PRODUCT</Text>
                    <Text style={[styles.columnHeader, { flex: 1.2, textAlign: 'center' }]}>2 DAYS</Text>
                    <Text style={[styles.columnHeader, { flex: 1.2, textAlign: 'center' }]}>YEST.</Text>
                    <Text style={[styles.columnHeader, { flex: 1.2, textAlign: 'right', color: '#3B82F6', fontWeight: '900' }]}>TODAY</Text>
                </View>

                {threeDaySales.length > 0 ? (
                    threeDaySales.map((item, idx) => (
                        <View key={item.id || idx} style={styles.tableRow}>
                            <Text style={[styles.productNameText, { flex: 2.5 }]} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text style={[styles.qtyText, { flex: 1.2, textAlign: 'center' }]}>
                                {item.twoDaysQty > 0 ? item.twoDaysQty : '-'}
                            </Text>
                            <Text style={[styles.qtyText, { flex: 1.2, textAlign: 'center' }]}>
                                {item.yestQty > 0 ? item.yestQty : '-'}
                            </Text>
                            <Text style={[styles.todayQtyText, { flex: 1.2, textAlign: 'right' }]}>
                                {item.todayQty > 0 ? item.todayQty : '-'}
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyChecklistText}>No sales recorded in the past 3 days</Text>
                )}
            </View>

            <View style={{ height: 40 }} />

            {/* Interactive Date Chooser Modal */}
            <Modal
                visible={isDatePickerVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsDatePickerVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsDatePickerVisible(false)}
                >
                    <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose Summary Date</Text>
                            <TouchableOpacity onPress={() => setIsDatePickerVisible(false)}>
                                <Ionicons name="close" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                            </TouchableOpacity>
                        </View>

                        {/* Month / Year Navigator */}
                        <View style={styles.calMonthNav}>
                            <TouchableOpacity style={styles.calNavBtn} onPress={() => changeMonth(-1)}>
                                <Ionicons name="chevron-back" size={22} color={isDark ? '#F9FAFB' : '#111827'} />
                            </TouchableOpacity>
                            <Text style={styles.calMonthText}>
                                {MONTH_NAMES[calMonth]} {calYear}
                            </Text>
                            <TouchableOpacity style={styles.calNavBtn} onPress={() => changeMonth(1)}>
                                <Ionicons name="chevron-forward" size={22} color={isDark ? '#F9FAFB' : '#111827'} />
                            </TouchableOpacity>
                        </View>

                        {/* Day Names Header */}
                        <View style={styles.calDayNamesRow}>
                            {DAY_NAMES.map((d, i) => (
                                <Text key={i} style={[styles.calDayNameText, i === 0 && { color: '#EF4444' }]}>
                                    {d}
                                </Text>
                            ))}
                        </View>

                        {/* Calendar Days Grid */}
                        <View style={styles.calGrid}>
                            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                                <View key={`empty-${i}`} style={styles.calDayCell} />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const dayNum = i + 1;
                                const isSelected =
                                    filter === 'custom' &&
                                    customDate.getDate() === dayNum &&
                                    customDate.getMonth() === calMonth &&
                                    customDate.getFullYear() === calYear;

                                const isTodayDate =
                                    new Date().getDate() === dayNum &&
                                    new Date().getMonth() === calMonth &&
                                    new Date().getFullYear() === calYear;

                                return (
                                    <TouchableOpacity
                                        key={`day-${dayNum}`}
                                        style={[
                                            styles.calDayCell,
                                            isSelected && styles.calDayCellSelected,
                                            !isSelected && isTodayDate && styles.calDayCellToday
                                        ]}
                                        onPress={() => handleSelectDay(dayNum)}
                                    >
                                        <Text style={[
                                            styles.calDayText,
                                            isSelected && styles.calDayTextSelected,
                                            !isSelected && isTodayDate && styles.calDayTextToday
                                        ]}>
                                            {dayNum}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Quick Shortcuts */}
                        <View style={styles.calQuickRow}>
                            <TouchableOpacity
                                style={styles.calQuickBtn}
                                onPress={() => {
                                    const t = new Date();
                                    setCustomDate(t);
                                    setFilter('today');
                                    setIsDatePickerVisible(false);
                                }}
                            >
                                <Text style={styles.calQuickBtnText}>Today</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.calQuickBtn}
                                onPress={() => {
                                    const y = new Date();
                                    y.setDate(y.getDate() - 1);
                                    setCustomDate(y);
                                    setFilter('yesterday');
                                    setIsDatePickerVisible(false);
                                }}
                            >
                                <Text style={styles.calQuickBtnText}>Yesterday</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScrollView>
    );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#111827' : '#F9FAFB' },
    header: { padding: 20, paddingTop: 30, backgroundColor: isDark ? '#1F2937' : '#FFF', borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#E5E7EB' },
    headerTitle: { fontSize: 26, fontWeight: '900', color: isDark ? '#F9FAFB' : '#111827', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, color: isDark ? '#9CA3AF' : '#6B7280', marginTop: 4, fontWeight: '500' },

    filterContainer: {
        flexDirection: 'row',
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        padding: 6,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        justifyContent: 'space-between'
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        marginHorizontal: 2
    },
    filterBtnActive: { backgroundColor: '#3B82F6' },
    filterBtnText: { fontSize: 11, color: isDark ? '#9CA3AF' : '#6B7280', fontWeight: 'bold' },
    filterBtnTextActive: { color: '#FFF' },

    customDateInfoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE',
        marginHorizontal: 16,
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    customDateInfoText: {
        fontSize: 12,
        color: isDark ? '#DBEAFE' : '#1E40AF',
        flex: 1,
    },
    changeDateBtn: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 8,
    },
    changeDateBtnText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: 'bold',
    },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        marginTop: 12,
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
    itemTotal: { fontSize: 14, fontWeight: 'bold', color: isDark ? '#60A5FA' : '#3B82F6' },

    checklistCard: {
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 3,
    },
    checklistHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    checklistTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: isDark ? '#F9FAFB' : '#111827',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        marginBottom: 4,
    },
    columnHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: isDark ? '#9CA3AF' : '#6B7280',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: isDark ? '#374151' : '#F3F4F6',
    },
    productNameText: {
        fontSize: 14,
        fontWeight: '600',
        color: isDark ? '#F9FAFB' : '#111827',
    },
    qtyText: {
        fontSize: 14,
        fontWeight: '600',
        color: isDark ? '#D1D5DB' : '#4B5563',
    },
    todayQtyText: {
        fontSize: 15,
        fontWeight: '800',
        color: isDark ? '#60A5FA' : '#3B82F6',
    },
    emptyChecklistText: {
        textAlign: 'center',
        color: isDark ? '#9CA3AF' : '#6B7280',
        marginVertical: 16,
        fontSize: 13,
    },

    // --- Modal & Calendar Styles ---
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: isDark ? '#1F2937' : '#FFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderColor: isDark ? '#374151' : '#F3F4F6'
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: isDark ? '#F9FAFB' : '#111827'
    },
    calMonthNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8
    },
    calNavBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: isDark ? '#374151' : '#F3F4F6'
    },
    calMonthText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: isDark ? '#F9FAFB' : '#111827'
    },
    calDayNamesRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderColor: isDark ? '#374151' : '#F3F4F6',
        paddingBottom: 6
    },
    calDayNameText: {
        width: 36,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '700',
        color: isDark ? '#9CA3AF' : '#6B7280'
    },
    calGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start'
    },
    calDayCell: {
        width: `${100 / 7}%`,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 2,
        borderRadius: 8
    },
    calDayCellSelected: {
        backgroundColor: '#3B82F6'
    },
    calDayCellToday: {
        borderWidth: 1,
        borderColor: '#3B82F6'
    },
    calDayText: {
        fontSize: 14,
        color: isDark ? '#F9FAFB' : '#111827',
        fontWeight: '500'
    },
    calDayTextSelected: {
        color: '#FFF',
        fontWeight: 'bold'
    },
    calDayTextToday: {
        color: '#3B82F6',
        fontWeight: 'bold'
    },
    calQuickRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: isDark ? '#374151' : '#F3F4F6'
    },
    calQuickBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: isDark ? '#374151' : '#F3F4F6'
    },
    calQuickBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: isDark ? '#60A5FA' : '#3B82F6'
    }
});
