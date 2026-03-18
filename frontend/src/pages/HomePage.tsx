import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, FileText, LayoutDashboard, Instagram, BookOpen, Sparkles } from "lucide-react";
import { useSessionStore } from "../store/useSessionStore";
import { getRecommendedArticlesMock } from "../services/mock/articleMock";
import { Article } from "../types/article";

const TEMPLATES = [
  { id: "뉴스레터", name: "뉴스레터", icon: <FileText className="w-6 h-6" />, color: "from-blue-500 to-cyan-500", desc: "전문적인 기업용 뉴스레터" },
  { id: "인스타그램", name: "인스타그램", icon: <Instagram className="w-6 h-6" />, color: "from-pink-500 to-orange-400", desc: "시각적이고 트렌디한 피드 문구" },
  { id: "블로그", name: "블로그", icon: <LayoutDashboard className="w-6 h-6" />, color: "from-emerald-500 to-teal-400", desc: "SEO 최적화된 정보성 블로그 글" },
];

export function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recommended' | 'my'>('recommended');
  
  const navigate = useNavigate();
  const setTemplate = useSessionStore((state) => state.setTemplate);

  useEffect(() => {
    async function fetchArticles() {
      setLoading(true);
      try {
        const data = await getRecommendedArticlesMock();
        setArticles(data);
      } catch (error) {
        console.error("Failed to load articles", error);
      } finally {
        setLoading(false);
      }
    }
    fetchArticles();
  }, []);

  const handleTemplateClick = (templateId: string) => {
    setTemplate(templateId);
    navigate("/dashboard");
  };

  const handleArticleClick = (article: Article) => {
    navigate("/workspace", { state: { article } });
  };

  return (
    <div className="flex-1 overflow-y-auto w-full bg-[#F8F9FB] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-6xl mx-auto px-4 py-12">

        {/* Recommended Articles Section (Moved up) */}
        {/* Segmented Control / Tabs */}
        <div className="flex items-center justify-center mb-12">
          <div className="bg-slate-200/50 p-1.5 rounded-2xl inline-flex relative">
            <button
              onClick={() => setActiveTab('recommended')}
              className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                activeTab === 'recommended' ? 'text-[#3721ED]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sparkles className="w-4 h-4" /> 추천 기사
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`relative z-10 flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                activeTab === 'my' ? 'text-[#3721ED]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BookOpen className="w-4 h-4" /> 내 기사
            </button>

            {/* Sliding Highlight */}
            <div 
              className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-out border border-slate-100 ${
                activeTab === 'recommended' ? 'translate-x-0' : 'translate-x-full'
              }`}
            />
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="mb-20">
          {activeTab === 'my' ? (
            <motion.div
              key="my"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 flex flex-col items-center justify-center text-center shadow-sm"
            >
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <BookOpen className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">아직 작성한 콘텐츠가 없습니다</h3>
              <p className="text-slate-500 mb-8 max-w-sm">
                AI의 도움을 받아 나만의 첫 번째 기사, 뉴스레터, 혹은 블로그 포스트를 만들어보세요.
              </p>
              <button 
                onClick={() => navigate('/dashboard')}
                className="bg-[#3721ED] hover:bg-[#2c1ac0] text-white px-6 py-3 rounded-xl font-semibold shadow-md shadow-[#3721ED]/20 transition-all flex items-center gap-2"
              >
                <FileText className="w-5 h-5" /> 새 콘텐츠 작성하기
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="recommended"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">추천 최신 기사</h2>
                  <p className="text-slate-500 text-sm">트렌드를 읽고 새로운 인사이트를 얻어보세요.</p>
                </div>
                <Link 
                  to="/articles" 
                  className="group flex items-center text-sm font-semibold text-slate-500 hover:text-[#3721ED] transition-colors"
                >
                  모두보기 
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-4 border-[#3721ED] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {articles.map((article, index) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + (index * 0.1) }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all cursor-pointer"
                  onClick={() => handleArticleClick(article)}
                >
                  <div className="h-48 overflow-hidden relative group">
                    <img 
                      src={article.imageUrl} 
                      alt={article.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                        article.category === 'IT' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2 hover:text-[#3721ED] transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-slate-500 text-sm line-clamp-2 mb-4">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{article.author}</span>
                      <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
            </motion.div>
          )}
        </div>
        {/* Header Section (Moved below recommendation) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12 mt-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            어떤 콘텐츠를 만들까요?
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            원하는 템플릿을 선택하고 AI의 도움을 받아 빠르고 쉽게 콘텐츠를 완성해보세요.
          </p>
        </motion.div>

        {/* Templates Section (Moved down) */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-800">템플릿 선택</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TEMPLATES.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (index * 0.1) }}
                onClick={() => handleTemplateClick(item.id)}
                // Stronger borders and shadows
                className="group relative bg-white rounded-3xl p-8 border border-slate-200 shadow-md hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${item.color} transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br ${item.color} mb-6 shadow-md`}>
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{item.name}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                <div className="mt-8 flex items-center text-blue-600 font-medium text-sm group-hover:translate-x-2 transition-transform">
                  시작하기 <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
