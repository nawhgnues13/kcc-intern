import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  Instagram,
  Facebook,
  LayoutDashboard,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { newsletterService } from "../services/api/newsletterService";
import { NewsletterListItem } from "../types/article";
import { useAuthStore } from "../store/useAuthStore";

type DisplayStatus = "published" | "deleted";

const getContentTypeLabel = (format?: string) => {
  switch ((format || "").toLowerCase()) {
    case "newsletter":
      return "뉴스레터";
    case "blog":
      return "블로그";
    case "instagram":
      return "인스타그램";
    case "facebook":
      return "페이스북";
    default:
      return "문서";
  }
};

const getContentTypeIcon = (label: string) => {
  switch (label) {
    case "뉴스레터":
      return FileText;
    case "인스타그램":
      return Instagram;
    case "페이스북":
      return Facebook;
    default:
      return LayoutDashboard;
  }
};

const getContentTypeGradient = (label: string) => {
  switch (label) {
    case "뉴스레터":
      return "from-blue-500 to-cyan-500";
    case "인스타그램":
      return "from-pink-500 to-orange-400";
    case "페이스북":
      return "from-blue-700 to-sky-500";
    default:
      return "from-emerald-500 to-teal-400";
  }
};

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

export function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [articles, setArticles] = useState<NewsletterListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failedThumbnails, setFailedThumbnails] = useState<Record<string, boolean>>({});

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

        const sortedData = [...data].sort((a, b) => {
          const aTime = new Date(a.createdAt || a.updatedAt).getTime();
          const bTime = new Date(b.createdAt || b.updatedAt).getTime();
          return bTime - aTime;
        });

        setArticles(sortedData);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [user?.id]);

  const filteredHistory = useMemo(
    () =>
      articles.filter((item) => (item.title || "").toLowerCase().includes(searchTerm.trim().toLowerCase())),
    [articles, searchTerm],
  );

  const toDisplayImageUrl = (src?: string | null) => {
    const value = (src || "").trim();
    if (!value || !value.startsWith("http")) {
      return value || null;
    }

    return `/api/utils/download-image?url=${encodeURIComponent(value)}&download=false`;
  };

  const handleDelete = async (event: React.MouseEvent, articleId: string) => {
    event.stopPropagation();

    const confirmed = window.confirm(
      "이 기사를 삭제하시겠습니까?\n삭제된 기사는 복구할 수 없습니다.",
    );

    if (!confirmed) return;

    try {
      await newsletterService.deleteNewsletter(articleId);
      setArticles((prev) =>
        prev.map((item) =>
          item.articleId === articleId ? { ...item, status: "deleted" as DisplayStatus } : item,
        ),
      );
    } catch (error) {
      console.error("Failed to delete article:", error);
      window.alert("기사 삭제에 실패했습니다.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full bg-[#F8F9FB]">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="mb-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-slate-800">
              <Clock className="h-8 w-8 text-[#3721ED]" />
              작성 기록
            </h1>
            <p className="text-sm text-slate-500">
              지금까지 만든 콘텐츠를 한눈에 확인하고 다시 살펴보세요.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="문서 제목으로 검색..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:border-[#3721ED] focus:outline-none focus:ring-2 focus:ring-[#3721ED]/30"
            />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-6 px-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-indigo-50 p-1 text-indigo-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">게시됨</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-red-50 p-1 text-red-600">
              <XCircle className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">삭제됨</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
                <th className="w-[48%] px-6 py-4 font-semibold">콘텐츠 제목</th>
                <th className="w-[16%] px-6 py-4 font-semibold">유형</th>
                <th className="w-[16%] px-6 py-4 text-center font-semibold">작성일</th>
                <th className="w-[10%] px-6 py-4 text-center font-semibold">상태</th>
                <th className="w-[10%] px-6 py-4 text-center font-semibold">동작</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-500">
                    <p className="font-medium">작성 기록을 불러오는 중입니다...</p>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-500">
                    <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                    <p className="font-medium">검색된 문서가 없습니다.</p>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item, index) => {
                  const typeLabel = getContentTypeLabel(item.contentFormat);
                  const TypeIcon = getContentTypeIcon(typeLabel);
                  const isDeleted = item.status === "deleted";
                  const articleKey = item.articleId;
                  const thumbnailSrc = failedThumbnails[articleKey]
                    ? null
                    : toDisplayImageUrl(item.thumbnailImageUrl);

                  return (
                    <motion.tr
                      key={item.articleId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        if (!isDeleted) {
                          navigate(`/workspace?id=${item.articleId}&mode=view`);
                        }
                      }}
                      className={`group border-b border-slate-100 transition-colors ${
                        isDeleted ? "bg-slate-50 opacity-60" : "cursor-pointer hover:bg-slate-50/50"
                      }`}
                    >
                      <td className="w-[48%] px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200/60 bg-slate-100 shadow-sm">
                            {thumbnailSrc ? (
                              <img
                                src={thumbnailSrc}
                                alt="thumbnail"
                                className="h-full w-full object-cover"
                                onError={() =>
                                  setFailedThumbnails((prev) => ({ ...prev, [articleKey]: true }))
                                }
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-left text-[17px] font-bold leading-snug text-slate-800 transition-colors group-hover:text-[#3721ED]">
                              {item.title || "제목 없음"}
                            </span>
                            {item.summary ? (
                              <span className="mt-0.5 block truncate text-left text-xs text-slate-500">
                                {item.summary}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="w-[16%] px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ${getContentTypeGradient(
                              typeLabel,
                            )}`}
                          >
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <span className="whitespace-nowrap text-sm font-semibold text-slate-600">
                            {typeLabel}
                          </span>
                        </div>
                      </td>

                      <td className="w-[16%] px-6 py-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5 text-slate-500">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(item.createdAt || item.updatedAt)}
                          </div>
                        </div>
                      </td>

                      <td className="w-[10%] px-6 py-4 text-center">
                        {isDeleted ? (
                          <div className="inline-flex items-center rounded-lg bg-red-50 p-1.5 text-red-600">
                            <XCircle className="h-4 w-4" />
                            <span className="ml-1 whitespace-nowrap text-xs font-bold">삭제됨</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center rounded-lg bg-indigo-50 p-1.5 text-indigo-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="ml-1 whitespace-nowrap text-xs font-bold">게시됨</span>
                          </div>
                        )}
                      </td>

                      <td className="w-[10%] px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            title="상세 보기"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/workspace?id=${item.articleId}&mode=view`);
                            }}
                            className="rounded-lg p-2 text-slate-400 transition-all hover:bg-blue-50 hover:text-[#3721ED]"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {!isDeleted ? (
                            <button
                              title="삭제"
                              onClick={(event) => handleDelete(event, item.articleId)}
                              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
