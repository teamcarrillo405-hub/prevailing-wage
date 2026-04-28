import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function MoreScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>{user?.role}</Text>
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 20, marginBottom: 20 },
  name: { fontSize: 18, fontWeight: '700', color: '#0A1628' },
  email: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  role: { fontSize: 12, color: '#C9A84C', marginTop: 8, textTransform: 'uppercase', fontWeight: '600' },
  logoutBtn: { backgroundColor: '#EF4444', borderRadius: 8, padding: 16, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
