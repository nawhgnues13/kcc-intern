import { motion } from "motion/react";
import { Clock, User, ArrowUpRight, FileText, Instagram } from "lucide-react";
import { ContentTaskResult } from "../../../types/contentTask";

interface ResultCardProps {
  result: ContentTaskResult;
  onClick: (result: ContentTaskResult) => void;
}

export function ResultCard({ result, onClick }: ResultCardProps) {
  const getSourceTypeLabel = (type: string) => {
    switch (type) {
      case "sale": return "차량 구매";
      case "service": return "차량 수리";
      case "grooming": return "애견 미용";
      default: return type;
    }
  };

  const getSourceTypeColor = (type: string) => {
    switch (type) {
      case "sale": return "bg-blue-50 text-blue-600 border-blue-100";
      case "service": return "bg-amber-50 text-amber-600 border-amber-100";
      case "grooming": return "bg-rose-50 text-rose-600 border-rose-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => onClick(result)}
      className="group bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full"
    >
      {/* Thumbnail */}
      <div className="relative h-48 bg-slate-100 overflow-hidden">
        {result.thumbnailUrl ? (
          <img 
            src={result.thumbnailUrl} 
            alt={result.articleTitle || "Thumbnail"} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
            {result.contentFormat === "instagram" ? (
              <Instagram className="w-12 h-12 opacity-20" />
            ) : (
              <FileText className="w-12 h-12 opacity-20" />
            )}
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border ${
            result.contentFormat === "instagram" ? "bg-pink-500 text-white border-pink-400" : "bg-[#3721ED] text-white border-[#3721ED]"
          }`}>
            {result.contentFormat === "instagram" ? "Instagram" : "Blog"}
          </span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm ${getSourceTypeColor(result.sourceType)}`}>
            {getSourceTypeLabel(result.sourceType)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400 mb-3">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {result.completedAt ? new Date(result.completedAt).toLocaleDateString() : new Date(result.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {result.assignedEmployeeName || "시스템 자동"}
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-1 group-hover:text-[#3721ED] transition-colors">
          {result.articleTitle || result.summary || "제목 없음"}
        </h3>
        
        <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-1 font-medium leading-relaxed">
          {result.summary || "생성된 콘텐츠의 요약 정보가 없습니다."}
        </p>

        <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-400">
            고객명: <span className="text-slate-700">{result.customerName || "미지원"}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#3721ED] group-hover:text-white transition-all duration-300">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
