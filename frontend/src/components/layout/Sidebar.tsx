import { Link, useLocation } from "react-router";
import { Sparkles, Home, PenSquare, Clock, Settings, BookOpen, Users, Car, Wrench, Scissors, BarChart2 } from "lucide-react";

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { label: "홈", path: "/", icon: <Home className="w-5 h-5" /> },
    { label: "새 콘텐츠 작성", path: "/dashboard", icon: <PenSquare className="w-5 h-5" /> },
    { label: "전체 기사", path: "/articles", icon: <BookOpen className="w-5 h-5" /> },
    { label: "작성 기록", path: "/history", icon: <Clock className="w-5 h-5" /> },
    { label: "생성 결과", path: "/generation-results", icon: <Sparkles className="w-5 h-5" /> },
  ];

  const crmItems = [
    { label: "직원 관리", path: "/employees", icon: <Users className="w-5 h-5" /> },
    { label: "차량 판매 관리", path: "/crm/sales", icon: <Car className="w-5 h-5" /> },
    { label: "차량 수리 관리", path: "/crm/service", icon: <Wrench className="w-5 h-5" /> },
    { label: "애견 미용 관리", path: "/crm/grooming", icon: <Scissors className="w-5 h-5" /> },
    { label: "판매 트렌드 분석", path: "/crm/trends", icon: <BarChart2 className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-full flex flex-col flex-shrink-0 z-20">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="KCCStudio" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-800">KCCStudio</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
        <div>
          <div className="text-xs font-semibold text-slate-400 mb-3 px-2 uppercase tracking-wider">메뉴</div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-[#3721ED]/10 text-[#3721ED]" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className={`${isActive ? "text-[#3721ED]" : "text-slate-400"}`}>
                    {item.icon}
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-400 mb-3 px-2 uppercase tracking-wider">임시 DB (운영)</div>
          <div className="space-y-1">
            {crmItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-slate-800 text-white" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className={`${isActive ? "text-white" : "text-slate-400"}`}>
                    {item.icon}
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-slate-100">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
          <Settings className="w-5 h-5 text-slate-400" />
          설정
        </button>
      </div>
    </aside>
  );
}
