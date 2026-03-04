import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loginUser, registerUser } from '../src/store/database';

export default function LoginScreen() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleAuth = async () => {
        if (!username || !password) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }
        try {
            if (isLogin) {
                await loginUser(username, password);
            } else {
                await registerUser(username, password);
            }
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Authentication Failed', error.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>

            <View style={styles.card}>
                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TouchableOpacity style={styles.button} onPress={handleAuth}>
                    <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Signup'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{ marginTop: 15 }}>
                    <Text style={styles.switchText}>
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F4F7',
        justifyContent: 'center',
        padding: 20
    },
    header: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 30,
        textAlign: 'center'
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        fontSize: 16
    },
    button: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        marginTop: 8
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
    switchText: {
        textAlign: 'center',
        color: '#6B7280',
        fontSize: 14
    }
});
