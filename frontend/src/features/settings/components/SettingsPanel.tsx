import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { Attachment } from "../../../types/attachment";
import { AttachmentCard } from "../../../components/shared/AttachmentCard";

interface SettingsPanelProps {
  activeTab: "sources" | "settings";
  setActiveTab: (val: "sources" | "settings") => void;
  attachments: Attachment[];
  setItemToDelete: (id: string) => void;
  setPreviewItem: (file: Attachment) => void;
  tempTemplate: string;
  setTempTemplate: (val: string) => void;
  tempHeaderFooter: string;
  setTempHeaderFooter: (val: string) => void;
  template: string;
  headerFooter: string;
  handleRegenerate: () => void;
}

export function SettingsPanel({
  activeTab,
  setActiveTab,
  attachments,
  setItemToDelete,
  setPreviewItem,
  tempTemplate,
  setTempTemplate,
  tempHeaderFooter,
  setTempHeaderFooter,
  template,
  headerFooter,
  handleRegenerate
}: SettingsPanelProps) {
  return (
    <div className="w-72 bg-white border-l border-slate-200 flex flex-col z-10 shrink-0 shadow-sm shadow-slate-200/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex bg-slate-100/80 p-1 rounded-lg w-full">
          <button 
            onClick={() => setActiveTab("sources")}
            className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all ${activeTab === "sources" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            첨부 자료
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all ${activeTab === "settings" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            생성 설정
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {activeTab === "sources" && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">첨부된 자료 목록</h3>
            {attachments.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                첨부된 자료가 없습니다.
              </div>
            ) : (
              attachments.map(file => (
                <AttachmentCard 
                  key={file.id} 
                  file={file} 
                  variant="list" 
                  onRemove={(id) => setItemToDelete(id)}
                  onPreview={(file) => setPreviewItem(file)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">콘텐츠 템플릿</label>
              <select 
                value={tempTemplate}
                onChange={e => setTempTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED] outline-none"
              >
                <option value="뉴스레터">뉴스레터</option>
                <option value="인스타그램">인스타그램</option>
                <option value="블로그">블로그</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">옵션 테마 설정</label>
              <select 
                value={tempHeaderFooter}
                onChange={e => setTempHeaderFooter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED] outline-none"
              >
                <option value="기본값">기본값</option>
                <option value="강조형">강조형</option>
                <option value="창의형">창의형</option>
                <option value="미니멀">미니멀</option>
              </select>
            </div>

            {(tempTemplate !== template || tempHeaderFooter !== headerFooter) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2 border-t border-slate-100">
                <p className="text-xs text-amber-600 mb-3 bg-amber-50 p-2 rounded-lg border border-amber-100">설정이 변경되었습니다. 새로 생성하기를 누르면 테마가 변경됩니다.</p>
                <button 
                  onClick={handleRegenerate}
                  className="w-full flex items-center justify-center gap-2 bg-[#3721ED] text-white py-2.5 rounded-xl font-medium shadow-sm hover:bg-[#2c1ac0] transition-colors text-sm"
                >
                  <RefreshCw className="w-4 h-4" /> 새로 생성하기
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
