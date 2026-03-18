import { Link, useLocation } from "react-router";
import { Sparkles, Home, PenSquare, Clock, Settings, BookOpen } from "lucide-react";

export function Sidebar() {
  const location = useLocation();

  const navItems = [
    { label: "홈", path: "/", icon: <Home className="w-5 h-5" /> },
    { label: "새 콘텐츠 작성", path: "/dashboard", icon: <PenSquare className="w-5 h-5" /> },
    { label: "전체 기사", path: "/articles", icon: <BookOpen className="w-5 h-5" /> },
    { label: "작성 기록", path: "/history", icon: <Clock className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-full flex flex-col flex-shrink-0 z-20">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3721ED] to-[#6A58FF] flex items-center justify-center text-white shadow-sm shadow-[#3721ED]/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-800">KCCNewsletter</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        <div className="text-xs font-semibold text-slate-400 mb-3 px-2 uppercase tracking-wider">메뉴</div>
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
