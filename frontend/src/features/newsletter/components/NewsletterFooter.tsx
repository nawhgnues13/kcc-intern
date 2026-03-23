export function NewsletterFooter({ type }: { type: string }) {
  if (type === "없음") return null;

  if (type === "KCC 모던형") {
    return (
      <div className="bg-slate-50 border-t border-slate-200 p-8 text-center text-sm text-slate-500">
        <p>© {new Date().getFullYear()} KCC Information & Communication Co., Ltd. All rights reserved.</p>
        <p className="mt-2 text-xs text-slate-400">서울특별시 강서구 양천로 583 우림블루나인비즈니스센터 | 대표전화 02-2000-0000</p>
        <div className="flex justify-center gap-4 mt-4 text-red-600">
          <a href="#" className="hover:underline">회사소개</a>
          <a href="#" className="hover:underline">개인정보처리방침</a>
        </div>
      </div>
    );
  }

  if (type === "KCC 창의형") {
    return (
      <div className="bg-[#0f172a] text-white p-10 text-center relative overflow-hidden">
        <div className="relative z-10">
          <div className="font-black text-2xl tracking-tighter mb-4">Connect The Future.</div>
          <div className="flex justify-center gap-4 text-sm text-slate-400 mb-6 font-mono">
            <span className="hover:text-white cursor-pointer transition-colors">SINCE 1967</span>
            <span className="hover:text-white cursor-pointer transition-colors">INNOVATION</span>
            <span className="hover:text-white cursor-pointer transition-colors">TECHNOLOGY</span>
          </div>
          <p className="text-xs text-slate-500">© KCC정보통신. 이 이메일은 KCC정보통신 구독자에게 발송됩니다.</p>
        </div>
      </div>
    );
  }

  if (type === "KCC 미니멀형") {
    return (
      <div className="border-t border-slate-200 p-8 mt-10 flex flex-col items-center">
        <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 text-xs mb-4 hover:bg-slate-50 cursor-pointer">↑</div>
        <div className="text-xs font-mono text-slate-400 uppercase tracking-widest text-center">
          KCC Information & Communication<br/>END OF TRANSMISSION
        </div>
      </div>
    );
  }

  if (type === "KCC 기존형") {
    return (
      <div className="bg-[#EFE9DF] p-6 text-center border-t border-[#D9CDBF]">
        <p className="text-sm font-semibold text-[#5A4D41]">새해 복 많이 받으세요</p>
        <p className="text-xs text-[#8A7D71] mt-2">KCC정보통신과 함께 희망찬 한 해를 만들어가요.</p>
        <p className="text-[10px] text-[#A6998D] mt-4 tracking-widest">© 2026 KCC INFO & COMM.</p>
      </div>
    );
  }

  return null;
}
