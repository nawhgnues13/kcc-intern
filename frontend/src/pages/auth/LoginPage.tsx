import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Sparkles, Mail, Lock, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      try {
        await login(email, password);
        navigate("/");
      } catch (err) {
        // Error handling is inside login function (alert)
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[440px] bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 sm:p-10 relative overflow-hidden"
      >
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#3721ED]/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        <div className="flex justify-center mb-8 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3721ED] to-[#6A58FF] flex items-center justify-center text-white shadow-lg shadow-[#3721ED]/30">
            <Sparkles className="w-7 h-7" />
          </div>
        </div>

        <div className="text-center mb-6 relative z-10">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">환영합니다!</h1>
          <p className="text-slate-500 text-sm">팀을 이끌어갈 AI 콘텐츠를 시작하세요</p>
        </div>

        <div className="mb-6 mx-2 p-3 bg-blue-50 border border-blue-100 rounded-xl relative z-10 text-center">
          <p className="text-xs text-blue-700 font-medium">직원 정보와 연결된 계정으로 로그인해주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">이메일</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@kcc.co.kr"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700 block">비밀번호</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-[#3721ED] hover:text-[#2c1ac0] transition-colors">
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#3721ED] text-white py-3.5 rounded-xl font-semibold shadow-md shadow-[#3721ED]/20 hover:bg-[#2c1ac0] hover:-translate-y-0.5 transition-all mt-4"
          >
            로그인 <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </form>

        <div className="mt-8 relative z-10">
          <div className="relative flex items-center py-5">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">계정이 없으신가요?</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>
          <div className="text-center pb-2">
            <Link to="/signup" className="inline-flex items-center justify-center w-full bg-white border-2 border-[#3721ED] text-[#3721ED] py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm">
              신규 회원가입 (직원 연결)
            </Link>
            <p className="mt-3 text-[11px] text-slate-400">회원가입 시 이름, 회사, 소속을 먼저 입력합니다.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
