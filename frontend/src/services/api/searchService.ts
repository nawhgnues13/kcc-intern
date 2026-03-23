import { apiClient } from './apiClient';

export interface SearchResultItem {
  title: string;
  snippet: string;
  original_url: string;
  favicon_url: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
}

export interface SummarizeResponse {
  summary: string;
}

export const searchService = {
  async search(query: string, count = 10): Promise<SearchResponse> {
    return apiClient.post('/api/search', { query, count });
  },

  async summarize(url: string, title: string): Promise<SummarizeResponse> {
    return apiClient.post('/api/search/summarize', { url, title });
  },
};
