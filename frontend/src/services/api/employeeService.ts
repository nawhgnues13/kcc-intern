import { apiClient } from './apiClient';

export interface Employee {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  companyCode: string;
  departmentCode: string;
  position: string;
  branchName: string;
  linkedUserId?: string;
  linkedUserLoginId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeRequest {
  name: string;
  email: string;
  phone: string;
  companyCode: string;
  departmentCode: string;
  position: string;
  branchName: string;
}

export const employeeService = {
  getEmployees: async (): Promise<Employee[]> => {
    const response = await apiClient.get('/api/employees');
    // Handle both direct array or { items: [] } pattern
    return Array.isArray(response) ? response : response.items || [];
  },
  
  createEmployee: async (data: CreateEmployeeRequest): Promise<Employee> => {
    return apiClient.post('/api/employees', data);
  },
  
  updateEmployee: async (id: string, data: CreateEmployeeRequest): Promise<Employee> => {
    return apiClient.put(`/api/employees/${id}`, data);
  },
  
  deleteEmployee: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/employees/${id}`);
  }
};
