import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Camera, Mail, Building, Briefcase, User, ShieldCheck, Plus } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router";

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not logged in (handled by ProtectedRoute, but good for safety)
  if (!user) {
    navigate("/login");
    return null;
  }

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    company: user.company || "",
    role: user.role || ""
  });

  const handleSave = () => {
    // Persist changes to global store
    updateProfile(formData);
    setIsEditing(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfile({ avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex-1 w-full overflow-y-auto bg-[#F8F9FB] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">계정 설정</h1>
          <p className="text-slate-500 mt-2">개인 정보 및 프로필 설정을 관리하세요.</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
          {/* Left Column - Profile Avatar (Redesigned) */}
          <div className="w-full md:w-1/3 p-10 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col items-center justify-center bg-slate-50/50">
            <div className="relative group">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-full bg-gradient-to-br from-[#3721ED] to-[#6A58FF] flex items-center justify-center text-white font-bold text-5xl shadow-xl border-4 border-white overflow-hidden cursor-pointer relative"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
                
                {/* Hover state overlay */}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px]">
                  <Camera className="w-8 h-8 text-white mb-1" />
                  <span className="text-[10px] text-white font-bold uppercase tracking-wider">변경하기</span>
                </div>
              </motion.div>

              {/* Floating Action Button */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 w-10 h-10 bg-white rounded-full shadow-lg border border-slate-100 flex items-center justify-center text-[#3721ED] hover:scale-110 active:scale-95 transition-all z-20"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
            
            <h2 className="mt-8 text-xl font-bold text-slate-800 tracking-tight">{user.name}</h2>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageChange} 
            />

            <div className="flex items-center text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full mt-3 gap-1.5 border border-emerald-100 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" /> 인증된 전문가
            </div>
          </div>

          {/* Right Column - Profile Details */}
          <div className="flex-1 p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800">개인 정보</h3>
              <button 
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  isEditing ? "bg-[#3721ED] text-white hover:bg-[#2c1ac0] shadow-[#3721ED]/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {isEditing ? "저장하기" : "수정하기"}
              </button>
            </div>

            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="flex items-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 gap-2">
                  <User className="w-4 h-4" /> 이름
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3721ED] focus:ring-2 focus:ring-[#3721ED]/20 transition-all font-medium text-slate-800"
                  />
                ) : (
                  <div className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 font-medium text-slate-800">
                    {user.name}
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 gap-2">
                  <Mail className="w-4 h-4" /> 이메일 <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md ml-2 border border-slate-200">로그인 전용</span>
                </label>
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-500 cursor-not-allowed">
                  {user.email}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Company */}
                <div>
                  <label className="flex items-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 gap-2">
                    <Building className="w-4 h-4" /> 소속 회사
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3721ED] focus:ring-2 focus:ring-[#3721ED]/20 transition-all font-medium text-slate-800"
                      placeholder="회사명 입력"
                    />
                  ) : (
                    <div className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 font-medium text-slate-800">
                      {user.company || "-"}
                    </div>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="flex items-center text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 gap-2">
                    <Briefcase className="w-4 h-4" /> 직책
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3721ED] focus:ring-2 focus:ring-[#3721ED]/20 transition-all font-medium text-slate-800"
                      placeholder="직책 입력"
                    />
                  ) : (
                    <div className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 font-medium text-slate-800">
                      {user.role || "-"}
                    </div>
                  )}
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
