import { UserDropdown } from "../shared/UserDropdown";
import { Link } from "react-router";
import { Sparkles, Menu } from "lucide-react";

export function TopNav() {

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md border-b border-white/20 z-50 sticky top-0">
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle (hidden on desktop) */}
        <button className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Mobile Logo (hidden on desktop since sidebar has it) */}
        <Link to="/" className="flex items-center gap-2 lg:hidden">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#3721ED] to-[#6A58FF] flex items-center justify-center text-white">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="font-bold tracking-tight text-slate-800">KCCNewsletter</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <UserDropdown />
      </div>
    </header>
  );
}
