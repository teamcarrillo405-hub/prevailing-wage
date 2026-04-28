import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4099';

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('pw_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('pw_token');
    }
    return Promise.reject(err);
  },
);

export async function saveToken(token: string) {
  await SecureStore.setItemAsync('pw_token', token);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync('pw_token');
}
export async function getToken() {
  return SecureStore.getItemAsync('pw_token');
}
