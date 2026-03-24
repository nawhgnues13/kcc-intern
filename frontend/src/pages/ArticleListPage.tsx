import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, ArrowUpRight, Clock, User } from "lucide-react";
import { motion } from "motion/react";
import { newsletterService } from "../services/api/newsletterService";
import { NewsletterListItem } from "../types/article";
import { useAuthStore } from "../store/useAuthStore";

export function ArticleListPage() {
  const [articles, setArticles] = useState<NewsletterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    async function loadArticles() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const response = await newsletterService.getNewsletters();
        let articlesArray: NewsletterListItem[] = [];
        if (Array.isArray(response)) {
          articlesArray = response as NewsletterListItem[];
        } else if (response && Array.isArray((response as any).items)) {
          articlesArray = (response as any).items;
        } else if (response && Array.isArray((response as any).data)) {
          articlesArray = (response as any).data;
        }

        setArticles(
          articlesArray.filter((article) => article.contentFormat === "newsletter"),
        );
      } catch (error) {
        console.error("Failed to fetch newsletter articles:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadArticles();
  }, [user?.id]);

  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-[#F8F9FB] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-12">
          <Link
            to="/"
            className="group mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
            홈으로 돌아가기
          </Link>

          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900">
            전체 뉴스레터
          </h1>
          <p className="text-lg text-slate-500">
            발행된 뉴스레터 콘텐츠만 모아보고 다시 확인할 수 있습니다.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-32">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3721ED] border-t-transparent" />
            <p className="animate-pulse font-medium text-slate-500">
              뉴스레터를 불러오는 중입니다...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article, idx) => (
              <motion.div
                key={article.id || article.articleId || idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                onClick={() =>
                  navigate(`/workspace?id=${article.id || article.articleId}&mode=view`, {
                    state: { article },
                  })
                }
                className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative flex h-56 items-center justify-center overflow-hidden bg-slate-100">
                  {article.thumbnailImageUrl ? (
                    <motion.img
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.4 }}
                      src={article.thumbnailImageUrl}
                      alt={article.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="font-medium text-slate-400">No Image</div>
                  )}
                  <div className="absolute left-4 top-4 z-10 flex gap-2">
                    <span className="rounded-full bg-[#3721ED] px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-md">
                      뉴스레터
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-4 flex items-center gap-3 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(article.updatedAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1">
                      <User className="h-3.5 w-3.5" />
                      {article.authorName || "AI 어시스턴트"}
                    </div>
                  </div>

                  <h3 className="mb-3 line-clamp-2 text-xl font-bold leading-tight text-slate-900 transition-colors group-hover:text-[#3721ED]">
                    {article.title}
                  </h3>

                  <p className="mb-6 flex-1 line-clamp-3 text-sm leading-relaxed text-slate-500">
                    {article.summary || "발행된 뉴스레터 콘텐츠입니다."}
                  </p>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-[#3721ED]">
                      자세히 보기
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 transition-colors group-hover:bg-blue-50 group-hover:text-[#3721ED]">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
