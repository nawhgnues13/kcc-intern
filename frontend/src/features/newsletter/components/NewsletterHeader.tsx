export function NewsletterHeader({ type, title }: { type: string, title?: string }) {
  if (type === "없음") return null;
  
  if (type === "기본값" || type === "강조형") {
    return (
      <div className="bg-[#1e293b] text-white p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xl">AC</div>
          <div>
            <div className="font-bold text-lg tracking-wider">ACME CORP</div>
            <div className="text-blue-300 text-xs uppercase tracking-widest mt-0.5">Global Newsletter</div>
          </div>
        </div>
        <div className="text-right text-sm text-slate-400">
          <div>Vol 42. Q3 Report</div>
          <div className="mt-1">{new Date().toLocaleDateString()}</div>
        </div>
      </div>
    );
  }

  if (type === "창의형") {
    return (
      <div className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 p-1">
        <div className="bg-white p-6 text-center">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-indigo-600 tracking-tighter">STUDIO VIBES</h2>
          <p className="text-slate-400 text-sm mt-2 font-medium">LATEST UPDATES & INSPIRATION</p>
        </div>
      </div>
    );
  }

  if (type === "미니멀") {
    return (
      <div className="border-b-2 border-slate-900 p-8 pb-4 flex justify-between items-end">
        <div className="text-2xl font-serif text-slate-900">The Minimalist.</div>
        <div className="text-xs font-mono text-slate-500 uppercase">{new Date().toLocaleDateString()}</div>
      </div>
    );
  }

  return null;
}
