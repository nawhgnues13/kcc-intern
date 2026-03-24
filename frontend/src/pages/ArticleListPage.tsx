import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Clock, User, ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { newsletterService } from "../services/api/newsletterService";
import { NewsletterListItem } from "../types/article";
import { useAuthStore } from "../store/useAuthStore";

export function ArticleListPage() {
  const [articles, setArticles] = useState<NewsletterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    async function loadArticles() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const response = await newsletterService.getNewsletters();
        let articlesArray: any[] = [];
        if (Array.isArray(response)) {
          articlesArray = response;
        } else if (response && Array.isArray((response as any).items)) {
          articlesArray = (response as any).items;
        } else if (response && Array.isArray((response as any).data)) {
          articlesArray = (response as any).data;
        }
        setArticles(articlesArray);
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      } finally {
        setLoading(false);
      }
    }
    loadArticles();
  }, [user?.id]);

  return (
    <div className="flex-1 bg-[#F8F9FB] w-full h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Navigation & Header */}
        <div className="mb-12">
          <Link 
            to="/" 
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            홈으로 돌아가기
          </Link>
          
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            전체 기사 모아보기
          </h1>
          <p className="text-slate-500 text-lg">
            IT, 자동차, 라이프스타일 등 다양한 분야의 최신 트렌드를 확인하세요.
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-10 h-10 border-4 border-[#3721ED] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 animate-pulse font-medium">기사를 불러오는 중입니다...</p>
          </div>
        ) : (
          /* Article Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article, idx) => (
              <motion.div
                key={article.id || article.articleId || idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                onClick={() => navigate(`/workspace?id=${article.id || article.articleId}&mode=view`, { state: { article } })}
                className="group flex flex-col bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
              >
                {/* Image Section */}
                <div className="relative h-56 overflow-hidden bg-slate-100 flex items-center justify-center">
                  {article.thumbnailImageUrl ? (
                    <motion.img 
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.4 }}
                      src={article.thumbnailImageUrl} 
                      alt={article.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-slate-400 font-medium">No Image</div>
                  )}
                  <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold shadow-sm backdrop-blur-md bg-blue-500 text-white">
                      {article.topic || article.contentFormat}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mb-4">
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(article.updatedAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md">
                      <User className="w-3.5 h-3.5" />
                      {article.authorName || 'AI 어시스턴트'}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 leading-tight mb-3 line-clamp-2 group-hover:text-[#3721ED] transition-colors">
                    {article.title}
                  </h3>
                  
                  <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 mb-6 flex-1">
                    {article.summary || `${article.contentFormat} 형식으로 작성된 콘텐츠입니다.`}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-sm font-semibold text-slate-900 group-hover:text-[#3721ED] transition-colors">
                      자세히 보기
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-[#3721ED] transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
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
