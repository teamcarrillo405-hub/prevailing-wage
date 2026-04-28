import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function FieldScreen() {
  const [activePunch, setActivePunch] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);

  const { data: projects, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'], queryFn: () => api.get('/api/projects').then(r => r.data),
  });
  const { data: workers } = useQuery({
    queryKey: ['workers', selectedProjectId],
    queryFn: () => api.get(`/api/projects/${selectedProjectId}/workers`).then(r => r.data),
    enabled: !!selectedProjectId,
  });

  useEffect(() => {
    SecureStore.getItemAsync('active_punch').then(val => { if (val) setActivePunch(JSON.parse(val)); });
  }, []);
  useEffect(() => {
    if (!activePunch) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - activePunch.startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [activePunch]);

  const punchMutation = useMutation({
    mutationFn: async (type: 'in' | 'out') => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission required');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return api.post('/api/time-punches', {
        projectId: selectedProjectId,
        workerId: selectedWorkerId,
        type,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    },
    onSuccess: async (_, type) => {
      if (type === 'in') {
        const punch = { startTime: Date.now(), projectId: selectedProjectId, workerId: selectedWorkerId };
        await SecureStore.setItemAsync('active_punch', JSON.stringify(punch));
        setActivePunch(punch);
      } else {
        await SecureStore.deleteItemAsync('active_punch');
        setActivePunch(null);
      }
    },
    onError: (err: any) => Alert.alert('Error', err.message ?? 'Failed to record punch'),
  });

  const formatElapsed = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  if (loadingProjects) return <LoadingSpinner />;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Field Clock-In</Text>
      {activePunch ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>Clocked In</Text>
          <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
          <TouchableOpacity style={styles.clockOutBtn} onPress={() => punchMutation.mutate('out')} disabled={punchMutation.isPending}>
            <Text style={styles.btnText}>Clock Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Project</Text>
          {(projects ?? []).map((p: any) => (
            <TouchableOpacity key={p.id} style={[styles.option, selectedProjectId === p.id && styles.selected]} onPress={() => setSelectedProjectId(p.id)}>
              <Text style={selectedProjectId === p.id ? styles.selectedText : styles.optionText}>{p.name}</Text>
            </TouchableOpacity>
          ))}
          {selectedProjectId && workers && <>
            <Text style={[styles.label, { marginTop: 16 }]}>Worker</Text>
            {(workers ?? []).map((w: any) => (
              <TouchableOpacity key={w.id} style={[styles.option, selectedWorkerId === w.id && styles.selected]} onPress={() => setSelectedWorkerId(w.id)}>
                <Text style={selectedWorkerId === w.id ? styles.selectedText : styles.optionText}>{w.firstName} {w.lastName}</Text>
              </TouchableOpacity>
            ))}
          </>}
          <TouchableOpacity
            style={[styles.clockInBtn, (!selectedProjectId || !selectedWorkerId) && styles.disabled]}
            onPress={() => punchMutation.mutate('in')}
            disabled={!selectedProjectId || !selectedWorkerId || punchMutation.isPending}
          >
            <Text style={styles.btnText}>{punchMutation.isPending ? 'Getting location...' : 'Clock In'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { fontSize: 22, fontWeight: '700', color: '#0A1628', padding: 20, paddingBottom: 8 },
  activeCard: { margin: 16, backgroundColor: '#0A1628', borderRadius: 12, padding: 24, alignItems: 'center' },
  activeLabel: { color: '#C9A84C', fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  elapsed: { color: '#fff', fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'], marginVertical: 12 },
  clockOutBtn: { backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 40, paddingVertical: 14 },
  form: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  option: { padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 6, backgroundColor: '#fff' },
  selected: { borderColor: '#0A1628', backgroundColor: '#0A1628' },
  optionText: { color: '#111827' },
  selectedText: { color: '#fff', fontWeight: '600' },
  clockInBtn: { backgroundColor: '#0A1628', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 20 },
  disabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
