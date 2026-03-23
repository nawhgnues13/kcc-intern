export type AttachmentType = 'pdf' | 'image' | 'url';
export type AttachmentStatus = 'uploading' | 'completed' | 'error';
export type NewsletterTemplate = 'Company Newsletter' | 'Weekly Digest' | 'Internal Memo' | 'Product Launch';
export type HeaderFooterTheme = 'None' | 'KCC 모던형' | 'KCC 창의형' | 'KCC 미니멀형' | 'KCC 기존형';

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  url?: string;
  status: AttachmentStatus;
  progress?: number;
  file?: File;
}
