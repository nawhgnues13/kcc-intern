import { ImagePlus, X, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { ModalLayout } from "../../../components/shared/ModalLayout";

interface ImageReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGeneratingImage: boolean;
  imagePrompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerateClick: () => void;
  onUploadClick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ImageReplaceModal({ 
  isOpen, 
  onClose, 
  isGeneratingImage, 
  imagePrompt, 
  onPromptChange, 
  onGenerateClick, 
  onUploadClick 
}: ImageReplaceModalProps) {
  return (
    <ModalLayout isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-3xl">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ImagePlus className="w-5 h-5 text-[#3721ED]" />
          커버 이미지 변경
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200/50 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">
        {isGeneratingImage ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#3721ED] animate-spin mb-4" />
            <p className="font-medium text-slate-700">AI가 새로운 이미지를 생성하고 있습니다...</p>
            <p className="text-sm text-slate-400 mt-2 text-center max-w-xs">콘텐츠 내용에 어울리는 최적의 이미지를 만드는 중입니다.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-5 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-[#3721ED] hover:bg-[#3721ED]/5 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={onUploadClick}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">여기를 눌러 내 이미지 업로드</p>
              <p className="text-xs text-slate-500 mt-1">JPG, PNG, WebP 지원 (최대 5MB)</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-200"></div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">또는 AI 생성</span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">원하는 이미지를 묘사해주세요</label>
              <div className="relative">
                <textarea
                  value={imagePrompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  placeholder="예) 싱그러운 식물이 있는 모던한 느낌의 오피스 작업 공간..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 placeholder-slate-400 resize-none min-h-[100px]"
                />
                <button 
                  onClick={onGenerateClick}
                  disabled={!imagePrompt.trim()}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-[#3721ED] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#2c1ac0] transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 생성
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalLayout>
  );
}
