import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
export default function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.c}>
      <Text style={styles.msg}>{message}</Text>
      {onRetry && <TouchableOpacity style={styles.btn} onPress={onRetry}><Text style={styles.btnTxt}>Retry</Text></TouchableOpacity>}
    </View>
  );
}
const styles = StyleSheet.create({ c: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, msg: { color: '#EF4444', fontSize: 15, textAlign: 'center', marginBottom: 12 }, btn: { backgroundColor: '#0A1628', borderRadius: 8, padding: 12, paddingHorizontal: 24 }, btnTxt: { color: '#fff', fontWeight: '600' } });
