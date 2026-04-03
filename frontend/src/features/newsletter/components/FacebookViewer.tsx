import { useState } from "react";
import { 
  Facebook, 
  Copy, 
  Download, 
  Check, 
  Image as ImageIcon,
  ExternalLink,
  Globe,
  MoreHorizontal,
  ThumbsUp,
  MessageCircle,
  Share2
} from "lucide-react";
import { motion } from "motion/react";
import { FacebookPlatformOutput } from "../../../types/article";

interface FacebookViewerProps {
  platformOutput?: FacebookPlatformOutput | null;
  fallbackContent?: string;
}

export function FacebookViewer({ platformOutput, fallbackContent }: FacebookViewerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const postText = platformOutput?.postText || fallbackContent || "";
  const hashtags = platformOutput?.hashtags || [];
  const imageUrls = platformOutput?.imageDownloadUrls || [];

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAll = () => {
    const allText = `${postText}\n\n${hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(" ")}`;
    handleCopy(allText, "all");
  };

  const handleDownloadImages = () => {
    imageUrls.forEach((url, index) => {
      const link = document.createElement("a");
      link.href = `/api/utils/download-image?url=${encodeURIComponent(url)}&download=true`;
      link.download = `facebook-image-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F0F2F5]">
      {/* Action Header (Sticky) */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white">
            <Facebook className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">페이스북 콘텐츠 미리보기</h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">FB Feed Preview</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
          >
            {copiedField === "all" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            전체 복사
          </button>
          
          {imageUrls.length > 0 && (
            <button
              onClick={handleDownloadImages}
              className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              <Download className="w-4 h-4" />
              이미지 다운로드 ({imageUrls.length})
            </button>
          )}
        </div>
      </div>

      {/* FB Feed Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-[500px] mx-auto">
          {/* Post Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full bg-[#3721ED] flex items-center justify-center text-white text-xs font-black">KCC</div>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900 leading-tight hover:underline cursor-pointer">KCC Studio</h3>
                  <div className="flex items-center gap-1 text-[13px] text-slate-500">
                    <span>방금 전</span>
                    <span>·</span>
                    <Globe className="w-3 h-3" />
                  </div>
                </div>
              </div>
              <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* Body Text */}
            <div className="px-4 pb-3">
                <p className="text-[15px] text-slate-900 leading-[1.333] whitespace-pre-wrap">
                    {postText}
                </p>
                {hashtags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-1">
                        {hashtags.map((tag, i) => (
                            <span key={i} className="text-[15px] text-[#1877F2] hover:underline cursor-pointer">
                                #{tag.replace("#", "")}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Images Grid */}
            {imageUrls.length > 0 && (
                <div className={`grid gap-0.5 border-y border-slate-100 ${
                    imageUrls.length === 1 ? 'grid-cols-1' : 
                    imageUrls.length === 2 ? 'grid-cols-2' : 
                    'grid-cols-2'
                }`}>
                    {imageUrls.slice(0, 4).map((url, i) => (
                        <div key={i} className={`relative bg-slate-100 overflow-hidden ${
                            imageUrls.length === 1 ? 'aspect-auto' : 'aspect-square'
                        }`}>
                            <img src={url} alt={`FB Post ${i}`} className="w-full h-full object-cover" />
                            {i === 3 && imageUrls.length > 4 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <span className="text-white text-3xl font-bold">+{imageUrls.length - 4}</span>
                                </div>
                            )}
                            <button 
                                onClick={() => handleCopy(url, `img-${i}`)}
                                className="absolute top-2 right-2 p-1.5 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Copy className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Like/Comment Summary */}
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 mx-1">
                <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                        <div className="w-4.5 h-4.5 rounded-full bg-[#1877F2] flex items-center justify-center border border-white">
                            <ThumbsUp className="w-2.5 h-2.5 text-white fill-white" />
                        </div>
                    </div>
                    <span className="text-[13px] text-slate-500 hover:underline cursor-pointer">12</span>
                </div>
                <div className="flex gap-2 text-[13px] text-slate-500">
                    <span className="hover:underline cursor-pointer">댓글 2개</span>
                    <span className="hover:underline cursor-pointer">공유 1회</span>
                </div>
            </div>

            {/* Interaction Buttons */}
            <div className="px-1 py-1 flex">
                <button className="flex-1 flex items-center justify-center gap-2 py-1.5 hover:bg-slate-50 rounded-md text-slate-500 font-bold text-sm transition-colors">
                    <ThumbsUp className="w-5 h-5" /> 좋아요
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-1.5 hover:bg-slate-50 rounded-md text-slate-500 font-bold text-sm transition-colors">
                    <MessageCircle className="w-5 h-5" /> 댓글 달기
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-1.5 hover:bg-slate-50 rounded-md text-slate-500 font-bold text-sm transition-colors">
                    <Share2 className="w-5 h-5" /> 공유하기
                </button>
            </div>
          </motion.div>

          {/* Guide Memo */}
          <div className="mt-8 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-[#1877F2]" /> 페이스북 게시 안내
            </h4>
            <div className="space-y-3">
                <div className="flex gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[#1877F2] text-xs font-bold">1</div>
                    <p className="text-sm text-slate-600 leading-relaxed">상단 <b>'전체 복사'</b> 버튼을 클릭하여 본문을 클립보드에 담으세요.</p>
                </div>
                <div className="flex gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[#1877F2] text-xs font-bold">2</div>
                    <p className="text-sm text-slate-600 leading-relaxed"><b>'이미지 다운로드'</b> 버튼으로 생성된 고화질 이미지를 내 기기에 저장하세요.</p>
                </div>
                <div className="flex gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[#1877F2] text-xs font-bold">3</div>
                    <p className="text-sm text-slate-600 leading-relaxed">페이스북 전용 웹/앱에서 복사한 내용을 붙여넣고 게시물을 완성하세요.</p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
