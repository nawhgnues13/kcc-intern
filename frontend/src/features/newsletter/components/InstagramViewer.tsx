import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Image as ImageIcon,
  Instagram,
} from "lucide-react";

interface InstagramViewerProps {
  platformOutput?: any;
  fallbackContent?: string;
  showControls?: boolean;
}

const isRenderableImageSource = (src?: string) => {
  const value = (src || "").trim();
  if (!value || value === "undefined" || value === "null") return false;

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("blob:") ||
    value.startsWith("/")
  );
};

const toDisplayImageUrl = (src: string) =>
  src.startsWith("http://") || src.startsWith("https://")
    ? `/api/utils/download-image?url=${encodeURIComponent(src)}&download=false`
    : src;

export function InstagramViewer({
  platformOutput,
  fallbackContent,
  showControls = true,
}: InstagramViewerProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  const images = useMemo(() => {
    if (platformOutput?.imageDownloadUrls?.length) {
      return platformOutput.imageDownloadUrls.filter((src: string) => isRenderableImageSource(src));
    }

    if (fallbackContent) {
      try {
        const parsed = typeof fallbackContent === "string" ? JSON.parse(fallbackContent) : fallbackContent;
        if (parsed?.content) {
          return parsed.content
            .filter((node: any) => node.type === "image" && isRenderableImageSource(node.attrs?.src))
            .map((node: any) => node.attrs.src);
        }
      } catch (error) {
        console.error("Failed to parse fallback content:", error);
      }
    }

    return [];
  }, [fallbackContent, platformOutput]);

  const visibleImages = useMemo(
    () => images.filter((src: string) => !failedImages.includes(src)),
    [failedImages, images],
  );

  const safeSlideIndex = Math.min(currentSlide, Math.max(visibleImages.length - 1, 0));
  const postText = platformOutput?.postText || "";
  const hashtags = platformOutput?.hashtags || [];

  const getDownloadUrl = (url: string) =>
    `/api/utils/download-image?url=${encodeURIComponent(url)}&download=true`;

  const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = getDownloadUrl(url);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async (type: "text" | "tags" | "all") => {
    let textToCopy = "";

    if (type === "text") {
      textToCopy = postText;
    } else if (type === "tags") {
      textToCopy = hashtags.join(" ");
    } else {
      textToCopy = `${postText}\n\n${hashtags.join(" ")}`.trim();
    }

    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2000);
    } catch (error) {
      console.error("Failed to copy Instagram content:", error);
    }
  };

  const handleDownloadImage = (url: string, index: number) => {
    triggerDownload(url, `instagram-image-${index + 1}.jpg`);
  };

  const handleDownloadAllImages = () => {
    visibleImages.forEach((url: string, index: number) => {
      window.setTimeout(() => {
        triggerDownload(url, `instagram-image-${index + 1}.jpg`);
      }, index * 150);
    });
  };

  const handleImageError = (src: string) => {
    setFailedImages((prev) => (prev.includes(src) ? prev : [...prev, src]));
    setCurrentSlide(0);
  };

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-slate-50">
      {showControls ? (
        <div className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-8 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Instagram className="h-5 w-5 text-pink-500" />
            인스타그램 업로드 준비
          </h2>

          <div className="flex flex-wrap gap-2">
            {visibleImages.length > 0 ? (
              <button
                onClick={() => handleDownloadImage(visibleImages[safeSlideIndex], safeSlideIndex)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-200"
              >
                <Download className="h-4 w-4" />
                이미지 다운로드
              </button>
            ) : null}

            {visibleImages.length > 1 ? (
              <button
                onClick={handleDownloadAllImages}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-200"
              >
                <Download className="h-4 w-4" />
                전체 다운로드
              </button>
            ) : null}

            <button
              onClick={() => handleCopy("all")}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 to-orange-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
            >
              {copiedType === "all" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedType === "all" ? "전체 복사 완료" : "본문 + 해시태그 복사"}
            </button>
          </div>
        </div>
      ) : null}

      <div className={`flex flex-1 flex-col items-center overflow-y-auto bg-slate-100/50 p-4 md:p-12 ${showControls ? "pt-20" : "pt-8"}`}>
        <div className="relative mb-20 flex w-full max-w-[420px] origin-top flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px]">
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white">
                <Instagram className="h-4 w-4 text-slate-700" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">kcc_information</p>
              <p className="text-xs text-slate-500">새 게시물 미리보기</p>
            </div>
          </div>

          <div className="group relative aspect-square overflow-hidden border-b border-slate-50 bg-slate-100">
            {visibleImages.length > 0 ? (
              <>
                <div
                  className="flex h-full w-full transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${safeSlideIndex * 100}%)` }}
                >
                  {visibleImages.map((src: string, idx: number) => (
                    <div key={`${src}-${idx}`} className="relative flex h-full min-w-full items-center justify-center">
                      <img
                        src={toDisplayImageUrl(src)}
                        alt={`instagram-slide-${idx + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={() => handleImageError(src)}
                      />

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDownloadImage(src, idx);
                        }}
                        className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
                      >
                        <Download className="h-4 w-4" />
                        <span className="text-xs font-medium">다운로드</span>
                      </button>
                    </div>
                  ))}
                </div>

                {visibleImages.length > 1 ? (
                  <>
                    <button
                      onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                      disabled={safeSlideIndex === 0}
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-opacity disabled:opacity-0"
                    >
                      <ChevronLeft className="h-5 w-5 text-slate-800" />
                    </button>

                    <button
                      onClick={() => setCurrentSlide((prev) => Math.min(visibleImages.length - 1, prev + 1))}
                      disabled={safeSlideIndex === visibleImages.length - 1}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-opacity disabled:opacity-0"
                    >
                      <ChevronRight className="h-5 w-5 text-slate-800" />
                    </button>

                    <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
                      {visibleImages.map((_: string, idx: number) => (
                        <div
                          key={idx}
                          className={`h-1.5 w-1.5 rounded-full transition-all ${
                            safeSlideIndex === idx ? "scale-125 bg-blue-500" : "bg-white/60"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                <ImageIcon className="h-8 w-8 opacity-50" />
                <span className="text-sm">표시할 이미지가 없습니다</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-4 py-3 text-slate-800">
            <div className="flex items-center gap-4">
              <span className="cursor-pointer hover:text-rose-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.780 9-12Z" />
                </svg>
              </span>
              <span className="cursor-pointer hover:text-slate-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-text8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785c-.442.492.113 1.07.493.857 1.122-.632 2.307-1.12 3.526-1.465a1.13 1.13 0 0 1 .845.04c.676.3 1.413.447 2.176.447Z" />
                </svg>
              </span>
              <span className="cursor-pointer hover:text-blue-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </span>
            </div>
            <span className="cursor-pointer hover:text-amber-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
            </span>
          </div>

          <div className="min-h-[280px] flex-1 overflow-y-auto px-5 pb-8">
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">게시글 본문</span>
                <button
                  onClick={() => handleCopy("text")}
                  className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                >
                  {copiedType === "text" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  본문만 복사
                </button>
              </div>
              <div className="break-keep whitespace-pre-wrap text-sm leading-relaxed text-slate-800 [word-break:keep-all]">
                <span className="mr-2 font-semibold">kcc_information</span>
                {postText || "생성된 본문이 없습니다."}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">해시태그</span>
                <button
                  onClick={() => handleCopy("tags")}
                  className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                >
                  {copiedType === "tags" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  해시태그 복사
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {hashtags.length > 0 ? (
                  hashtags.map((tag: string, index: number) => (
                    <span
                      key={`${tag}-${index}`}
                      className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">해시태그가 없습니다.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
