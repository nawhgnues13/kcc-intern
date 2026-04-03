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
    ui_permissions: {
      can_manage_sales: boolean;
      can_manage_service: boolean;
      can_manage_grooming: boolean;
      can_manage_employees: boolean;
    };
    employee_profile?: {
      company_code: string;
      work_unit_type: string;
      branch_name: string;
    };
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
