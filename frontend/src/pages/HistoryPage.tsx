import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Clock, FileText, Search, Calendar, Instagram, LayoutDashboard, CheckCircle2, FilePenLine, Eye, Trash2, XCircle, Image as ImageIcon } from "lucide-react";
import { motion } from "motion/react";
import { newsletterService } from "../services/api/newsletterService";
import { useAuthStore } from "../store/useAuthStore";
import { NewsletterListItem } from "../types/article";

export function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [articles, setArticles] = useState<NewsletterListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    async function fetchHistory() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      try {
        const response: any = await newsletterService.getNewsletters(user.id as string);
        let data: NewsletterListItem[] = [];
        if (Array.isArray(response)) {
          data = response as NewsletterListItem[];
        } else if (response && Array.isArray(response.items)) {
          data = response.items as NewsletterListItem[];
        } else if (response && Array.isArray(response.data)) {
          data = response.data as NewsletterListItem[];
        }
        
        const sortedData = data.sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime());
        setArticles(sortedData);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, [user?.id]);

  const filteredHistory = articles.filter(item => 
    item.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeKorean = (format: string) => {
    switch(format?.toLowerCase()) {
      case 'newsletter': return '뉴스레터';
      case 'blog': return '블로그';
      case 'instagram': return '인스타그램';
      default: return '문서';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleDelete = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    if (!window.confirm("이 기사를 삭제하시겠습니까?\n삭제된 기사는 복구할 수 없습니다.")) return;
    
    try {
      await newsletterService.deleteNewsletter(articleId);
      setArticles(prev => prev.map(item => 
        item.articleId === articleId ? { ...item, status: 'deleted' } : item
      ));
    } catch (err) {
      console.error("Failed to delete article", err);
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full bg-[#F8F9FB]">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2 flex items-center gap-3">
              <Clock className="w-8 h-8 text-[#3721ED]" />
              작성 기록
            </h1>
            <p className="text-slate-500 text-sm">지금까지 만들어온 콘텐츠를 한눈에 관리하고 다시 편집하세요.</p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="문서 제목으로 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/30 focus:border-[#3721ED] text-sm text-slate-700 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-6 mb-4 px-2">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">게시됨</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1 bg-red-50 text-red-600 rounded-md">
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">삭제됨</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-4 px-6 font-semibold w-7/12">콘텐츠 제목</th>
                <th className="py-4 px-6 font-semibold w-2/12">유형</th>
                <th className="py-4 px-6 font-semibold w-2/12 text-center">작성일</th>
                <th className="py-4 px-6 font-semibold w-1/12 text-center">상태</th>
                <th className="py-4 px-6 font-semibold w-1/12 text-center">동작</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-500">
                    <p className="font-medium">기록을 불러오는 중입니다...</p>
                  </td>
                </tr>
              ) : filteredHistory.map((item, index) => {
                const typeKorean = getTypeKorean(item.contentFormat);
                
                return (
                  <motion.tr 
                    key={item.articleId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => { if (item.status !== 'deleted') navigate(`/workspace?id=${item.articleId}&mode=view`) }}
                    className={`border-b border-slate-100 transition-colors group ${
                      item.status === 'deleted' 
                        ? 'opacity-60 bg-slate-50' 
                        : 'hover:bg-slate-50/50 cursor-pointer'
                    }`}
                  >
                    <td className="py-4 px-6 w-7/12">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 shadow-sm overflow-hidden border border-slate-200/60">
                          {item.thumbnailImageUrl ? (
                            <img src={item.thumbnailImageUrl} alt="thumbnail" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-300">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 group-hover:text-[#3721ED] transition-colors line-clamp-1">{item.title || "제목 없음"}</span>
                          {item.summary && <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.summary}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 w-2/12">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br shadow-sm ${
                            typeKorean === '뉴스레터' ? 'from-blue-500 to-cyan-500' :
                            typeKorean === '인스타그램' ? 'from-pink-500 to-orange-400' : 
                            'from-emerald-500 to-teal-400'
                          }`}>
                            {typeKorean === '뉴스레터' && <FileText className="w-4 h-4" />}
                            {typeKorean === '인스타그램' && <Instagram className="w-4 h-4" />}
                            {(typeKorean === '블로그' || typeKorean === '문서') && <LayoutDashboard className="w-4 h-4" />}
                        </div>
                        <span className="text-sm font-semibold text-slate-600">{typeKorean}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center w-2/12">
                      <div className="flex flex-col items-center justify-center gap-0.5 text-slate-500">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(item.createdAt || item.updatedAt)}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center w-1/12">
                      {item.status === 'deleted' ? (
                        <div className="inline-flex items-center p-1.5 rounded-lg bg-red-50 text-red-600">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs font-bold whitespace-nowrap ml-1">삭제됨</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-bold whitespace-nowrap ml-1">게시됨</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center w-1/12">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          title="상세 보기"
                          onClick={(e) => { e.stopPropagation(); navigate(`/workspace?id=${item.articleId}&mode=view`); }}
                          className="p-2 text-slate-400 hover:text-[#3721ED] hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {item.status !== 'deleted' && (
                          <button 
                            title="삭제"
                            onClick={(e) => handleDelete(e, item.articleId)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="font-medium">검색된 문서가 없습니다.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
