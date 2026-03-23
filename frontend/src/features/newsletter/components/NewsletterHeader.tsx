export function NewsletterHeader({ type, title }: { type: string, title?: string }) {
  if (type === "없음") return null;
  
  if (type === "KCC 모던형") {
    return (
      <div className="bg-[#0f172a] text-white p-8 flex items-center justify-between border-t-4 border-red-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black text-[#0f172a] text-xl">K</div>
          <div>
            <div className="font-bold text-xl tracking-wider">KCC정보통신</div>
            <div className="text-red-400 text-xs uppercase tracking-widest mt-0.5">Technology & Innovation</div>
          </div>
        </div>
        <div className="text-right text-sm text-slate-400">
          <div>Monthly Newsletter</div>
          <div className="mt-1 font-mono">{new Date().toLocaleDateString()}</div>
        </div>
      </div>
    );
  }

  if (type === "KCC 창의형") {
    return (
      <div className="bg-gradient-to-r from-[#0033a0] via-indigo-600 to-[#e3000f] p-1">
        <div className="bg-white p-6 text-center">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#0033a0] to-[#e3000f] tracking-tighter">KCC INNOVATION IT DECK</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium tracking-widest">Connect The Future</p>
        </div>
      </div>
    );
  }

  if (type === "KCC 미니멀형") {
    return (
      <div className="border-b-2 border-slate-900 p-8 pb-4 flex justify-between items-end">
        <div className="text-2xl font-serif font-bold text-slate-900 tracking-tight">KCC Newsletter.</div>
        <div className="text-xs font-mono text-slate-400 font-medium">KCC INFO. & COMM. | {new Date().toLocaleDateString()}</div>
      </div>
    );
  }

  if (type === "KCC 기존형") {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    return (
      <div className="w-full relative bg-[#F5EFE6] overflow-hidden flex items-center justify-center">
        <img src="/kcc-banner.jpg" alt="KCC Banner" className="w-full object-cover max-h-[350px]" />
        
        {/* 기존 이미지에 박힌 고정 텍스트를 가리고 동적 텍스트를 띄우기 위한 덮개(Overlay) 패널 */}
        <div className="absolute px-12 py-6 bg-[#F8F4ED]/95 backdrop-blur-sm rounded-3xl shadow-sm border border-[#E8DFD1] flex flex-col items-center justify-center">
          <h2 className="text-3xl sm:text-4xl font-black text-[#4A3D32] mb-2 tracking-tight">
            {year}년 {month}월 KCC정보통신
          </h2>
          <h3 className="text-xl sm:text-2xl font-bold text-[#6A5D51] tracking-widest">
            뉴스레터
          </h3>
        </div>
      </div>
    );
  }

  return null;
}
