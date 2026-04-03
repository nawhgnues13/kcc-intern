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

export interface WorkUnitTypeOption {
  code: string;
  label: string;
  branches: string[];
}

export interface CompanyOption {
  code: string;
  label: string;
  workUnitTypes: WorkUnitTypeOption[];
}

export interface SignupOptionsResponse {
  companies: CompanyOption[];
}

export const employeeService = {
  getEmployees: async (companyCode?: string, workUnitType?: string, branchName?: string): Promise<Employee[]> => {
    const params: any = {};
    if (companyCode) params.company_code = companyCode;
    if (workUnitType) params.work_unit_type = workUnitType;
    if (branchName) params.branch_name = branchName;
    
    const response = await apiClient.get('/api/employees', { params });
    // Handle both direct array or { items: [] } pattern
    return Array.isArray(response) ? response : response.items || [];
  },
  
  getSignupOptions: async (): Promise<SignupOptionsResponse> => {
    return apiClient.get('/api/employees/signup-options');
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
