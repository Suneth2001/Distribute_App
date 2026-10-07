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
            // If already logged in, check if user has set PIN or Biometrics
            // We'll pass a param to login screen to show the lock gate
            router.replace('/login?quickAccess=true');
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
