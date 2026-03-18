import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => void;
  signup: (name: string, role: string, email: string, company: string, avatar?: string) => void;
  updateProfile: (updates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  
  login: (email: string) => {
    // Mock login that sets a fake user
    const mockUser: User = {
      id: "usr-" + Math.random().toString(36).substring(7),
      name: email.split('@')[0], // derived from email for mock
      email: email,
      role: "Marketer"
    };
    
    set({ user: mockUser, isAuthenticated: true });
  },
  
  signup: (name: string, role: string, email: string, company: string, avatar?: string) => {
    // Mock signup 
    const newUser: User = {
      id: "usr-" + Math.random().toString(36).substring(7),
      name,
      email,
      role,
      company,
      avatar
    };
    
    set({ user: newUser, isAuthenticated: true });
  },

  updateProfile: (updates) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null
    }));
  },
  
  logout: () => {
    set({ user: null, isAuthenticated: false });
  }
}));
