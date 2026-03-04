import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getCurrentUser, seedDatabase } from '../src/store/database';

export default function Index() {
    const router = useRouter();

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        await seedDatabase();
        const user = await getCurrentUser();
        if (user) {
            router.replace('/(tabs)');
        } else {
            router.replace('/login');
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0a7ea4" />
        </View>
    );
}
