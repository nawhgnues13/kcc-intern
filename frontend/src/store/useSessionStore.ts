import { create } from 'zustand';
import { Attachment } from '../types/attachment';

interface SessionState {
  prompt: string;
  setPrompt: (prompt: string) => void;
  template: string;
  setTemplate: (template: string) => void;
  headerFooter: string;
  setHeaderFooter: (headerFooter: string) => void;
  attachments: Attachment[];
  setAttachments: (attachments: Attachment[]) => void;
  addAttachment: (attachment: Omit<Attachment, 'id'>) => string;
  removeAttachment: (id: string) => void;
  updateAttachment: (id: string, updates: Partial<Attachment>) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  prompt: '',
  setPrompt: (prompt) => set({ prompt }),
  
  template: 'Company Newsletter',
  setTemplate: (template) => set({ template }),
  
  headerFooter: 'KCC 모던형',
  setHeaderFooter: (headerFooter) => set({ headerFooter }),
  
  attachments: [],
  setAttachments: (attachments) => set({ attachments }),
  addAttachment: (attachment) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      attachments: [...state.attachments, { ...attachment, id } as Attachment],
    }));
    return id; // Return ID so components can track it
  },
  
  removeAttachment: (id) =>
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
    })),
    
  updateAttachment: (id, updates) =>
    set((state) => ({
      attachments: state.attachments.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
}));
