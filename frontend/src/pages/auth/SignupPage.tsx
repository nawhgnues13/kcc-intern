import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Sparkles, Mail, Lock, User, Briefcase, Building2, ArrowRight, Camera, Plus } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";

export function SignupPage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const signup = useAuthStore((state) => state.signup);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && role && email) {
      signup(name, role, email, company, avatar);
      navigate("/");
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[500px] bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-10 relative overflow-hidden my-8"
      >
        <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-[#3721ED]/10 to-transparent rounded-full blur-3xl -translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="flex justify-center mb-6 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3721ED] to-[#6A58FF] flex items-center justify-center text-white shadow-md shadow-[#3721ED]/20">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="text-center mb-6 relative z-10">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">계정 만들기</h1>
          <p className="text-slate-500 text-sm">팀을 이끌어갈 AI 콘텐츠를 시작하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10 mt-2">
          {/* Integrated Profile Header: Avatar + Name/Role */}
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center bg-slate-50/50 p-5 rounded-2xl border border-slate-100 mb-2">
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative w-20 h-20 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-300"
                >
                  {avatar ? (
                    <img src={avatar} alt="Profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-indigo-50/30">
                      <User className="w-8 h-8 text-indigo-200" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                </motion.div>

                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-[#3721ED] rounded-full shadow-lg border-2 border-white flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all z-20"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageChange} 
              />
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">사진 등록</p>
            </div>

            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">이름</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">직책</label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="마케팅 매니저"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">소속(회사)</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="KCC오토"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">이메일</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">비밀번호</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="최소 8자 이상"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#3721ED] text-white py-3.5 rounded-xl font-semibold shadow-md shadow-[#3721ED]/20 hover:bg-[#2c1ac0] hover:-translate-y-0.5 transition-all mt-6"
          >
            시작하기 <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 relative z-10">
          이미 계정이 있으신가요? <Link to="/login" className="font-semibold text-[#3721ED] hover:text-[#2c1ac0] transition-colors">로그인하기</Link>
        </div>
      </motion.div>
    </div>
  );
}
