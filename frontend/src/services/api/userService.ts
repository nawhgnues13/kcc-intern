import { apiClient } from './apiClient';

export const userService = {
  getUser: async (userId: string) => {
    return apiClient.get(`/api/users/${userId}`);
  },
  updateProfile: async (userId: string, formData: FormData) => {
    return apiClient.put(`/api/users/${userId}`, formData);
  }
};
