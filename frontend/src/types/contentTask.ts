export type SourceType = "sale" | "service" | "grooming";
export type ContentFormat = "blog" | "instagram";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface ContentTaskResult {
  taskId: string;
  articleId: string | null;
  articleTitle: string | null;
  sourceType: SourceType;
  sourceId: string;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  assignedUserId: string | null;
  contentFormat: ContentFormat;
  templateStyle: string;
  status: TaskStatus;
  customerName: string | null;
  summary: string | null;
  thumbnailUrl: string | null;
  eventDate: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MyResultsResponse {
  items: ContentTaskResult[];
}

export interface ContentTaskItem {
  taskId: string;
  sourceType: SourceType;
  sourceId: string;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  assignedUserId: string | null;
  contentFormat: ContentFormat;
  templateStyle: string | null;
  status: TaskStatus;
  articleId: string | null;
  title: string;
  summary: string;
  thumbnailUrl: string | null;
  eventDate: string | null;
  createdAt: string;
}

export interface ContentTaskListResponse {
  items: ContentTaskItem[];
}
