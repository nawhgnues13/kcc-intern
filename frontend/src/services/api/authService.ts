import { apiClient } from './apiClient';

export interface LoginResponse {
  message: string;
  user: {
    id: string;
    login_id: string;
    name: string;
    role: string;
    company_name?: string;
    job_title?: string;
    profile_image_url?: string;
  };
}

export const authService = {
  login: async (login_id: string, password?: string): Promise<LoginResponse> => {
    return apiClient.post('/api/auth/login', { login_id, password: password || '12345678' });
  },
  signup: async (formData: FormData): Promise<any> => {
    return apiClient.post('/api/auth/signup', formData);
  }
};
