import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
const colors: Record<string, string> = { active: '#10B981', archived: '#6B7280', pending: '#F59E0B', completed: '#3B82F6' };
export default function StatusBadge({ status }: { status: string }) {
  const color = colors[status?.toLowerCase()] ?? '#6B7280';
  return <View style={[styles.badge, { backgroundColor: color + '22' }]}><Text style={[styles.text, { color }]}>{status}</Text></View>;
}
const styles = StyleSheet.create({ badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }, text: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' } });
