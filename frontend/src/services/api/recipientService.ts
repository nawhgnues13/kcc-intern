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

  getCustomerRecipients: async (): Promise<EmailRecipient[]> => {
    const res = await apiClient.get<{ items: EmailRecipient[] }>('/api/customers');
    return res.items;
  },
};
