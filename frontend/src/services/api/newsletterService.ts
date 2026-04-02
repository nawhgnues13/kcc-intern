import { apiClient } from './apiClient';
import { Article } from '../../types/article';

export interface GenerateNewsletterRequest {
  user_id: string;
  instruction: string;
  template_style: string;
  content_format: string;
  // files and urls are appended to FormData
}

export interface AssistantChatRequest {
  message: string;
}

export interface AssistantEditRequest {
  message: string;
}

export const newsletterService = {
  // 1. 뉴스레터 생성 (multipart/form-data)
  generateNewsletter: async (
    data: GenerateNewsletterRequest,
    files: File[],
    urls: string[],
    urlNames: string[] = []
  ): Promise<{ articleId: string }> => {
    const formData = new FormData();
    formData.append('user_id', data.user_id);
    formData.append('instruction', data.instruction);
    formData.append('template_style', data.template_style);
    formData.append('content_format', data.content_format);

    // Add multiple files
    files.forEach(file => {
      formData.append('files', file);
    });

    // Add multiple urls and their display names
    urls.forEach(url => {
      formData.append('urls', url);
    });
    urlNames.forEach(name => {
      formData.append('url_names', name);
    });

    // Content-Type will be automatically set to multipart/form-data by browser/axios
    // Content-Type will be automatically set to multipart/form-data with bounds by browser/axios
    return apiClient.post('/api/newsletters/generate', formData);
  },

  // 2. 전체 기사 목록 조회
  getNewsletters: async (authorUserId?: string): Promise<Article[]> => {
    return apiClient.get('/api/newsletters', { params: authorUserId ? { author_user_id: authorUserId } : {} });
  },

  // 3. 단일 기사 상세 조회
  getNewsletter: async (articleId: string): Promise<any> => {
    // The type should ideally be defined, returning any for flexibility based on backend response shape.
    return apiClient.get(`/api/newsletters/${articleId}`);
  },

  // 4. 단일 기사 수정 (TipTap 저장)
  updateNewsletter: async (articleId: string, data: any): Promise<any> => {
    return apiClient.put(`/api/newsletters/${articleId}`, data);
  },

  // 5. 어시스턴트와 단순 대화 (본문 변경 없음)
  chatWithAssistant: async (articleId: string, payload: AssistantChatRequest): Promise<any> => {
    return apiClient.post(`/api/newsletters/${articleId}/assistant/chat`, payload);
  },

  // 6. 어시스턴트에게 본문 수정/재작성 요청
  editWithAssistant: async (articleId: string, payload: AssistantEditRequest): Promise<any> => {
    return apiClient.post(`/api/newsletters/${articleId}/assistant/edit`, payload);
  },

  // 7. 에디터 이미지 업로드 (S3 저장용)
  uploadAssetImage: async (articleId: string, file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/api/newsletters/${articleId}/assets/images`, formData);
  },

  // 8. 기사 삭제
  deleteNewsletter: async (articleId: string): Promise<any> => {
    return apiClient.delete(`/api/newsletters/${articleId}`);
  },

  // 9. 이메일 발송
  sendNewsletter: async (
    articleId: string,
    recipients: Array<{ name: string; email: string }>,
    subject?: string,
    html?: string,
  ): Promise<{ articleId: string; sentCount: number; totalCount: number; skippedEmails: string[] }> => {
    return apiClient.post(`/api/newsletters/${articleId}/send`, { recipients, subject, html });
  },

  // 10. 발송 이력 조회
  getSendLogs: async (articleId: string): Promise<{ items: Array<{ id: string; recipientEmail: string; recipientName: string; subject: string; status: string; sentAt: string }> }> => {
    return apiClient.get(`/api/newsletters/${articleId}/send-logs`);
  },
};
