import { motion } from "motion/react";
import { LayoutTemplate, BoxSelect, Loader2, Sparkles } from "lucide-react";
import { SelectDropdown } from "../../../components/shared/SelectDropdown";

interface GenerationPromptProps {
  prompt: string;
  setPrompt: (val: string) => void;
  template: string;
  setTemplate: (val: string) => void;
  headerFooter: string;
  setHeaderFooter: (val: string) => void;
  isGenerating: boolean;
  handleGenerate: () => void;
  onPasteImage?: (file: File) => void;
}

export function GenerationPrompt({
  prompt,
  setPrompt,
  template,
  setTemplate,
  headerFooter,
  setHeaderFooter,
  isGenerating,
  handleGenerate,
  onPasteImage
}: GenerationPromptProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
      className="w-full max-w-4xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-2 flex flex-col relative focus-within:ring-4 focus-within:ring-[#3721ED]/10 transition-all duration-300"
    >
      {/* Text Area */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onPaste={(e) => {
          if (onPasteImage && e.clipboardData && e.clipboardData.files.length > 0) {
            const files = Array.from(e.clipboardData.files);
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            if (imageFiles.length > 0) {
              // Only prevent default if we actually handled an image paste
              // This allows normal text pasting to continue working seamlessly
              e.preventDefault();
              imageFiles.forEach(file => onPasteImage(file));
            }
          }
        }}
        placeholder="예) 첨부된 기사들을 요약해서 IT 트렌드 뉴스레터로 만들어줘..."
        className="w-full bg-transparent min-h-[140px] p-6 text-xl placeholder-slate-300 border-none resize-none focus:outline-none focus:ring-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-slate-800"
      />

      {/* Composer Controls */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-slate-50/50 rounded-2xl gap-4 border-t border-slate-50 relative z-20">
        <div className="flex flex-wrap items-center gap-2">
          <SelectDropdown 
            icon={<LayoutTemplate className="w-4 h-4 text-[#3721ED]" />}
            label="템플릿"
            value={template} 
            options={["뉴스레터", "인스타그램", "블로그"]} 
            onChange={setTemplate} 
          />
          <SelectDropdown 
            icon={<BoxSelect className="w-4 h-4 text-emerald-500" />}
            label="옵션"
            value={headerFooter} 
            options={["기본값", "강조형", "창의형", "미니멀"]} 
            onChange={setHeaderFooter} 
          />
        </div>
        
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="ml-auto bg-[#3721ED] text-white px-6 py-3 rounded-xl font-medium shadow-md shadow-[#3721ED]/25 hover:bg-[#2c1ac0] hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          <span>생성하기</span>
        </button>
      </div>
    </motion.div>
  );
}
