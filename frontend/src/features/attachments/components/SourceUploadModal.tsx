import { useRef } from "react";
import { FileText, Image as ImageIcon, Link2, Plus, X } from "lucide-react";
import { ModalLayout } from "../../../components/shared/ModalLayout";

interface SourceUploadModalProps {
  onClose: () => void;
  onUpload: (type: "pdf" | "image", name: string) => void;
  onAddUrl: () => void;
}

export function SourceUploadModal({ onClose, onUpload, onAddUrl }: SourceUploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    files.forEach(file => {
      const type = file.type.includes("image") ? "image" : "pdf";
      onUpload(type, file.name);
    });
    
    e.target.value = "";
    onClose();
  };

  return (
    <ModalLayout isOpen={true} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800">자료 추가</h3>
            <p className="text-sm text-slate-500 mt-1">AI가 참고할 파일이나 링크를 업로드해주세요.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#3721ED] hover:bg-[#3721ED]/5 transition-all group"
          >
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-700">PDF 업로드</div>
              <div className="text-xs text-slate-400 mt-1">문서 및 리포트 파일</div>
            </div>
          </button>

          <button 
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#3721ED] hover:bg-[#3721ED]/5 transition-all group"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-700">이미지 업로드</div>
              <div className="text-xs text-slate-400 mt-1">JPG, PNG, WebP 형식</div>
            </div>
          </button>

          <button 
            onClick={() => { onClose(); onAddUrl(); }}
            className="col-span-2 flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-slate-700">웹사이트 URL 추가</div>
                <div className="text-xs text-slate-400 mt-0.5">공개된 링크에서 내용을 추출합니다.</div>
              </div>
            </div>
            <Plus className="w-5 h-5 text-slate-400 group-hover:text-emerald-500" />
          </button>
        </div>

        <input 
          type="file" 
          ref={fileRef} 
          className="hidden" 
          onChange={handleFileChange} 
          accept=".pdf,image/*" 
          multiple
        />
      </div>
    </ModalLayout>
  );
}
