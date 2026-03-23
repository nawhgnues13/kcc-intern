import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";
import { ModalLayout } from "../../../components/shared/ModalLayout";
import { searchService, SearchResultItem } from "../../../services/api/searchService";

interface SummaryState {
  status: "loading" | "done" | "error";
  summary?: string;
}

interface SearchModalProps {
  onClose: () => void;
  onAddUrls: (items: { url: string; title: string }[]) => void;
}

export function SearchModal({ onClose, onAddUrls }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [summaries, setSummaries] = useState<Map<number, SummaryState>>(new Map());

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;
    setIsSearching(true);
    setHasSearched(true);
    setSelected(new Set());
    setExpanded(new Set());
    setSummaries(new Map());
    try {
      const res = await searchService.search(query);
      setResults(res.results);

      // 백그라운드에서 각 아이템 요약 병렬 실행
      const initialSummaries = new Map<number, SummaryState>();
      res.results.forEach((_, idx) => {
        initialSummaries.set(idx, { status: "loading" });
      });
      setSummaries(initialSummaries);

      res.results.forEach((item, idx) => {
        searchService
          .summarize(item.original_url, item.title)
          .then((data) =>
            setSummaries((prev) =>
              new Map(prev).set(idx, { status: "done", summary: data.summary })
            )
          )
          .catch(() =>
            setSummaries((prev) => new Map(prev).set(idx, { status: "error" }))
          );
      });
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleAdd = () => {
    const items = Array.from(selected).map((idx) => ({
      url: results[idx].original_url,
      title: results[idx].title,
    }));
    onAddUrls(items);
    onClose();
  };

  return (
    <ModalLayout isOpen={true} onClose={onClose} maxWidthClass="max-w-2xl" closeOnBackdropClick={false}>
      <div className="flex flex-col" style={{ maxHeight: "82vh" }}>
        {/* Header */}
        <div className="p-6 pb-4 flex-shrink-0">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h3 className="text-xl font-bold text-slate-800">웹 검색으로 자료 찾기</h3>
              <p className="text-sm text-slate-500 mt-1">
                검색어를 입력하면 관련 웹 페이지를 찾아드립니다.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="검색어를 입력하세요 (예: AI 산업 동향 2025)"
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 placeholder-slate-400 text-sm"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="px-5 py-3 bg-[#3721ED] text-white font-semibold rounded-xl disabled:opacity-40 hover:bg-[#2c1ac0] transition-colors shadow-sm flex items-center gap-2 text-sm flex-shrink-0"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              검색
            </button>
          </div>
        </div>

        {/* Divider */}
        {(isSearching || hasSearched) && (
          <div className="border-t border-slate-100 flex-shrink-0" />
        )}

        {/* Results area */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#3721ED]/60" />
              <p className="text-sm font-medium">웹을 검색하고 있습니다...</p>
              <p className="text-xs text-slate-400 mt-1">최대 10개의 결과를 가져옵니다</p>
            </div>
          )}

          {/* Empty state */}
          {!isSearching && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Search className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm font-medium">검색 결과가 없습니다</p>
              <p className="text-xs mt-1">다른 검색어로 다시 시도해 보세요</p>
            </div>
          )}

          {/* Initial empty state */}
          {!isSearching && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-14 text-slate-300">
              <Search className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium text-slate-400">검색어를 입력하고 엔터를 누르세요</p>
            </div>
          )}

          {/* Results list */}
          {!isSearching && results.length > 0 && (
            <div className="p-4 space-y-2">
              {results.map((item, idx) => {
                const summaryState = summaries.get(idx);
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`rounded-2xl border transition-all duration-200 ${
                      selected.has(idx)
                        ? "border-[#3721ED] bg-[#3721ED]/5"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Item row */}
                    <div className="flex items-start gap-3 p-4">
                      {/* Checkbox */}
                      <div className="flex-shrink-0 mt-0.5">
                        <button
                          onClick={() => toggleSelect(idx)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            selected.has(idx)
                              ? "bg-[#3721ED] border-[#3721ED]"
                              : "border-slate-300 hover:border-[#3721ED]"
                          }`}
                        >
                          {selected.has(idx) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Favicon */}
                      <img
                        src={item.favicon_url}
                        alt=""
                        className="w-5 h-5 rounded flex-shrink-0 mt-0.5"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />

                      {/* Title + snippet */}
                      <button
                        onClick={() => toggleSelect(idx)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="font-semibold text-slate-800 text-sm leading-snug">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {item.snippet}
                        </div>
                      </button>

                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpand(idx)}
                        className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title={expanded.has(idx) ? "접기" : "자세히 보기"}
                      >
                        {expanded.has(idx) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {expanded.has(idx) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-slate-100">
                            <div className="pt-3 space-y-3">
                              {/* Summary / Loading state */}
                              {summaryState?.status === "loading" && (
                                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0 text-[#3721ED]/60" />
                                  <span>요약 중...</span>
                                </div>
                              )}

                              {summaryState?.status === "error" && (
                                <div className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5">
                                  요약을 불러오지 못했습니다.
                                </div>
                              )}

                              {summaryState?.status === "done" && summaryState.summary && (
                                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 rounded-xl p-3">
                                  {summaryState.summary}
                                </div>
                              )}

                              {/* Source URL */}
                              <a
                                href={item.original_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-xs text-[#3721ED] hover:underline truncate max-w-full"
                              >
                                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{item.original_url}</span>
                              </a>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && !isSearching && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center flex-shrink-0">
            <span className="text-sm text-slate-500">
              {selected.size > 0 ? (
                <span className="text-[#3721ED] font-semibold">{selected.size}개</span>
              ) : (
                "0개"
              )}{" "}
              선택됨
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={selected.size === 0}
                className="px-5 py-2 bg-[#3721ED] text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-[#2c1ac0] transition-colors shadow-sm"
              >
                URL 추가
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalLayout>
  );
}
