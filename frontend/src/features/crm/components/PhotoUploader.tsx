import { useEffect, useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { CrmPhoto } from "../../../services/api/crmService";

interface PhotoUploaderProps {
  existingPhotos: CrmPhoto[];
  onKeepPhotosChange: (photoIds: string[]) => void;
  newFiles: File[];
  onNewFilesChange: (files: File[]) => void;
  
  // descriptions
  existingDescriptions?: Record<string, string>;
  onExistingDescriptionChange?: (photoId: string, desc: string) => void;
  newDescriptions?: string[];
  onNewDescriptionChange?: (index: number, desc: string) => void;
  onNewFileRemove?: (index: number) => void;
}

export function PhotoUploader({
  existingPhotos,
  onKeepPhotosChange,
  newFiles,
  onNewFilesChange,
  existingDescriptions = {},
  onExistingDescriptionChange,
  newDescriptions = [],
  onNewDescriptionChange,
  onNewFileRemove
}: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track kept existing photos by ID
  const [keptIds, setKeptIds] = useState<string[]>(existingPhotos.map(p => p.photoId));

  useEffect(() => {
    const nextIds = existingPhotos.map((photo) => photo.photoId);
    setKeptIds(nextIds);
    onKeepPhotosChange(nextIds);
  }, [existingPhotos, onKeepPhotosChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      onNewFilesChange([...newFiles, ...filesArr]);
    }
  };

  const removeNewFile = (index: number) => {
    const updated = [...newFiles];
    updated.splice(index, 1);
    onNewFilesChange(updated);
    if (onNewFileRemove) {
      onNewFileRemove(index);
    }
  };

  const removeExistingPhoto = (photoId: string) => {
    const updated = keptIds.filter(id => id !== photoId);
    setKeptIds(updated);
    onKeepPhotosChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700 block">사진 첨부</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs flex items-center gap-1 text-[#3721ED] bg-[#3721ED]/10 px-3 py-1.5 rounded-lg hover:bg-[#3721ED]/20 transition-colors font-medium"
        >
          <Upload className="w-3.5 h-3.5" /> 직접 올리기
        </button>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Render existing kept photos */}
        {existingPhotos.filter(p => keptIds.includes(p.photoId)).map((photo) => (
          <div key={photo.photoId} className="flex flex-col gap-2">
            <div className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-50">
              <img src={photo.fileUrl} alt="업로드 이미지" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(photo.photoId)}
                  className="p-2 bg-white/20 hover:bg-rose-500 rounded-full text-white transition-colors"
                  title="삭제"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/40 text-white text-[10px] rounded backdrop-blur border border-white/20">
                기존
              </div>
            </div>
            <input
              type="text"
              placeholder="사진 설명을 입력하세요"
              value={existingDescriptions[photo.photoId] || ""}
              onChange={(e) => onExistingDescriptionChange?.(photo.photoId, e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#3721ED] focus:ring-1 focus:ring-[#3721ED]"
            />
          </div>
        ))}

        {/* Render new files */}
        {newFiles.map((file, idx) => (
          <div key={`new-${idx}`} className="flex flex-col gap-2">
            <div className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-50">
              <img src={URL.createObjectURL(file)} alt="새 이미지" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeNewFile(idx)}
                  className="p-2 bg-white/20 hover:bg-rose-500 rounded-full text-white transition-colors"
                  title="삭제"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#3721ED] text-white text-[10px] rounded shadow-sm">
                신규
              </div>
            </div>
            <input
              type="text"
              placeholder="사진 설명을 입력하세요"
              value={newDescriptions[idx] || ""}
              onChange={(e) => onNewDescriptionChange?.(idx, e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#3721ED] focus:ring-1 focus:ring-[#3721ED]"
            />
          </div>
        ))}
        
        {keptIds.length === 0 && newFiles.length === 0 && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl aspect-video flex flex-col items-center justify-center text-slate-400 hover:border-[#3721ED]/50 hover:bg-[#3721ED]/5 transition-colors cursor-pointer col-span-2 sm:col-span-1"
          >
            <ImageIcon className="w-6 h-6 mb-2 text-slate-300" />
            <span className="text-xs">사진 추가</span>
          </div>
        )}
      </div>
    </div>
  );
}
