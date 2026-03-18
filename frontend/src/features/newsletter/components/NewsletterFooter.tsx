export function NewsletterFooter({ type }: { type: string }) {
  if (type === "없음") return null;

  if (type === "기본값" || type === "강조형") {
    return (
      <div className="bg-slate-50 border-t border-slate-200 p-8 text-center text-sm text-slate-500">
        <p>© {new Date().getFullYear()} Acme Corporation. All rights reserved.</p>
        <p className="mt-2 text-xs text-slate-400">123 Business Avenue, Suite 100, Tech District, CA 94107</p>
        <div className="flex justify-center gap-4 mt-4 text-blue-600">
          <a href="#" className="hover:underline">Unsubscribe</a>
          <a href="#" className="hover:underline">Privacy Policy</a>
        </div>
      </div>
    );
  }

  if (type === "창의형") {
    return (
      <div className="bg-slate-900 text-white p-10 text-center relative overflow-hidden">
        <div className="relative z-10">
          <div className="font-black text-2xl tracking-tighter mb-4">Keep Creating.</div>
          <div className="flex justify-center gap-4 text-sm text-slate-400 mb-6">
            <span className="hover:text-white cursor-pointer transition-colors">Instagram</span>
            <span className="hover:text-white cursor-pointer transition-colors">Dribbble</span>
            <span className="hover:text-white cursor-pointer transition-colors">Twitter</span>
          </div>
          <p className="text-xs text-slate-600">You're receiving this because you subscribed to Studio Vibes.</p>
        </div>
      </div>
    );
  }

  if (type === "미니멀") {
    return (
      <div className="border-t border-slate-200 p-8 mt-10 flex flex-col items-center">
        <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 text-xs mb-4 hover:bg-slate-50 cursor-pointer">↑</div>
        <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">End of transmission</div>
      </div>
    );
  }

  return null;
}
