export interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: "IT" | "Vehicle" | "General";
  imageUrl: string;
  publishedAt: string;
  author: string;
}

export interface NewsletterListItem {
  id?: string; // fallback
  articleId: string; // from backend response
  title: string;
  thumbnailImageUrl: string | null;
  contentFormat: string;
  topic: string | null;
  summary?: string;
  authorUserId?: string;
  authorName?: string;
  updatedAt: string;
}
