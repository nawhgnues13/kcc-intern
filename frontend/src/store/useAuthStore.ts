import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/api/authService';
import { userService } from '../services/api/userService';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: string;
  avatar?: string;
  ui_permissions: {
    can_manage_sales: boolean;
    can_manage_service: boolean;
    can_manage_grooming: boolean;
    can_manage_employees: boolean;
  };
  employee_profile?: {
    company_code: string;
    work_unit_type: string;
    branch_name: string;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signup: (loginId: string, password: string, name: string, companyCode: string, workUnitType: string, branchName: string, avatar?: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
  user: null,
  isAuthenticated: false,
  
  login: async (email: string, password?: string) => {
    try {
      const res = await authService.login(email, password);
      if (res.user) {
        set({ 
          user: {
            id: res.user.id,
            name: res.user.name,
            email: res.user.login_id,
            role: res.user.job_title || 'Marketer',
            company: res.user.company_name,
            avatar: res.user.profile_image_url,
            ui_permissions: res.user.ui_permissions || {
              can_manage_sales: false,
              can_manage_service: false,
              can_manage_grooming: false,
              can_manage_employees: false
            },
            employee_profile: res.user.employee_profile
          }, 
          isAuthenticated: true 
        });
      }
    } catch (err) {
      console.error("Login failed:", err);
      // Fallback or throw
      alert("로그인에 실패했습니다. DB에 등록된 아이디/비밀번호인지 확인해주세요.");
      throw err;
    }
  },
  
  signup: async (loginId: string, password: string, name: string, companyCode: string, workUnitType: string, branchName: string, avatar?: string) => {
    try {
      const formData = new FormData();
      formData.append('login_id', loginId);
      formData.append('password', password);
      formData.append('name', name);
      if (companyCode) formData.append('company_code', companyCode);
      if (workUnitType) formData.append('work_unit_type', workUnitType);
      if (branchName) formData.append('branch_name', branchName);
      
      if (avatar && avatar.startsWith('data:image')) {
        const arr = avatar.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        if (mime) {
          formData.append('profile_image', new File([u8arr], 'profile.png', {type:mime}));
        }
      }

      await authService.signup(formData);
      
      // Automatically login after successful signup
      const res = await authService.login(loginId, password);
      if (res.user) {
        set({ 
          user: {
            id: res.user.id,
            name: res.user.name,
            email: res.user.login_id,
            role: res.user.job_title || 'Marketer',
            company: res.user.company_name,
            avatar: res.user.profile_image_url,
            ui_permissions: res.user.ui_permissions || {
              can_manage_sales: false,
              can_manage_service: false,
              can_manage_grooming: false,
              can_manage_employees: false
            },
            employee_profile: res.user.employee_profile
          }, 
          isAuthenticated: true 
        });
      }
    } catch (err: any) {
      console.error("Signup failed:", err);
      if (err.response?.status === 409) {
        throw new Error("409_CONFLICT");
      }
      alert("회원가입에 실패했습니다.");
      throw err;
    }
  },

  updateProfile: async (updates) => {
    try {
      const state = useAuthStore.getState();
      if (!state.user || !state.user.id) return;
      
      const formData = new FormData();
      if (updates.name) formData.append('name', updates.name);
      if (updates.company) formData.append('company_name', updates.company);
      if (updates.role) formData.append('job_title', updates.role);
      
      if (updates.avatar && updates.avatar.startsWith('data:image')) {
        const arr = updates.avatar.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        if (mime) {
          formData.append('profile_image', new File([u8arr], 'profile.png', {type:mime}));
        }
      }

      const res: any = await userService.updateProfile(state.user.id, formData);
      
      set((state) => ({
        user: state.user ? { 
          ...state.user, 
          name: res.name || updates.name || state.user.name,
          company: res.company_name || updates.company || state.user.company,
          role: res.job_title || updates.role || state.user.role,
          avatar: res.profile_image_url || updates.avatar || state.user.avatar
        } : null
      }));
    } catch (err) {
      console.error("Profile update failed:", err);
      alert("프로필 수정에 실패했습니다.");
    }
  },
  
  logout: () => {
    set({ user: null, isAuthenticated: false });
  }
}),
{
  name: 'auth-storage',
}
));
