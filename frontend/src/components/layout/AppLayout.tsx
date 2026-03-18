import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppLayout() {
  return (
    <div className="h-screen bg-[#F8F9FB] text-slate-800 font-sans flex overflow-hidden">
      {/* Fixed Left Sidebar (hidden on small screens, shown on lg) */}
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <TopNav />
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
