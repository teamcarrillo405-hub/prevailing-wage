import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function PhotoUploadScreen({ route }: any) {
  const projectId = route?.params?.projectId;
  const queryClient = useQueryClient();
  const { data: photos } = useQuery({
    queryKey: ['photos', projectId],
    queryFn: () => api.get(`/api/projects/${projectId}/photos`).then(r => r.data),
    enabled: !!projectId,
  });
  const uploadMutation = useMutation({
    mutationFn: async (uri: string) => {
      const form = new FormData();
      form.append('photo', { uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
      return api.post(`/api/projects/${projectId}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos', projectId] }),
    onError: () => Alert.alert('Upload failed', 'Please try again'),
  });

  async function pickPhoto() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!result.canceled) uploadMutation.mutate(result.assets[0].uri);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={pickPhoto}>
        <Text style={styles.buttonText}>Take Photo</Text>
      </TouchableOpacity>
      <FlatList data={photos ?? []} numColumns={3} keyExtractor={(item: any) => String(item.id)}
        renderItem={({ item }) => <Image source={{ uri: item.url }} style={styles.thumb} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 12 },
  button: { backgroundColor: '#0A1628', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
  thumb: { width: '30%', aspectRatio: 1, margin: '1.5%', borderRadius: 6 },
});
