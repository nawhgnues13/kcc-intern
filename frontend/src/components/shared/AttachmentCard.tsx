import { motion } from "motion/react";
import { FileText, Image as ImageIcon, Link2, Eye, Trash2 } from "lucide-react";
import { Attachment } from "../../types/attachment";

interface AttachmentCardProps {
  file: Attachment;
  variant?: "grid" | "list";
  onRemove?: (id: string) => void;
  onPreview?: (file: Attachment) => void;
}

export function AttachmentCard({ 
  file, 
  variant = "grid", 
  onRemove, 
  onPreview 
}: AttachmentCardProps) {
  
  const iconConfig = {
    pdf: { bg: "bg-rose-50", text: "text-rose-500", Icon: FileText },
    image: { bg: "bg-blue-50", text: "text-blue-500", Icon: ImageIcon },
    url: { bg: "bg-emerald-50", text: "text-emerald-500", Icon: Link2 },
  };

  const { bg, text, Icon } = iconConfig[file.type] || iconConfig.pdf;

  if (variant === "list") {
    // List layout (used in Workspace right panel)
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="group relative bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3 hover:border-[#3721ED]/30 hover:shadow-sm transition-all cursor-pointer"
        onClick={() => onPreview?.(file)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg} ${text}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
          <p className="text-xs text-slate-400 capitalize">{file.type}</p>
        </div>
        {onRemove && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(file.id); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all absolute right-2 top-2"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    );
  }

  // Grid layout (used in Dashboard)
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      layout
      className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-4 relative group hover:border-[#3721ED]/30 transition-colors"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg} ${text}`}>
        <Icon className="w-5 h-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate font-[ui-sans-serif]">{file.name}</p>
        {file.status === "uploading" ? (
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <motion.div 
              className="bg-[#3721ED] h-full"
              initial={{ width: 0 }}
              animate={{ width: `${file.progress || 0}%` }}
            />
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-1 capitalize">{file.type} • Ready</p>
        )}
      </div>

      {file.status === "completed" && (
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-100">
          {onPreview && (
            <button 
              onClick={() => onPreview(file)}
              className="p-1.5 text-slate-400 hover:text-[#3721ED] hover:bg-[#3721ED]/10 rounded-md transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {onRemove && (
            <button 
              onClick={() => onRemove(file.id)}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
