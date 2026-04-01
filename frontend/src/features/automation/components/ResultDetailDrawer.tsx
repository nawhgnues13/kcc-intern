import { useEffect, useMemo, useState } from "react";
import {
  X,
  ExternalLink,
  Calendar,
  User,
  FileText,
  Instagram,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { newsletterService } from "../../../services/api/newsletterService";
import { contentTaskService } from "../../../services/api/contentTaskService";
import { ContentTaskResult, InstagramPublishResponse } from "../../../types/contentTask";
import { BlogViewer } from "../../newsletter/components/BlogViewer";
import { InstagramViewer } from "../../newsletter/components/InstagramViewer";

interface ResultDetailDrawerProps {
  result: ContentTaskResult | null;
  onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  sale: "차량 판매",
  service: "차량 수리",
  grooming: "애견 미용",
};

export function ResultDetailDrawer({ result, onClose }: ResultDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [articleData, setArticleData] = useState<any>(null);
  const [publishFeedback, setPublishFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadDetail(articleId: string) {
    setLoading(true);
    try {
      const data = await newsletterService.getNewsletter(articleId);
      setArticleData(data);
    } catch (error) {
      console.error("Failed to load article detail:", error);
      setArticleData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!result?.articleId) {
      setArticleData(null);
      return;
    }

    setPublishFeedback(null);
    loadDetail(result.articleId);
  }, [result]);

  const isInstagram = result?.contentFormat === "instagram";
  const instagramPublish = articleData?.instagramPublish;
  const instagramPermalink = instagramPublish?.publishedPermalink;
  const platformOutput = articleData?.platformOutput;

  const instagramImageUrls = useMemo(() => {
    const raw = Array.isArray(platformOutput?.imageDownloadUrls) ? platformOutput.imageDownloadUrls : [];
    return raw.filter((url: string) => typeof url === "string" && url.startsWith("http"));
  }, [platformOutput]);

  const copyText = useMemo(() => {
    const postText = platformOutput?.postText || "";
    const hashtags = Array.isArray(platformOutput?.hashtags) ? platformOutput.hashtags.join(" ") : "";
    return [postText, hashtags].filter(Boolean).join("\n\n").trim();
  }, [platformOutput]);

  async function handlePublishInstagram() {
    if (!result?.taskId) return;

    setPublishing(true);
    setPublishFeedback(null);
    try {
      const response: InstagramPublishResponse = await contentTaskService.publishInstagram(result.taskId, {});
      setPublishFeedback({
        type: "success",
        message: response.publishInfo.publishedPermalink
          ? "인스타그램 게시가 완료되었습니다."
          : "인스타그램 업로드 요청이 완료되었습니다.",
      });

      if (result.articleId) {
        await loadDetail(result.articleId);
      }
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        "인스타그램 업로드에 실패했습니다. 토큰, 계정 연결, 이미지 URL을 확인해주세요.";
      setPublishFeedback({ type: "error", message: String(detail) });
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopy(type: "text" | "tags" | "all") {
    const postText = platformOutput?.postText || "";
    const hashtags = Array.isArray(platformOutput?.hashtags) ? platformOutput.hashtags.join(" ") : "";
    const textToCopy =
      type === "text" ? postText : type === "tags" ? hashtags : [postText, hashtags].filter(Boolean).join("\n\n").trim();

    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setPublishFeedback({
        type: "success",
        message:
          type === "text" ? "본문을 복사했습니다." : type === "tags" ? "해시태그를 복사했습니다." : "본문과 해시태그를 복사했습니다.",
      });
    } catch (error) {
      console.error("Failed to copy Instagram content:", error);
      setPublishFeedback({ type: "error", message: "복사에 실패했습니다." });
    }
  }

  function downloadImage(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = `/api/utils/download-image?url=${encodeURIComponent(url)}&download=true`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadAllImages() {
    instagramImageUrls.forEach((url: string, index: number) => {
      window.setTimeout(() => {
        downloadImage(url, `instagram-image-${index + 1}.jpg`);
      }, index * 150);
    });
  }

  if (!result) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative flex h-full w-full max-w-5xl flex-col bg-white shadow-2xl"
        >
          {/* New Integrated Header */}
          <div className="flex shrink-0 flex-col border-b border-slate-100">
            <div className="flex items-start justify-between px-8 py-6">
              <div className="flex gap-4">
                <div
                  className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                    isInstagram ? "bg-gradient-to-br from-pink-500 to-orange-400 text-white" : "bg-[#3721ED] text-white"
                  }`}
                >
                  {isInstagram ? <Instagram className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black tracking-tight text-slate-800">
                      {isInstagram ? "인스타그램 게시물 관리" : "블로그 콘텐츠 상세보기"}
                    </h2>
                    {isInstagram && (instagramPublish || publishFeedback) && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${
                          instagramPublish?.status === "published" || publishFeedback?.type === "success"
                            ? "bg-emerald-500 text-white"
                            : "bg-rose-500 text-white"
                        }`}
                      >
                        {instagramPublish?.status === "published" || publishFeedback?.type === "success" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        {instagramPublish?.status === "published" || publishFeedback?.type === "success"
                          ? "게시 완료"
                          : "상태 확인 필"}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      생성일 {new Date(result.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      담당 직원: {result.assignedEmployeeName || "미지원"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      원천 데이터: {SOURCE_LABELS[result.sourceType]} ({result.customerName || "고객명 없음"})
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="group flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
              </button>
            </div>

            {/* Action Bar integrated into header for Instagram */}
            {isInstagram && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-50 bg-white px-8 py-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handlePublishInstagram}
                    disabled={publishing}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3721ED] px-5 text-sm font-bold text-white shadow-lg shadow-[#3721ED]/20 transition-all hover:translate-y-[-1px] hover:bg-[#2c1ac0] active:translate-y-0 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {publishing ? "게시 중..." : "인스타 즉시 게시"}
                  </button>

                  <div className="mx-1 h-10 w-[1px] bg-slate-100" />

                  {instagramPermalink && (
                    <a
                      href={instagramPermalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <ExternalLink className="h-4 w-4 text-slate-400" />
                      게시물 보기
                    </a>
                  )}

                  {instagramImageUrls.length > 0 && (
                    <button
                      onClick={() => downloadImage(instagramImageUrls[0], "instagram-1.jpg")}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4 text-slate-400" />
                      기본 이미지
                    </button>
                  )}

                  {instagramImageUrls.length > 1 && (
                    <button
                      onClick={downloadAllImages}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4 text-slate-400" />
                      전체 다운로드
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy("text")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200"
                  >
                    <Copy className="h-4 w-4 text-slate-400" />
                    본문만 복사
                  </button>
                  <button
                    onClick={() => handleCopy("all")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 px-5 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:translate-y-[-1px] active:translate-y-0"
                  >
                    <Copy className="h-4 w-4" />
                    전체 복사
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center space-y-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3721ED] border-t-transparent" />
                <p className="animate-pulse font-medium text-slate-500">상세 내용을 불러오는 중입니다...</p>
              </div>
            ) : articleData ? (
              <div className="flex h-full flex-col">
                {/* Feedback area for non-instagram or specific cases */}
                {!isInstagram && publishFeedback && (
                   <div className="border-b border-slate-100 bg-slate-50 px-8 py-3">
                      <div className={`rounded-xl px-3 py-2 text-xs font-medium ${
                        publishFeedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {publishFeedback.message}
                      </div>
                   </div>
                )}

                <div className="min-h-0 flex-1">
                  {isInstagram ? (
                    <InstagramViewer
                      platformOutput={articleData.platformOutput}
                      fallbackContent={JSON.stringify(articleData.bodyContent)}
                      showControls={false}
                    />
                  ) : (
                    <BlogViewer
                      newsletterTitle={articleData.title}
                      setNewsletterTitle={() => {}}
                      newsletterContent={JSON.stringify(articleData.bodyContent)}
                      templateStyle={result.templateStyle || "blog_naver_basic"}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                <p>상세 정보를 찾을 수 없습니다.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
