import { apiClient } from './apiClient';

export interface EmailRecipient {
  name: string;
  email: string;
}

export const recipientService = {
  getCompanyCodes: async (): Promise<string[]> => {
    return apiClient.get<string[]>('/api/employees/company-codes');
  },

  getEmployeeRecipients: async (companyCode?: string): Promise<EmailRecipient[]> => {
    const params = companyCode ? { company_code: companyCode } : {};
    const res = await apiClient.get<{ items: Array<{ name: string; email: string | null }> }>('/api/employees', { params });
    return res.items
      .filter((e) => !!e.email)
      .map((e) => ({ name: e.name, email: e.email! }));
  },

  getCustomerRecipients: async (employeeEmail?: string): Promise<EmailRecipient[]> => {
    const params = employeeEmail ? { employee_email: employeeEmail } : {};
    const res = await apiClient.get<{ items: EmailRecipient[] }>('/api/crm/customers', { params });
    return res.items;
  },
};
