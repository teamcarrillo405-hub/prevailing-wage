import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function WorkersScreen() {
  const [search, setSearch] = useState('');
  // For now, load all workers from all projects — TODO: filter by project
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: () => api.get('/api/projects').then(r => r.data) });
  const firstProjectId = projects?.[0]?.id;
  const { data: workers, isLoading, isError, refetch } = useQuery({
    queryKey: ['workers', firstProjectId],
    queryFn: () => api.get(`/api/projects/${firstProjectId}/workers`).then(r => r.data),
    enabled: !!firstProjectId,
  });

  const filtered = (workers ?? []).filter((w: any) =>
    `${w.firstName} ${w.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage message="Failed to load workers" onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} placeholder="Search workers..." value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={(item: any) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
            <Text style={styles.trade}>{item.trade} · ${Number(item.hourlyRate).toFixed(2)}/hr</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  search: { margin: 8, padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 15 },
  card: { backgroundColor: '#fff', marginHorizontal: 8, marginBottom: 6, borderRadius: 8, padding: 14 },
  name: { fontSize: 15, fontWeight: '600', color: '#0A1628' },
  trade: { fontSize: 13, color: '#6B7280', marginTop: 2 },
});
