import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSessionStore } from "../store/useSessionStore";
import { Plus, X } from "lucide-react";
import { AttachmentCard } from "../components/shared/AttachmentCard";
import { SourceUploadModal } from "../features/attachments/components/SourceUploadModal";
import { GenerationPrompt } from "../features/newsletter/components/GenerationPrompt";
import { ModalLayout } from "../components/shared/ModalLayout";
import { useDashboard } from "../hooks/useDashboard";

export function DashboardPage() {
  const { 
    prompt, setPrompt, 
    template, setTemplate, 
    headerFooter, setHeaderFooter,
    attachments, removeAttachment
  } = useSessionStore();
  
  const {
    urlModalOpen,
    setUrlModalOpen,
    sourceModalOpen,
    setSourceModalOpen,
    urlInput,
    setUrlInput,
    isGenerating,
    handleGenerate,
    simulateUpload,
    handleAddUrl
  } = useDashboard();

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 max-w-5xl mx-auto w-full relative">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full text-center mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-[#3721ED]/80 tracking-tight mb-4 pb-2">오늘은 어떤 콘텐츠를 만들어 볼까요?</h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
          PDF 웹사이트 URL과 같은 자료를 첨부하고 필요한 내용을 설명하면 AI가 완벽한 초안을 완성합니다.
        </p>
      </motion.div>

      {/* Main Composer Component */}
      <GenerationPrompt 
        prompt={prompt}
        setPrompt={setPrompt}
        template={template}
        setTemplate={setTemplate}
        headerFooter={headerFooter}
        setHeaderFooter={setHeaderFooter}
        isGenerating={isGenerating}
        handleGenerate={handleGenerate}
      />

      {/* Attachment Sources */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-8 flex items-center gap-3 w-full max-w-4xl"
      >
        <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider mr-2">자료 첨부하기</span>
        <button onClick={() => setSourceModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm text-sm font-medium hover:text-[#3721ED]">
          <Plus className="w-4 h-4" />
          파일 및 링크 추가
        </button>
      </motion.div>

      {/* Attached Content List */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-4xl mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {attachments.map((file) => (
                <AttachmentCard 
                  key={file.id} 
                  file={file} 
                  variant="grid" 
                  onRemove={removeAttachment}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add URL Modal fallback */}
      <ModalLayout isOpen={urlModalOpen} onClose={() => setUrlModalOpen(false)} maxWidthClass="max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">웹사이트 URL 추가</h3>
          </div>
          <input 
            type="url" 
            autoFocus
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 placeholder-slate-400"
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
          />
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setUrlModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">
              취소
            </button>
            <button 
              onClick={handleAddUrl}
              disabled={!urlInput.trim()}
              className="px-5 py-2.5 bg-[#3721ED] text-white font-medium rounded-xl disabled:opacity-50 hover:bg-[#2c1ac0] transition-colors shadow-sm"
            >
              URL 추가
            </button>
          </div>
        </div>
      </ModalLayout>

      {/* Unified Attachments Modal */}
      <AnimatePresence>
        {sourceModalOpen && (
          <SourceUploadModal 
            onClose={() => setSourceModalOpen(false)} 
            onUpload={(type, name) => simulateUpload(type, name)}
            onAddUrl={() => setUrlModalOpen(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
