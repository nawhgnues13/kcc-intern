import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Clock, User, ArrowUpRight, FileText, Instagram, Image as ImageIcon } from "lucide-react";

import { ContentTaskResult } from "../../../types/contentTask";

interface ResultCardProps {
  result: ContentTaskResult;
  onClick: (result: ContentTaskResult) => void;
}

function getSourceTypeLabel(type: string) {
  switch (type) {
    case "sale":
      return "차량 구매";
    case "service":
      return "차량 수리";
    case "grooming":
      return "애견 미용";
    default:
      return type;
  }
}

function getSourceTypeColor(type: string) {
  switch (type) {
    case "sale":
      return "bg-blue-50 text-blue-600 border-blue-100";
    case "service":
      return "bg-amber-50 text-amber-600 border-amber-100";
    case "grooming":
      return "bg-rose-50 text-rose-600 border-rose-100";
    default:
      return "bg-slate-50 text-slate-600 border-slate-100";
  }
}

function getDisplayImageUrl(url?: string | null) {
  const value = (url || "").trim();
  if (!value || !value.startsWith("http")) {
    return value || null;
  }

  return `/api/utils/download-image?url=${encodeURIComponent(value)}&download=false`;
}

export function ResultCard({ result, onClick }: ResultCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const displayImageUrl = useMemo(
    () => (imageFailed ? null : getDisplayImageUrl(result.thumbnailUrl)),
    [imageFailed, result.thumbnailUrl],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={() => onClick(result)}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl"
    >
      <div className="relative h-48 overflow-hidden bg-slate-100">
        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={result.articleTitle || "콘텐츠 썸네일"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-300">
            {result.contentFormat === "instagram" ? (
              <Instagram className="h-12 w-12 opacity-20" />
            ) : (
              <ImageIcon className="h-12 w-12 opacity-20" />
            )}
          </div>
        )}

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
              result.contentFormat === "instagram"
                ? "border-pink-400 bg-pink-500 text-white"
                : "border-[#3721ED] bg-[#3721ED] text-white"
            }`}
          >
            {result.contentFormat === "instagram" ? "Instagram" : "Blog"}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-sm ${getSourceTypeColor(result.sourceType)}`}
          >
            {getSourceTypeLabel(result.sourceType)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-center gap-3 text-[11px] font-medium text-slate-400">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {result.completedAt
              ? new Date(result.completedAt).toLocaleDateString()
              : new Date(result.createdAt).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {result.assignedEmployeeName || "미지정"}
          </div>
        </div>

        <h3 className="mb-2 line-clamp-2 break-keep text-lg font-bold leading-snug text-slate-800 transition-colors [word-break:keep-all] group-hover:text-[#3721ED]">
          {result.articleTitle || result.summary || "제목 없음"}
        </h3>

        <p className="mb-4 flex-1 line-clamp-2 break-keep text-sm font-medium leading-relaxed text-slate-500 [word-break:keep-all]">
          {result.summary || "생성된 콘텐츠의 요약 정보가 없습니다."}
        </p>

        <div className="flex items-center justify-between border-t border-slate-50 pt-4">
          <div className="text-xs font-semibold text-slate-400">
            고객명: <span className="text-slate-700">{result.customerName || "미지정"}</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 transition-all duration-300 group-hover:bg-[#3721ED] group-hover:text-white">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
