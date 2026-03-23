import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Clock, FileText, Search, MoreVertical, Calendar, Instagram, LayoutDashboard, CheckCircle2, FilePenLine, Eye, Trash2 } from "lucide-react";
import { motion } from "motion/react";

const mockHistory = [
  { id: 1, title: "제네시스 GV80 페이스리프트 출시 안내", type: "뉴스레터", date: "2026.03.16", status: "completed" },
  { id: 2, title: "IT 트렌드 분석 보고서 요약본", type: "블로그", date: "2026.03.15", status: "completed" },
  { id: 3, title: "봄맞이 차량 무상점검 프로모션 홍보", type: "인스타그램", date: "2026.03.12", status: "draft" },
  { id: 4, title: "신입사원 온보딩 매뉴얼 초안", type: "블로그", date: "2026.03.10", status: "completed" },
  { id: 5, title: "KCC오토 전기차 충전소 위치 안내", type: "뉴스레터", date: "2026.02.28", status: "completed" },
];

export function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const filteredHistory = mockHistory.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <div className="p-1 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">저장됨</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-1 bg-amber-50 text-amber-600 rounded-md">
              <FilePenLine className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">임시저장</span>
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
              {filteredHistory.map((item, index) => (
                <motion.tr 
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/workspace?id=${item.id}&mode=view`)}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br shadow-sm ${
                        item.type === '뉴스레터' ? 'from-blue-500 to-cyan-500' :
                        item.type === '인스타그램' ? 'from-pink-500 to-orange-400' : 
                        'from-emerald-500 to-teal-400'
                      }`}>
                        {item.type === '뉴스레터' && <FileText className="w-5 h-5" />}
                        {item.type === '인스타그램' && <Instagram className="w-5 h-5" />}
                        {item.type === '블로그' && <LayoutDashboard className="w-5 h-5" />}
                      </div>
                      <span className="font-bold text-slate-800 group-hover:text-[#3721ED] transition-colors line-clamp-1">{item.title}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-semibold text-slate-600">{item.type}</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex flex-col items-center justify-center gap-0.5 text-slate-500">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {item.date}
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-tighter">작성일</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className={`inline-flex p-1.5 rounded-lg ${
                      item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {item.status === 'completed' ? <CheckCircle2 className="w-4.5 h-4.5" /> : <FilePenLine className="w-4.5 h-4.5" />}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        title="보기"
                        className="p-2 text-slate-400 hover:text-[#3721ED] hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        title="삭제"
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              
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
