import { Mail, X, Check, Send } from "lucide-react";
import { ModalLayout } from "../../../components/shared/ModalLayout";

interface EmailSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

function PlusCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

export function EmailSendModal({ isOpen, onClose, title }: EmailSendModalProps) {
  return (
    <ModalLayout isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#3721ED]" />
          이메일 전송하기
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 space-y-5">
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">받는 사람</label>
          <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm flex items-center gap-2">
            <span className="bg-[#3721ED]/10 text-[#3721ED] px-2 py-0.5 rounded-md font-medium text-xs">내부 팀 (수신자 142명)</span>
            <span className="text-slate-400 cursor-pointer hover:text-slate-600"><PlusCircleIcon /></span>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">제목</label>
          <input 
            type="text" 
            defaultValue={title}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm"
          />
        </div>
        <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-4 flex items-start gap-3">
          <div className="mt-0.5 text-amber-500"><Check className="w-4 h-4" /></div>
          <p className="text-sm text-amber-800 leading-relaxed">
            해당 문서를 선택된 모든 수신자에게 이메일로 발송합니다. 발송 전 AI로 생성된 내용을 모두 확인하셨나요?
          </p>
        </div>
      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
        <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200/50 rounded-xl transition-colors text-sm">
          취소
        </button>
        <button 
          onClick={onClose}
          className="px-6 py-2.5 bg-[#3721ED] text-white font-medium rounded-xl hover:bg-[#2c1ac0] transition-colors shadow-md shadow-[#3721ED]/25 text-sm flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          발송하기
        </button>
      </div>
    </ModalLayout>
  );
}
