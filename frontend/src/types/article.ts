export interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: "IT" | "Vehicle" | "General";
  imageUrl: string;
  publishedAt: string;
  author: string;
}
