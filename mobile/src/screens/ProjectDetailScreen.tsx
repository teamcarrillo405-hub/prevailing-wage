import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import StatusBadge from '../components/StatusBadge';

export default function ProjectDetailScreen({ route }: any) {
  const { project } = route.params;
  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{project.name}</Text>
        <StatusBadge status={project.status} />
        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>{project.county}, {project.state}</Text>
        {project.description && <><Text style={styles.label}>Description</Text><Text style={styles.value}>{project.description}</Text></>}
        {project.contractAmount && <><Text style={styles.label}>Contract Amount</Text><Text style={styles.value}>${Number(project.contractAmount).toLocaleString()}</Text></>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 10, padding: 20 },
  name: { fontSize: 20, fontWeight: '700', color: '#0A1628', marginBottom: 8 },
  label: { fontSize: 12, color: '#6B7280', marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 15, color: '#111827', marginTop: 2 },
});
