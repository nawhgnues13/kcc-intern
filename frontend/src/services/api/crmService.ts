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
  createdTasks?: {
    taskId: string;
    contentFormat: string;
    status: string;
    articleId?: string;
  }[];
  importId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalSalesDelivery {
  showroomName: string;
  departmentName?: string;
  employeeName: string;
  customerName: string;
  externalContractNo: string;
  vehicleModel: string;
  className?: string;
  carYear?: string;
  exteriorColor?: string;
  interiorColor?: string;
  salePrice?: number;
  invoicePrice?: number;
  saleDate: string;
  contractDate?: string;
  isImported: boolean;
  salesRegistrationId?: string;
  generatedContents?: {
    taskId: string;
    contentFormat: string;
    status: string;
    articleId?: string;
  }[];
  rawDelivery: any;
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
  createdTasks?: {
    taskId: string;
    contentFormat: string;
    status: string;
    articleId?: string;
  }[];
  importId?: string;
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
  createdTasks?: {
    taskId: string;
    contentFormat: string;
    status: string;
    articleId?: string;
  }[];
  importId?: string;
  createdAt: string;
  updatedAt: string;
}

// Generate FormData helper
const createCrmFormData = (
  data: Record<string, any>, 
  files: File[], 
  photoDescriptions?: string[],
  keepPhotoIds?: string[],
  existingPhotoDescriptions?: Record<string, string>,
  requestedContents?: any[],
  forceRegenerateFormats?: string
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

  // append requested_contents (JSON array of dicts)
  if (requestedContents && requestedContents.length > 0) {
    formData.append("requested_contents", JSON.stringify(requestedContents));
  } else {
    formData.append("requested_contents", "[]");
  }

  if (forceRegenerateFormats) {
    formData.append("force_regenerate_formats", forceRegenerateFormats);
  }
  
  return formData;
};

export const crmService = {
  // Sales
  getSalesRegistrations: async (): Promise<SalesRegistration[]> => {
    const res = await apiClient.get('/api/crm/sales-registrations');
    return Array.isArray(res) ? res : (res as any).items || [];
  },
  createSalesRegistration: async (data: Record<string, any>, files: File[], desc?: string[], reqContents?: any[], forceRegenerateFormats?: string): Promise<SalesRegistration> => {
    return apiClient.post('/api/crm/sales-registrations', createCrmFormData(data, files, desc, undefined, undefined, reqContents, forceRegenerateFormats));
  },
  updateSalesRegistration: async (id: string, data: Record<string, any>, files: File[], desc: string[], keepPhotoIds: string[], extDesc: Record<string, string>, reqContents?: any[], forceRegenerateFormats?: string): Promise<SalesRegistration> => {
    return apiClient.put(`/api/crm/sales-registrations/${id}`, createCrmFormData(data, files, desc, keepPhotoIds, extDesc, reqContents, forceRegenerateFormats));
  },
  deleteSalesRegistration: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/crm/sales-registrations/${id}`);
  },

  getExternalSalesDeliveries: async (userId: string, fromDate: string, toDate: string): Promise<ExternalSalesDelivery[]> => {
    const res = await apiClient.get(`/api/crm/external/sales-deliveries`, { 
      params: { user_id: userId, delivery_date_from: fromDate, delivery_date_to: toDate } 
    });
    return Array.isArray(res) ? res : (res as any).items || [];
  },
  importExternalSalesRegistration: async (userId: string, deliveryPayload: ExternalSalesDelivery, note: string, files: File[], desc: string[], reqContents?: any[], forceRegenerateFormats?: string) => {
    const formData = new FormData();
    formData.append("user_id", userId);
    formData.append("delivery_payload", JSON.stringify(deliveryPayload.rawDelivery || deliveryPayload));
    if (note) formData.append("note", note);
    files.forEach(f => formData.append("files", f));
    if (desc && desc.length > 0) formData.append("photo_descriptions", JSON.stringify(desc));
    if (reqContents && reqContents.length > 0) formData.append("requested_contents", JSON.stringify(reqContents));
    else formData.append("requested_contents", "[]");
    
    if (forceRegenerateFormats) {
      formData.append("force_regenerate_formats", forceRegenerateFormats);
    }

    return apiClient.post('/api/crm/sales-registrations/import', formData);
  },

  // Service
  getServiceRegistrations: async (): Promise<ServiceRegistration[]> => {
    const res = await apiClient.get('/api/crm/service-registrations');
    return Array.isArray(res) ? res : (res as any).items || [];
  },
  createServiceRegistration: async (data: Record<string, any>, files: File[], desc?: string[], reqContents?: any[]): Promise<ServiceRegistration> => {
    return apiClient.post('/api/crm/service-registrations', createCrmFormData(data, files, desc, undefined, undefined, reqContents));
  },
  updateServiceRegistration: async (id: string, data: Record<string, any>, files: File[], desc: string[], keepPhotoIds: string[], extDesc: Record<string, string>, reqContents?: any[], forceRegenerateFormats?: string): Promise<ServiceRegistration> => {
    return apiClient.put(`/api/crm/service-registrations/${id}`, createCrmFormData(data, files, desc, keepPhotoIds, extDesc, reqContents, forceRegenerateFormats));
  },
  deleteServiceRegistration: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/crm/service-registrations/${id}`);
  },

  // Grooming
  getGroomingRegistrations: async (): Promise<GroomingRegistration[]> => {
    const res = await apiClient.get('/api/crm/grooming-registrations');
    return Array.isArray(res) ? res : (res as any).items || [];
  },
  createGroomingRegistration: async (data: Record<string, any>, files: File[], desc?: string[], reqContents?: any[]): Promise<GroomingRegistration> => {
    return apiClient.post('/api/crm/grooming-registrations', createCrmFormData(data, files, desc, undefined, undefined, reqContents));
  },
  updateGroomingRegistration: async (id: string, data: Record<string, any>, files: File[], desc: string[], keepPhotoIds: string[], extDesc: Record<string, string>, reqContents?: any[], forceRegenerateFormats?: string): Promise<GroomingRegistration> => {
    return apiClient.put(`/api/crm/grooming-registrations/${id}`, createCrmFormData(data, files, desc, keepPhotoIds, extDesc, reqContents, forceRegenerateFormats));
  },
  deleteGroomingRegistration: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/crm/grooming-registrations/${id}`);
  }
};
