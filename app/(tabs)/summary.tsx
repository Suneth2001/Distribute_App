import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { getExpenses, getTransactions } from '../../src/store/database';

export default function SummaryScreen() {
    const [sales, setSales] = useState(0);
    const [costs, setCosts] = useState(0);
    const [expenses, setExpensesState] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        setRefreshing(true);
        const trans = await getTransactions();
        const exps = await getExpenses();

        // In a real app, you would filter by date (daily, weekly, monthly)
        // For this prototype, we compute all-time

        let tSales = 0;
        let tCosts = 0;
        trans.forEach(t => {
            tSales += t.total;
            tCosts += t.totalCost || 0;
        });

        let tExp = 0;
        exps.forEach(e => {
            tExp += e.amount;
        });

        setSales(tSales);
        setCosts(tCosts);
        setExpensesState(tExp);
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const profitFromGoods = sales - costs;
    const netProfit = profitFromGoods - expenses;

    const screenWidth = Dimensions.get("window").width;

    const chartConfig = {
        backgroundGradientFrom: "#1E293B",
        backgroundGradientTo: "#0F172A",
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        strokeWidth: 2,
        barPercentage: 0.6,
        useShadowColorFromDataset: false
    };

    const pieData = [
        { name: "Costs", population: costs, color: "#F59E0B", legendFontColor: "#4B5563", legendFontSize: 12 },
        { name: "Expenses", population: expenses, color: "#EF4444", legendFontColor: "#4B5563", legendFontSize: 12 },
        { name: "Profit", population: Math.max(0, netProfit), color: "#10B981", legendFontColor: "#4B5563", legendFontSize: 12 }
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Financial Summary</Text>
                <Text style={styles.headerSubtitle}>Overview of all recorded transactions</Text>
            </View>

            {/* Quick Stats Grid */}
            <View style={styles.statsGrid}>
                <View style={[styles.gridCard, { borderTopColor: '#3B82F6', borderTopWidth: 4 }]}>
                    <Text style={styles.gridLabel}>Revenue</Text>
                    <Text style={[styles.gridValue, { color: '#1D4ED8' }]}>Rs {sales}</Text>
                </View>
                <View style={[styles.gridCard, { borderTopColor: '#F59E0B', borderTopWidth: 4 }]}>
                    <Text style={styles.gridLabel}>Costs</Text>
                    <Text style={[styles.gridValue, { color: '#B45309' }]}>Rs {costs}</Text>
                </View>
                <View style={[styles.gridCard, { borderTopColor: '#EF4444', borderTopWidth: 4 }]}>
                    <Text style={styles.gridLabel}>Expenses</Text>
                    <Text style={[styles.gridValue, { color: '#B91C1C' }]}>Rs {expenses}</Text>
                </View>
                <View style={[styles.gridCard, { borderTopColor: netProfit >= 0 ? '#10B981' : '#EF4444', borderTopWidth: 4 }]}>
                    <Text style={styles.gridLabel}>Net Profit</Text>
                    <Text style={[styles.gridValue, { color: netProfit >= 0 ? '#047857' : '#B91C1C' }]}>Rs {netProfit}</Text>
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

            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Revenue vs Profit Bar Analysis</Text>
                <BarChart
                    data={{
                        labels: ["Revenue", "Costs", "Expenses", "Net Profit"],
                        datasets: [
                            {
                                data: [sales, costs, expenses, Math.max(0, netProfit)]
                            }
                        ]
                    }}
                    width={screenWidth - 32}
                    height={240}
                    yAxisLabel="Rs "
                    yAxisSuffix=""
                    chartConfig={{
                        ...chartConfig,
                        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    }}
                    style={{ borderRadius: 12, marginTop: 8 }}
                    showValuesOnTopOfBars
                />
            </View>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { padding: 20, paddingTop: 30, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E5E7EB' },
    headerTitle: { fontSize: 26, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, fontWeight: '500' },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        justifyContent: 'space-between'
    },
    gridCard: {
        width: '48%',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2
    },
    gridLabel: { fontSize: 13, color: '#6B7280', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6 },
    gridValue: { fontSize: 20, fontWeight: '900' },

    chartContainer: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3
    },
    chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 }
});
