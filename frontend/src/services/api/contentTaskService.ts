import { apiClient } from "./apiClient";
import {
  ContentTaskItem,
  ContentTaskListResponse,
  InstagramPublishResponse,
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

  publishInstagram: async (
    taskId: string,
    payload: {
      access_token?: string;
      ig_user_id?: string;
      api_version?: string;
      host_url?: string;
      force?: boolean;
    } = {},
  ): Promise<InstagramPublishResponse> => {
    return apiClient.post(`/api/content-tasks/${taskId}/publish-instagram`, payload);
  },
};
