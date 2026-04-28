import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
export default function LoadingSpinner() {
  return <View style={styles.c}><ActivityIndicator size="large" color="#0A1628" /></View>;
}
const styles = StyleSheet.create({ c: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
