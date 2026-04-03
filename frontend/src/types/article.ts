export interface FacebookPlatformOutput {
  platform: "facebook";
  postText: string;
  hashtags?: string[];
  imageDownloadUrls?: string[];
}

export interface InstagramPlatformOutput {
  platform: "instagram";
  postText: string;
  hashtags?: string[];
  imageDownloadUrls?: string[];
}

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
  id?: string;
  articleId: string;
  title: string;
  thumbnailImageUrl: string | null;
  contentFormat: string;
  topic: string | null;
  summary?: string;
  status?: string;
  authorName?: string;
  authorUserId?: string;
  createdAt: string;
  updatedAt: string;
  platformOutput?: FacebookPlatformOutput | InstagramPlatformOutput | null;
}
