import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await login(email, password, mfaRequired ? totp : undefined);
    } catch (err: any) {
      if (err?.response?.data?.requiresMfa) {
        setMfaRequired(true);
      } else {
        Alert.alert('Login failed', err?.response?.data?.error ?? 'Please check your credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prevailing Wage</Text>
      <Text style={styles.subtitle}>Field App</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {mfaRequired && (
        <TextInput style={styles.input} placeholder="6-digit MFA code" value={totp} onChangeText={setTotp} keyboardType="number-pad" maxLength={6} />
      )}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{mfaRequired ? 'Verify MFA' : 'Sign In'}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', color: '#0A1628', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 40 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#0A1628', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
