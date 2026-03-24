import { apiClient } from "./apiClient";
import {
  ContentTaskItem,
  ContentTaskListResponse,
  ContentTaskResult,
  MyResultsResponse,
} from "../../types/contentTask";

export const contentTaskService = {
  getMyResults: async (params: {
    assigned_user_id: string;
    content_format?: string;
    source_type?: string;
  }): Promise<MyResultsResponse> => {
    return apiClient.get("/api/content-tasks/my-results", { params });
  },

  getTasks: async (params: {
    assigned_user_id: string;
    status?: string;
    content_format?: string;
    source_type?: string;
  }): Promise<ContentTaskListResponse> => {
    return apiClient.get("/api/content-tasks", { params });
  },

  getTaskDetail: async (taskId: string): Promise<ContentTaskItem> => {
    return apiClient.get(`/api/content-tasks/${taskId}`);
  },
};
