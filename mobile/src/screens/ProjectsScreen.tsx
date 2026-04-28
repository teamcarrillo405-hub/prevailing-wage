import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function ProjectsScreen({ navigation }: any) {
  const { data: projects, isLoading, isError, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects').then(r => r.data),
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage message="Failed to load projects" onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={(item: any) => String(item.id)}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ProjectDetail', { project: item })}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.county}>{item.county}, {item.state}</Text>
            <StatusBadge status={item.status} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  card: { backgroundColor: '#fff', margin: 8, borderRadius: 10, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  name: { fontSize: 16, fontWeight: '600', color: '#0A1628', marginBottom: 4 },
  county: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
});
