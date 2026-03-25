import { apiClient } from './apiClient';

export interface CrmPhoto {
  photoId: string;
  fileUrl: string;
  sortOrder: number;
  photoDescription?: string;
}

export interface SalesRegistration {
  salesRegistrationId: string;
  employeeId: string;
  employeeName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleModel: string;
  salePrice: number;
  saleDate: string;
  branchName: string;
  note: string;
  photos: CrmPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRegistration {
  serviceRegistrationId: string;
  employeeId: string;
  employeeName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleModel: string;
  serviceDate: string;
  repairDetails: string;
  repairCost: number;
  branchName: string;
  note: string;
  photos: CrmPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface GroomingRegistration {
  groomingRegistrationId: string;
  employeeId: string;
  employeeName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  petName: string;
  petType: string;
  breed: string;
  groomingDetails: string;
  price: number;
  groomingDate: string;
  branchName: string;
  note: string;
  photos: CrmPhoto[];
  createdAt: string;
  updatedAt: string;
}

// Generate FormData helper
const createCrmFormData = (
  data: Record<string, any>, 
  files: File[], 
  photoDescriptions?: string[],
  keepPhotoIds?: string[],
  existingPhotoDescriptions?: Record<string, string>
) => {
  const formData = new FormData();
  
  // Append all top-level keys
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value.toString());
    }
  });

  // append files
  files.forEach(file => {
    formData.append("files", file);
  });

  // append photo descriptions for new files
  if (photoDescriptions && photoDescriptions.length > 0) {
    formData.append("photo_descriptions", JSON.stringify(photoDescriptions));
  }

  // append keep_photo_ids if given
  if (keepPhotoIds) {
    formData.append("keep_photo_ids", JSON.stringify(keepPhotoIds));
  }
  
  // append existing_photo_descriptions if given
  if (existingPhotoDescriptions && Object.keys(existingPhotoDescriptions).length > 0) {
    formData.append("existing_photo_descriptions", JSON.stringify(existingPhotoDescriptions));
  }

  // Mandatory empty requested_contents
  formData.append("requested_contents", "[]");
  
  return formData;
};

export const crmService = {
  // Sales
  getSalesRegistrations: async (): Promise<SalesRegistration[]> => {
    const res = await apiClient.get('/api/crm/sales-registrations');
    return Array.isArray(res) ? res : res.items || [];
  },
  createSalesRegistration: async (data: Record<string, any>, files: File[], desc?: string[]): Promise<SalesRegistration> => {
    return apiClient.post('/api/crm/sales-registrations', createCrmFormData(data, files, desc));
  },
  updateSalesRegistration: async (id: string, data: Record<string, any>, files: File[], desc: string[], keepPhotoIds: string[], extDesc: Record<string, string>): Promise<SalesRegistration> => {
    return apiClient.put(`/api/crm/sales-registrations/${id}`, createCrmFormData(data, files, desc, keepPhotoIds, extDesc));
  },
  deleteSalesRegistration: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/crm/sales-registrations/${id}`);
  },

  // Service
  getServiceRegistrations: async (): Promise<ServiceRegistration[]> => {
    const res = await apiClient.get('/api/crm/service-registrations');
    return Array.isArray(res) ? res : res.items || [];
  },
  createServiceRegistration: async (data: Record<string, any>, files: File[], desc?: string[]): Promise<ServiceRegistration> => {
    return apiClient.post('/api/crm/service-registrations', createCrmFormData(data, files, desc));
  },
  updateServiceRegistration: async (id: string, data: Record<string, any>, files: File[], desc: string[], keepPhotoIds: string[], extDesc: Record<string, string>): Promise<ServiceRegistration> => {
    return apiClient.put(`/api/crm/service-registrations/${id}`, createCrmFormData(data, files, desc, keepPhotoIds, extDesc));
  },
  deleteServiceRegistration: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/crm/service-registrations/${id}`);
  },

  // Grooming
  getGroomingRegistrations: async (): Promise<GroomingRegistration[]> => {
    const res = await apiClient.get('/api/crm/grooming-registrations');
    return Array.isArray(res) ? res : res.items || [];
  },
  createGroomingRegistration: async (data: Record<string, any>, files: File[], desc?: string[]): Promise<GroomingRegistration> => {
    return apiClient.post('/api/crm/grooming-registrations', createCrmFormData(data, files, desc));
  },
  updateGroomingRegistration: async (id: string, data: Record<string, any>, files: File[], desc: string[], keepPhotoIds: string[], extDesc: Record<string, string>): Promise<GroomingRegistration> => {
    return apiClient.put(`/api/crm/grooming-registrations/${id}`, createCrmFormData(data, files, desc, keepPhotoIds, extDesc));
  },
  deleteGroomingRegistration: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/crm/grooming-registrations/${id}`);
  }
};
