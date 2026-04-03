import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Sparkles, Mail, Lock, Building2, Briefcase, ArrowRight, Camera, Plus, MapPin, User, AlertCircle } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { employeeService, SignupOptionsResponse } from "../../services/api/employeeService";

export function SignupPage() {
  const navigate = useNavigate();
  const signup = useAuthStore((state) => state.signup);

  // API Master Data
  const [options, setOptions] = useState<SignupOptionsResponse | null>(null);

  // Input fields
  const [name, setName] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedWorkUnit, setSelectedWorkUnit] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    employeeService.getSignupOptions().then(setOptions).catch(console.error);
  }, []);

  // When Company changes, reset descendants
  useEffect(() => {
    setSelectedWorkUnit("");
    setSelectedBranch("");
  }, [selectedCompany]);

  // When WorkUnit changes, reset descendants
  useEffect(() => {
    setSelectedBranch("");
  }, [selectedWorkUnit]);

  // Clear error if name/company selection changes
  useEffect(() => {
    if (name || selectedCompany || selectedWorkUnit || selectedBranch) {
      setErrorText("");
    }
  }, [name, selectedCompany, selectedWorkUnit, selectedBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!selectedCompany || !selectedWorkUnit || !selectedBranch) {
      setErrorText("회사, 소속유형, 소속명을 모두 선택해주세요.");
      return;
    }

    if (!emailPattern.test(loginId.trim())) {
      setErrorText("로그인 ID는 이메일 형식으로 입력해주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorText("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);
    try {
      await signup(
        loginId,
        password,
        name,
        selectedCompany,
        selectedWorkUnit,
        selectedBranch,
        avatar
      );
      navigate("/");
    } catch (err: any) {
      if (err.message === "409_CONFLICT") {
        setErrorText("이미 연결된 계정이 있습니다. 다른 정보를 확인해주세요.");
      }
    } finally {
      setIsLoading(false);
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

  const companyObj = options?.companies.find(c => c.code === selectedCompany);
  const workUnitObj = companyObj?.workUnitTypes.find(w => w.code === selectedWorkUnit);
  const branches = workUnitObj?.branches || [];

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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">회원가입</h1>
          <p className="text-slate-500 text-sm">실제 직원 정보와 연결된 계정을 생성합니다.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10 mt-2">
          
          {/* 아바타 선택 영역 */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                className="group relative w-20 h-20 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-300"
              >
                {avatar ? (
                  <img src={avatar} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-slate-50 text-slate-400">
                    <User className="w-8 h-8" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <Plus className="w-5 h-5 text-white" />
                </div>
              </motion.div>

              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-[#3721ED] rounded-full shadow-md border-2 border-white flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all z-20"
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
          </div>

          <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            {/* Inline Error */}
            {errorText && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-2 text-xs font-semibold text-rose-500 bg-rose-50 p-2.5 rounded-lg flex items-center gap-1.5 border border-rose-100"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorText}
              </motion.div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">이름</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">회사 선택</label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select 
                  value={selectedCompany}
                  onChange={e => setSelectedCompany(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED] transition-all text-sm text-slate-700 appearance-none"
                  required
                >
                  <option value="">회사를 선택하세요</option>
                  {options?.companies.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">소속유형 선택</label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select 
                  value={selectedWorkUnit}
                  onChange={e => setSelectedWorkUnit(e.target.value)}
                  disabled={!selectedCompany}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED] transition-all text-sm text-slate-700 appearance-none disabled:bg-slate-100 disabled:opacity-70"
                  required
                >
                  <option value="">소속유형 선택</option>
                  {companyObj?.workUnitTypes.map(w => (
                    <option key={w.code} value={w.code}>{w.label}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">소속명 선택</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select 
                  value={selectedBranch}
                  onChange={e => setSelectedBranch(e.target.value)}
                  disabled={!selectedWorkUnit}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED] transition-all text-sm text-slate-700 appearance-none disabled:bg-slate-100 disabled:opacity-70"
                  required
                >
                  <option value="">소속명 선택</option>
                  {branches.length === 0 && selectedWorkUnit && (
                    <option value="" disabled>등록된 소속이 없습니다</option>
                  )}
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">이메일</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="email" 
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="example@kcc.co.kr"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
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
                  minLength={8}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">비밀번호 확인</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  required
                  minLength={8}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm placeholder-slate-400"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-[#3721ED] text-white py-3.5 rounded-xl font-semibold shadow-md shadow-[#3721ED]/20 hover:bg-[#2c1ac0] hover:-translate-y-0.5 transition-all mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '가입 중...' : '계정 생성하기'} <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 relative z-10">
          이미 계정이 있으신가요? <Link to="/login" className="font-semibold text-[#3721ED] hover:text-[#2c1ac0] transition-colors">로그인하기</Link>
        </div>
      </motion.div>
    </div>
  );
}
