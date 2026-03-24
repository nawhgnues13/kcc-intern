import { useState, useMemo } from "react";
import { Copy, CheckCircle2, Download, Instagram, Hash, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

interface InstagramViewerProps {
  platformOutput?: any;
  fallbackContent?: string;
}

export function InstagramViewer({ platformOutput, fallbackContent }: InstagramViewerProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Extract images
  const images = useMemo(() => {
    if (platformOutput?.imageDownloadUrls && platformOutput.imageDownloadUrls.length > 0) {
      return platformOutput.imageDownloadUrls;
    }
    // Fallback: parse Tiptap JSON
    if (fallbackContent) {
      try {
        const parsed = typeof fallbackContent === 'string' ? JSON.parse(fallbackContent) : fallbackContent;
        if (parsed?.content) {
          const imgNodes = parsed.content.filter((n: any) => n.type === 'image' && n.attrs?.src);
          return imgNodes.map((n: any) => n.attrs.src);
        }
      } catch (e) {
        // ignore
      }
    }
    return [];
  }, [platformOutput, fallbackContent]);

  const postText = platformOutput?.postText || "";
  const hashtags = platformOutput?.hashtags || [];

  const handleCopy = async (type: "text" | "tags" | "all") => {
    let textToCopy = "";
    if (type === "text") {
      textToCopy = postText;
    } else if (type === "tags") {
      textToCopy = hashtags.join(" ");
    } else {
      textToCopy = `${postText}\n\n${hashtags.join(" ")}`;
    }

    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  // We use a backend utility proxy to bypass S3 CORS restrictions and force a direct file download.
  const getDownloadUrl = (url: string) => {
    return `/api/utils/download-image?url=${encodeURIComponent(url)}`;
  };

  const handleDownloadImage = (url: string) => {
    window.location.href = getDownloadUrl(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header - Persistent at top without absolute positioning to prevent overlap */}
      <div className="flex-shrink-0 h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 z-10 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Instagram className="w-5 h-5 text-pink-500" /> 인스타그램 업로드 준비
        </h2>
        <div className="flex gap-2">
          {images.length > 0 && (
            <a 
              href={getDownloadUrl(images[currentSlide])}
              download={`instagram-image-${currentSlide + 1}.png`}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition shadow-sm border border-slate-200"
            >
              <Download className="w-4 h-4" />
              이미지 다운로드
            </a>
          )}
          <button 
            onClick={() => handleCopy("all")}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-400 text-white rounded-lg text-sm font-medium hover:opacity-90 transition shadow-sm"
          >
            {copiedType === "all" ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
            {copiedType === "all" ? "전체 복사완료!" : "텍스트+태그 전체 복사"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-12 pt-20 bg-slate-100/50 flex flex-col items-center">
        {/* Mobile Card Layout */}
        <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col relative mb-20 origin-top">
          
          {/* Top Bar Fake UI */}
          <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px]">
              <div className="w-full h-full bg-white rounded-full border-2 border-white flex items-center justify-center overflow-hidden">
                <Instagram className="w-4 h-4 text-slate-700" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">kcc_information</p>
              <p className="text-xs text-slate-500">새 게시물 미리보기</p>
            </div>
          </div>

          {/* Image Slider - Changed from aspect-square to 4:3 to give more room to text */}
          <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden group border-b border-slate-50">
            {images.length > 0 ? (
              <>
                <div 
                  className="flex h-full w-full transition-transform duration-300 ease-in-out" 
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {images.map((src: string, idx: number) => (
                    <div key={idx} className="min-w-full h-full flex items-center justify-center relative">
                      <img 
                        src={src} 
                        alt={`slide-${idx}`} 
                        className="w-full h-full object-cover"
                      />
                      {/* Individual Download Button Hover */}
                      <a 
                         href={getDownloadUrl(src)}
                         download={`instagram-image-${idx + 1}.png`}
                         onClick={(e) => e.stopPropagation()} // in case there's an upward click handler
                         className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 shadow-lg flex items-center gap-1.5 px-3"
                      >
                        <Download className="w-4 h-4" />
                        <span className="text-xs font-medium">저장</span>
                      </a>
                    </div>
                  ))}
                </div>

                {/* Slider Controls */}
                {images.length > 1 && (
                  <>
                    <button 
                      onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                      disabled={currentSlide === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-md disabled:opacity-0 transition-opacity"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-800" />
                    </button>
                    <button 
                      onClick={() => setCurrentSlide(prev => Math.min(images.length - 1, prev + 1))}
                      disabled={currentSlide === images.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow-md disabled:opacity-0 transition-opacity"
                    >
                      <ChevronRight className="w-5 h-5 text-slate-800" />
                    </button>
                    {/* Dots indicator */}
                    <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
                      {images.map((_: string, idx: number) => (
                        <div 
                          key={idx} 
                          className={`w-1.5 h-1.5 rounded-full transition-all ${currentSlide === idx ? 'bg-blue-500 scale-125' : 'bg-white/60'}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 flex-col gap-2">
                <ImageIcon className="w-8 h-8 opacity-50" />
                <span className="text-sm">이미지가 없습니다</span>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="px-4 py-3 flex gap-4">
            <button className="text-slate-800 hover:text-slate-600"><span className="text-xl">🤍</span></button>
            <button className="text-slate-800 hover:text-slate-600"><span className="text-xl">💬</span></button>
            <button className="text-slate-800 hover:text-slate-600"><span className="text-xl">↗️</span></button>
          </div>

          {/* Content Area - Ensure more space for text */}
          <div className="px-5 pb-8 flex-1 overflow-y-auto min-h-[280px]">
            
            {/* Post Text */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-slate-800">게시글 본문</span>
                <button 
                  onClick={() => handleCopy("text")}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition"
                >
                  {copiedType === "text" ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  본문만 복사
                </button>
              </div>
              <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                <span className="font-semibold mr-2">kcc_information</span>
                {postText || "생성된 본문이 없습니다."}
              </div>
            </div>

            {/* Hashtags */}
            <div className="pt-4 border-t border-slate-100">
               <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm text-slate-800">해시태그</span>
                <button 
                  onClick={() => handleCopy("tags")}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition"
                >
                  {copiedType === "tags" ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  태그만 복사
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hashtags.length > 0 ? hashtags.map((tag: string, i: number) => (
                  <span key={i} className="inline-flex items-center text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                    {tag}
                  </span>
                )) : (
                  <span className="text-sm text-slate-400">태그가 없습니다.</span>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
