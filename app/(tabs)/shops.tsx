import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { generateId, getShops, setShops } from '../../src/store/database';

export default function ShopsScreen() {
    const [shops, setShopsList] = useState<any[]>([]);
    const [name, setName] = useState('');

    useEffect(() => {
        loadShops();
    }, []);

    const loadShops = async () => {
        const s = await getShops();
        setShopsList(s);
    };

    const addShop = async () => {
        if (!name) return;
        const newShop = { id: generateId(), name };
        const updated = [...shops, newShop];
        await setShops(updated);
        setShopsList(updated);
        setName('');
    };

    const renderShop = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.shopIconContainer}>
                <Ionicons name="storefront" size={24} color="#3B82F6" />
            </View>
            <View style={styles.shopInfo}>
                <Text style={styles.shopName}>{item.name}</Text>
                <Text style={styles.shopId}>ID: {item.id}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.addSection}>
                <TextInput
                    style={styles.input}
                    placeholder="New Shop Name..."
                    value={name}
                    onChangeText={setName}
                />
                <TouchableOpacity style={styles.addButton} onPress={addShop}>
                    <Text style={styles.addButtonText}>Add Shop</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={shops}
                keyExtractor={item => item.id}
                renderItem={renderShop}
                contentContainerStyle={{ padding: 16 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    addSection: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderColor: '#E5E7EB'
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 10,
        marginRight: 10,
        backgroundColor: '#F9FAFB'
    },
    addButton: {
        backgroundColor: '#10B981',
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderRadius: 8
    },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    card: {
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
    },
    shopIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16
    },
    shopInfo: { flex: 1 },
    shopName: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
    shopId: { fontSize: 12, color: '#9CA3AF', marginTop: 4 }
});
