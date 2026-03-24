import { useEffect, useState } from "react";
import { X, ExternalLink, Calendar, User, FileText, Instagram } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { newsletterService } from "../../../services/api/newsletterService";
import { ContentTaskResult } from "../../../types/contentTask";
import { BlogViewer } from "../../newsletter/components/BlogViewer";
import { InstagramViewer } from "../../newsletter/components/InstagramViewer";

interface ResultDetailDrawerProps {
  result: ContentTaskResult | null;
  onClose: () => void;
}

export function ResultDetailDrawer({ result, onClose }: ResultDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [articleData, setArticleData] = useState<any>(null);

  useEffect(() => {
    async function loadDetail() {
      if (!result?.articleId) return;
      setLoading(true);
      try {
        const data = await newsletterService.getNewsletter(result.articleId);
        setArticleData(data);
      } catch (error) {
        console.error("Failed to load article detail:", error);
      } finally {
        setLoading(false);
      }
    }

    if (result) {
      loadDetail();
    } else {
      setArticleData(null);
    }
  }, [result]);

  if (!result) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Drawer Content */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-4xl bg-white shadow-2xl h-full flex flex-col"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${result.contentFormat === "instagram" ? "bg-pink-50 text-pink-600" : "bg-blue-50 text-blue-600"}`}>
                {result.contentFormat === "instagram" ? <Instagram className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">생성 결과 상세보기</h2>
                <p className="text-xs text-slate-400 font-medium">{result.contentFormat === "instagram" ? "인스타그램 피드" : "블로그 포스팅"}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-slate-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-[#3721ED] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 animate-pulse font-medium">상세 내용을 불러오는 중입니다...</p>
              </div>
            ) : articleData ? (
              <div className="h-full flex flex-col">
                {/* Meta Info Mini Bar */}
                <div className="bg-slate-50 px-8 py-3 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-500 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    생성일: {new Date(result.createdAt).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    담당직원: {result.assignedEmployeeName || "시스템"}
                  </div>
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5" />
                    원천데이터: {result.sourceType === "sale" ? "차량 구매" : result.sourceType === "service" ? "차량 수리" : "애견 미용"} ({result.customerName})
                  </div>
                </div>

                {/* Viewer Layer */}
                <div className="flex-1 min-h-0">
                  {result.contentFormat === "instagram" ? (
                    <InstagramViewer 
                      platformOutput={articleData.platformOutput} 
                      fallbackContent={JSON.stringify(articleData.bodyContent)} 
                    />
                  ) : (
                    <BlogViewer 
                      newsletterTitle={articleData.title} 
                      setNewsletterTitle={() => {}} // Read-only but required by BlogViewer props
                      newsletterContent={JSON.stringify(articleData.bodyContent)} 
                      templateStyle={result.templateStyle || "blog_naver_basic"} 
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <p>상세 정보를 찾을 수 없습니다.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
