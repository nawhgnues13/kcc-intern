import { useState } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Mail, LockKeyhole, ArrowRight, CheckCircle2 } from "lucide-react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // Mock sending email
      setIsSubmitted(true);
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
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#3721ED]/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        <div className="flex justify-center mb-8 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
            <LockKeyhole className="w-7 h-7" />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="relative z-10"
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">비밀번호 찾기</h1>
                <p className="text-slate-500 text-sm">가입하신 이메일 주소를 입력하시면<br/>비밀번호 재설정 링크를 보내드립니다.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">이메일</label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-[#3721ED] text-white py-3.5 rounded-xl font-semibold shadow-md shadow-[#3721ED]/20 hover:bg-[#2c1ac0] hover:-translate-y-0.5 transition-all mt-4"
                >
                  재설정 링크 받기 <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative z-10 text-center py-4"
            >
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight mb-3">이메일 전송 완료</h1>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                <span className="font-semibold text-slate-700">{email}</span> 주소로<br/>비밀번호 재설정 링크를 보내드렸습니다.<br/>이메일함을 확인해주세요.
              </p>
              <Link 
                to="/login"
                className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3.5 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                로그인 화면으로 돌아가기
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {!isSubmitted && (
          <div className="mt-8 text-center text-sm text-slate-500 relative z-10">
            기억나셨나요? <Link to="/login" className="font-semibold text-[#3721ED] hover:text-[#2c1ac0] transition-colors">로그인하기</Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
