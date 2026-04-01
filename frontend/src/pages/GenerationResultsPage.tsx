import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Filter,
  Instagram as InstagramIcon,
  Layers,
  LoaderCircle,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { motion } from "motion/react";
import { useAuthStore } from "../store/useAuthStore";
import { contentTaskService } from "../services/api/contentTaskService";
import { ContentTaskItem, ContentTaskResult } from "../types/contentTask";
import { ResultCard } from "../features/automation/components/ResultCard";
import { ResultDetailDrawer } from "../features/automation/components/ResultDetailDrawer";

const POLLING_INTERVAL_MS = 5000;

type ResultViewMode =
  | "completed_all"
  | "completed_blog"
  | "completed_instagram"
  | "in_progress"
  | "failed";

const SOURCE_LABELS: Record<string, string> = {
  sale: "차량 판매",
  service: "차량 수리",
  grooming: "애견 미용",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  in_progress: "생성 중",
  completed: "완료",
  failed: "실패",
  skipped: "건너뜀",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  skipped: "bg-slate-100 text-slate-500 border-slate-200",
};

function matchesSearchAndSource(
  item: {
    title?: string | null;
    articleTitle?: string | null;
    customerName?: string | null;
    summary?: string | null;
    sourceType: string;
  },
  searchQuery: string,
  sourceTypeFilter: string,
) {
  const search = searchQuery.trim().toLowerCase();
  const haystack = [
    item.title,
    item.articleTitle,
    item.customerName,
    item.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matchesSearch = !search || haystack.includes(search);
  const matchesSource =
    sourceTypeFilter === "all" || item.sourceType === sourceTypeFilter;

  return matchesSearch && matchesSource;
}

function ProcessingTaskCard({ task }: { task: ContentTaskItem }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            STATUS_STYLES[task.status] || STATUS_STYLES.pending
          }`}
        >
          {STATUS_LABELS[task.status] || task.status}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {task.contentFormat === "instagram" ? "인스타그램" : "블로그"}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {SOURCE_LABELS[task.sourceType] || task.sourceType}
        </span>
      </div>

      <h3 className="mb-2 text-lg font-bold text-slate-800">
        {task.title || "자동 생성 작업"}
      </h3>

      <p className="mb-4 line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">
        {task.summary || "등록된 DB 정보를 기반으로 자동 생성 중입니다."}
      </p>

      <div className="grid grid-cols-1 gap-2 text-xs font-semibold text-slate-400 sm:grid-cols-2">
        <div>원천 유형: {SOURCE_LABELS[task.sourceType] || task.sourceType}</div>
        <div>요청 시각: {new Date(task.createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}

export function GenerationResultsPage() {
  const user = useAuthStore((state) => state.user);
  const [results, setResults] = useState<ContentTaskResult[]>([]);
  const [tasks, setTasks] = useState<ContentTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<ContentTaskResult | null>(null);
  const [viewMode, setViewMode] = useState<ResultViewMode>("completed_all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let disposed = false;

    const loadData = async (isInitial: boolean) => {
      if (isInitial) {
        setLoading(true);
      }

      try {
        const [resultsResponse, tasksResponse] = await Promise.all([
          contentTaskService.getMyResults({ assigned_user_id: user.id }),
          contentTaskService.getTasks({ assigned_user_id: user.id }),
        ]);

        if (disposed) {
          return;
        }

        setResults(resultsResponse.items || []);
        setTasks(tasksResponse.items || []);
        setError(null);
      } catch (err) {
        if (!disposed) {
          console.error("Failed to load generation results:", err);
          setError("생성 결과를 불러오는 중 오류가 발생했습니다.");
        }
      } finally {
        if (!disposed && isInitial) {
          setLoading(false);
        }
      }
    };

    void loadData(true);
    const intervalId = window.setInterval(() => {
      void loadData(false);
    }, POLLING_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [user?.id]);

  const processingTasks = useMemo(
    () => tasks.filter((task) => task.status === "pending" || task.status === "in_progress"),
    [tasks],
  );

  const failedTasks = useMemo(
    () => tasks.filter((task) => task.status === "failed"),
    [tasks],
  );

  const counts = useMemo(
    () => ({
      completedAll: results.length,
      completedBlog: results.filter((item) => item.contentFormat === "blog").length,
      completedInstagram: results.filter((item) => item.contentFormat === "instagram").length,
      processing: processingTasks.length,
      failed: failedTasks.length,
    }),
    [failedTasks.length, processingTasks.length, results],
  );

  const filteredCompletedResults = useMemo(() => {
    const base = results.filter((item) => {
      if (viewMode === "completed_blog") {
        return item.contentFormat === "blog";
      }
      if (viewMode === "completed_instagram") {
        return item.contentFormat === "instagram";
      }
      return viewMode === "completed_all";
    });

    return base.filter((item) =>
      matchesSearchAndSource(item, searchQuery, sourceTypeFilter),
    );
  }, [results, searchQuery, sourceTypeFilter, viewMode]);

  const filteredProcessingTasks = useMemo(
    () =>
      processingTasks.filter((item) =>
        matchesSearchAndSource(item, searchQuery, sourceTypeFilter),
      ),
    [processingTasks, searchQuery, sourceTypeFilter],
  );

  const filteredFailedTasks = useMemo(
    () =>
      failedTasks.filter((item) =>
        matchesSearchAndSource(item, searchQuery, sourceTypeFilter),
      ),
    [failedTasks, searchQuery, sourceTypeFilter],
  );

  const cards = [
    {
      key: "completed_all" as const,
      label: "완료된 생성 결과",
      value: counts.completedAll,
      icon: <Layers className="h-5 w-5" />,
      tone: "bg-slate-900 text-white border-slate-900",
      inactiveTone: "bg-white text-slate-700 border-slate-200",
      description: "블로그와 인스타 전체",
    },
    {
      key: "completed_blog" as const,
      label: "블로그 완료",
      value: counts.completedBlog,
      icon: <FileText className="h-5 w-5" />,
      tone: "bg-blue-600 text-white border-blue-600",
      inactiveTone: "bg-white text-slate-700 border-slate-200",
      description: "완료된 블로그만 보기",
    },
    {
      key: "completed_instagram" as const,
      label: "인스타 완료",
      value: counts.completedInstagram,
      icon: <InstagramIcon className="h-5 w-5" />,
      tone: "bg-pink-600 text-white border-pink-600",
      inactiveTone: "bg-white text-slate-700 border-slate-200",
      description: "완료된 인스타만 보기",
    },
    {
      key: "in_progress" as const,
      label: "생성 중",
      value: counts.processing,
      icon: <Clock3 className="h-5 w-5" />,
      tone: "bg-amber-500 text-white border-amber-500",
      inactiveTone: "bg-white text-slate-700 border-slate-200",
      description: "대기·생성 중 작업 보기",
    },
    {
      key: "failed" as const,
      label: "실패",
      value: counts.failed,
      icon: <TriangleAlert className="h-5 w-5" />,
      tone: "bg-rose-500 text-white border-rose-500",
      inactiveTone: "bg-white text-slate-700 border-slate-200",
      description: "재확인 필요한 작업",
    },
  ];

  const renderBody = () => {
    if (viewMode === "in_progress") {
      if (filteredProcessingTasks.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <LoaderCircle className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-lg font-bold">진행 중인 작업이 없습니다.</p>
            <p className="mt-1 text-sm">새 DB 등록이 들어오면 이곳에서 생성 상태를 확인할 수 있습니다.</p>
          </div>
        );
      }

      return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredProcessingTasks.map((task) => (
            <ProcessingTaskCard key={task.taskId} task={task} />
          ))}
        </div>
      );
    }

    if (viewMode === "failed") {
      if (filteredFailedTasks.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
            <CheckCircle2 className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-lg font-bold">실패한 작업이 없습니다.</p>
            <p className="mt-1 text-sm">현재는 재확인이 필요한 자동 생성 작업이 없습니다.</p>
          </div>
        );
      }

      return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredFailedTasks.map((task) => (
            <ProcessingTaskCard key={task.taskId} task={task} />
          ))}
        </div>
      );
    }

    if (filteredCompletedResults.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
          <Layers className="mb-4 h-16 w-16 opacity-10" />
          <p className="text-lg font-bold">완료된 생성 결과가 없습니다.</p>
          <p className="mt-1 text-sm">선택한 유형이나 검색 조건에 맞는 결과가 아직 없습니다.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {filteredCompletedResults.map((result) => (
          <ResultCard
            key={result.taskId}
            result={result}
            onClick={setSelectedResult}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#F8F9FB]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#3721ED] text-white shadow-lg shadow-[#3721ED]/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">
              생성 결과 관리
            </h1>
          </div>
          <p className="font-medium text-slate-500">
            DB 등록 데이터를 기반으로 자동 생성된 블로그와 인스타그램 결과를 상태별로 확인하세요.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {cards.map((card) => {
            const active = viewMode === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setViewMode(card.key)}
                className={`rounded-3xl border p-5 text-left transition-all ${
                  active ? card.tone : card.inactiveTone
                } ${active ? "shadow-lg" : "shadow-sm hover:border-slate-300 hover:bg-slate-50"}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className={`rounded-xl p-2.5 ${active ? "bg-white/15" : "bg-slate-50"}`}>
                    {card.icon}
                  </div>
                  <span className="text-2xl font-black">{card.value}</span>
                </div>
                <div className="text-sm font-bold">{card.label}</div>
                <div className={`mt-1 text-xs ${active ? "text-white/80" : "text-slate-400"}`}>
                  {card.description}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="relative min-w-[300px] flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="제목, 고객명, 요약 내용으로 검색"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-3 pl-12 pr-4 text-sm font-medium transition-all focus:border-[#3721ED] focus:outline-none focus:ring-2 focus:ring-[#3721ED]/20"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500">
            <Filter className="h-4 w-4" />
            원천
            <select
              value={sourceTypeFilter}
              onChange={(event) => setSourceTypeFilter(event.target.value)}
              className="cursor-pointer border-none bg-transparent text-slate-800 focus:ring-0"
            >
              <option value="all">전체</option>
              <option value="sale">차량 판매</option>
              <option value="service">차량 수리</option>
              <option value="grooming">애견 미용</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-32">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#3721ED] border-t-transparent" />
            <p className="animate-pulse font-medium text-slate-500">
              생성 결과를 불러오고 있습니다...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-rose-100 bg-rose-50/30 py-24 text-rose-500">
            <AlertCircle className="mb-4 h-12 w-12 opacity-50" />
            <p className="font-bold">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-xl bg-rose-500 px-6 py-2.5 font-bold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600"
            >
              다시 시도하기
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {viewMode === "completed_all" && "완료된 생성 결과"}
                  {viewMode === "completed_blog" && "블로그 완료 결과"}
                  {viewMode === "completed_instagram" && "인스타 완료 결과"}
                  {viewMode === "in_progress" && "생성 중 작업"}
                  {viewMode === "failed" && "실패한 작업"}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {viewMode === "in_progress"
                    ? "자동 생성이 진행 중이거나 대기 중인 작업입니다."
                    : viewMode === "failed"
                      ? "실패한 작업을 모아 보고 재확인할 수 있습니다."
                      : "완료된 결과를 유형별로 나눠 보고 상세 화면으로 이동할 수 있습니다."}
                </p>
              </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                <LoaderCircle className="h-4 w-4 text-[#3721ED]" />
                5초마다 자동 새로고침
              </div>
            </div>

            {/* Segmented Tab Control for Content Type Branching */}
            {(viewMode === "completed_all" ||
              viewMode === "completed_blog" ||
              viewMode === "completed_instagram") && (
              <div className="mb-8 flex justify-start">
                <div className="inline-flex gap-1 rounded-[20px] bg-slate-100 p-1.5 shadow-inner">
                  {cards.slice(0, 3).map((tab) => {
                    const active = viewMode === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setViewMode(tab.key)}
                        className={`relative flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold transition-all duration-300 ${
                          active ? "text-white shadow-md" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {active && (
                          <motion.div
                            layoutId="activeTabBackground"
                            className={`absolute inset-0 rounded-2xl ${
                              tab.key === "completed_blog"
                                ? "bg-blue-600"
                                : tab.key === "completed_instagram"
                                  ? "bg-pink-600"
                                  : "bg-slate-900"
                            }`}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                          />
                        )}
                        <span className="relative z-10 shrink-0">
                          {tab.key === "completed_blog" ? (
                            <FileText className="h-4 w-4" />
                          ) : tab.key === "completed_instagram" ? (
                            <InstagramIcon className="h-4 w-4" />
                          ) : (
                            <Layers className="h-4 w-4" />
                          )}
                        </span>
                        <span className="relative z-10">{tab.label.replace(" 완료", "").replace("된 생성 결과", " 전체")}</span>
                        {tab.value > 0 && (
                          <span
                            className={`relative z-10 flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-black leading-none ${
                              active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {tab.value}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {renderBody()}
          </>
        )}
      </div>

      <ResultDetailDrawer
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
      />
    </div>
  );
}
