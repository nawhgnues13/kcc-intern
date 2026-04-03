import { useRouteError, useNavigate, isRouteErrorResponse } from "react-router";
import { AlertTriangle, Home, RefreshCcw, LogOut, ChevronLeft } from "lucide-react";
import { motion } from "motion/react";
import { useAuthStore } from "../../store/useAuthStore";

export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  let errorMessage: string;
  let errorStatus: number | string = "Error";

  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || error.data?.message || "페이지를 찾을 수 없거나 요청이 잘못되었습니다.";
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else {
    console.error(error);
    errorMessage = "알 수 없는 오류가 발생했습니다.";
  }

  const handleReset = () => {
    localStorage.clear(); // Clear all state just in case of corruption
    logout();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-10 text-center relative overflow-hidden"
      >
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="relative z-10">
          <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
          </div>

          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">앗!</h1>
          <h2 className="text-xl font-bold text-slate-800 mb-4">예기치 못한 문제가 발생했습니다.</h2>
          
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-8 text-left">
            <div className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Error Detail</div>
            <p className="text-sm font-mono text-slate-600 break-words leading-relaxed">
              [{errorStatus}] {errorMessage}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 w-full bg-[#3721ED] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#3721ED]/30 hover:bg-[#2c1ac0] hover:-translate-y-0.5 transition-all"
            >
              <Home className="w-5 h-5" />
              대시보드로 돌아가기
            </button>
            
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 py-3.5 rounded-2xl font-bold hover:bg-slate-200 transition-all border border-slate-200/50"
              >
                <RefreshCcw className="w-4 h-4" />
                새로고침
              </button>
              
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 bg-white text-rose-500 py-3.5 rounded-2xl font-bold hover:bg-rose-50 transition-all border border-rose-100"
              >
                <LogOut className="w-4 h-4" />
                초기화 후 로그인
              </button>
            </div>
          </div>

          <button 
            onClick={() => navigate(-1)}
            className="mt-8 text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            이전 페이지로
          </button>
        </div>
      </motion.div>

      <div className="fixed bottom-8 text-slate-400 text-xs font-medium">
        KCCStudio Error Management System &copy; 2026
      </div>
    </div>
  );
}
