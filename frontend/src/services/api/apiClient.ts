import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

export const apiClient = axios.create({
  baseURL: '',
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error details:', error?.response?.data ? JSON.stringify(error.response.data) : error.message);
    return Promise.reject(error);
  }
);
