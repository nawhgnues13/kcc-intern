export type AttachmentType = 'pdf' | 'image' | 'url';
export type AttachmentStatus = 'uploading' | 'completed' | 'error';
export type NewsletterTemplate = 'Company Newsletter' | 'Weekly Digest' | 'Internal Memo' | 'Product Launch';
export type HeaderFooterTheme = 'None' | 'Corporate Default' | 'Creative Studio' | 'Minimalist';

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  url?: string;
  status: AttachmentStatus;
  progress?: number;
  file?: File;
}
