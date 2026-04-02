import { useEffect, useRef, useState } from "react";
import { BarChart2, Car, ChevronDown, ChevronUp, Palette, RefreshCw } from "lucide-react";
import axios from "axios";

// ── Types ──────────────────────────────────────────────────────────────────

interface FilterOptions {
  genders: string[];
  age_groups: string[];
  showrooms: string[];
  models: string[];
  jobs: string[];
  price_range: { min: number; max: number };
  date_range: { min: string; max: string }; // YYYYMMDD
}

type RankItem = { count: number; percent: number; [key: string]: string | number | null };
interface ModelItem extends RankItem { model: string }
interface ClassItem extends RankItem { class: string }
interface ModelResult {
  total: number;
  model_ranking: ModelItem[];
  class_ranking: ClassItem[];
}

interface ColorItem extends RankItem { color: string }
interface ColorResult {
  total: number;
  model_filter: string | null;
  exterior_colors: ColorItem[];
  interior_colors: ColorItem[];
}

type TabType = "model" | "color";

const DEFAULT_VISIBLE = 10;

// ── Helpers ────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  "#3721ED", "#6B53F5", "#9B86FF", "#C4B5FF", "#DDD6FF",
  "#818CF8", "#A5B4FC", "#C7D2FE", "#E0E7FF", "#EEF2FF",
];

/** YYYYMMDD → YYYY-MM-DD (HTML date input value) */
function toInputDate(yyyymmdd: string) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/** YYYY-MM-DD → YYYYMMDD */
function fromInputDate(htmlDate: string) {
  return htmlDate.replace(/-/g, "");
}

function toQueryString(params: Record<string, unknown>) {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(params)) {
    if (Array.isArray(val)) {
      val.forEach((v) => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`));
    } else if (val !== undefined && val !== null && val !== "") {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts.join("&");
}

// ── Sub-components ─────────────────────────────────────────────────────────

function RankBar({ label, count, percent, rank, color }: {
  label: string; count: number; percent: number; rank: number; color: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-5 text-xs font-bold text-slate-300 text-right shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-slate-700 truncate capitalize">{label}</span>
          <span className="text-xs text-slate-400 ml-2 shrink-0">{count}건 · {percent}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(percent, 1)}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

function RankList({ items, labelKey }: {
  items: RankItem[];
  labelKey: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, DEFAULT_VISIBLE);
  const hasMore = items.length > DEFAULT_VISIBLE;

  return (
    <div>
      <div className="space-y-0.5">
        {visible.map((item, i) => (
          <RankBar
            key={String(item[labelKey])}
            rank={i + 1}
            label={String(item[labelKey])}
            count={item.count}
            percent={item.percent}
            color={BAR_COLORS[i] ?? "#EEF2FF"}
          />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-[#3721ED] transition-colors"
        >
          {expanded
            ? <><ChevronUp className="w-3.5 h-3.5" />접기</>
            : <><ChevronDown className="w-3.5 h-3.5" />{items.length - DEFAULT_VISIBLE}개 더보기</>}
        </button>
      )}
    </div>
  );
}

function CheckboxGroup({ label, options, selected, onChange }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              selected.includes(opt)
                ? "bg-[#3721ED] text-white border-[#3721ED]"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#3721ED] hover:text-[#3721ED]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Model Tab ──────────────────────────────────────────────────────────────

function ModelTab({ filterOptions }: { filterOptions: FilterOptions }) {
  const [selectedGender, setSelectedGender] = useState<string[]>([]);
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  const [selectedShowrooms, setSelectedShowrooms] = useState<string[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [dateFrom, setDateFrom] = useState(() => toInputDate(filterOptions.date_range.min));
  const [dateTo, setDateTo] = useState(() => toInputDate(filterOptions.date_range.max));
  const [result, setResult] = useState<ModelResult | null>(null);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = (params: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/trends/models?${toQueryString(params)}`);
        setResult(res.data);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  useEffect(() => {
    const params: Record<string, unknown> = {};
    if (selectedGender.length === 1) params.gender = selectedGender[0];
    if (selectedAgeGroups.length) params.age_groups = selectedAgeGroups;
    if (selectedShowrooms.length) params.showrooms = selectedShowrooms;
    if (selectedJobs.length) params.jobs = selectedJobs;
    if (priceMin) params.price_min = Number(priceMin);
    if (priceMax) params.price_max = Number(priceMax);
    if (dateFrom) params.date_from = fromInputDate(dateFrom);
    if (dateTo) params.date_to = fromInputDate(dateTo);
    fetchData(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGender, selectedAgeGroups, selectedShowrooms, selectedJobs, priceMin, priceMax, dateFrom, dateTo]);

  const reset = () => {
    setSelectedGender([]);
    setSelectedAgeGroups([]);
    setSelectedShowrooms([]);
    setSelectedJobs([]);
    setPriceMin("");
    setPriceMax("");
    setDateFrom(toInputDate(filterOptions.date_range.min));
    setDateTo(toInputDate(filterOptions.date_range.max));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <CheckboxGroup label="성별" options={filterOptions.genders} selected={selectedGender} onChange={setSelectedGender} />
        <CheckboxGroup label="연령대" options={filterOptions.age_groups} selected={selectedAgeGroups} onChange={setSelectedAgeGroups} />
        <CheckboxGroup label="직업" options={filterOptions.jobs} selected={selectedJobs} onChange={setSelectedJobs} />
        <CheckboxGroup label="전시장" options={filterOptions.showrooms} selected={selectedShowrooms} onChange={setSelectedShowrooms} />

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">가격 범위 (만원)</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder={`최소 (${filterOptions.price_range.min.toLocaleString()})`}
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="w-44 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#3721ED]"
            />
            <span className="text-slate-300">—</span>
            <input
              type="number"
              placeholder={`최대 (${filterOptions.price_range.max.toLocaleString()})`}
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="w-44 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#3721ED]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">출고 기간</p>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dateFrom}
              min={toInputDate(filterOptions.date_range.min)}
              max={dateTo || toInputDate(filterOptions.date_range.max)}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#3721ED] text-slate-700"
            />
            <span className="text-slate-300">—</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || toInputDate(filterOptions.date_range.min)}
              max={toInputDate(filterOptions.date_range.max)}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#3721ED] text-slate-700"
            />
          </div>
        </div>

        <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 transition-colors pt-1">
          필터 초기화
        </button>
      </div>

      {loading && !result && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          불러오는 중...
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Car className="w-4 h-4 text-[#3721ED]" />
                모델 순위
              </h2>
              <span className="text-xs text-slate-400">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin inline" /> : `총 ${result.total}건`}
              </span>
            </div>
            {result.model_ranking.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">해당 조건의 데이터가 없습니다.</p>
              : <RankList items={result.model_ranking} labelKey="model" />}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Car className="w-4 h-4 text-slate-300" />
                세부 클래스 순위
              </h2>
              <span className="text-xs text-slate-400">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin inline" /> : `총 ${result.total}건`}
              </span>
            </div>
            {result.class_ranking.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">해당 조건의 데이터가 없습니다.</p>
              : <RankList items={result.class_ranking} labelKey="class" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Color Tab ──────────────────────────────────────────────────────────────

function ColorTab({ filterOptions }: { filterOptions: FilterOptions }) {
  const [selectedModel, setSelectedModel] = useState("");
  const [result, setResult] = useState<ColorResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchColors = async (model: string) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (model) params.model = model;
      const res = await axios.get(`/api/trends/colors?${toQueryString(params)}`);
      setResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColors(selectedModel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">모델 선택</p>
        <div className="flex flex-wrap gap-2">
          {["", ...filterOptions.models].map((m) => (
            <button
              key={m || "__all__"}
              onClick={() => setSelectedModel(m)}
                      disabled={loading}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                selectedModel === m
                  ? "bg-[#3721ED] text-white border-[#3721ED]"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-[#3721ED] hover:text-[#3721ED]"
              }`}
            >
              {m || "전체"}
            </button>
          ))}
        </div>
      </div>

      {loading && !result && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          불러오는 중...
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#3721ED]" />
                외장 색상
                {result.model_filter && (
                  <span className="text-xs bg-[#3721ED]/10 text-[#3721ED] px-2 py-0.5 rounded-full font-medium">{result.model_filter}</span>
                )}
              </h2>
              <span className="text-xs text-slate-400">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin inline" /> : `${result.total}건`}
              </span>
            </div>
            {result.exterior_colors.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">데이터가 없습니다.</p>
              : <RankList items={result.exterior_colors} labelKey="color" />}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Palette className="w-4 h-4 text-slate-300" />
                내장 색상
                {result.model_filter && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{result.model_filter}</span>
                )}
              </h2>
              <span className="text-xs text-slate-400">
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin inline" /> : `${result.total}건`}
              </span>
            </div>
            {result.interior_colors.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">데이터가 없습니다.</p>
              : <RankList items={result.interior_colors} labelKey="color" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function SalesTrendPage() {
  const [tab, setTab] = useState<TabType>("model");
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  useEffect(() => {
    axios.get("/api/trends/filters").then((r) => setFilterOptions(r.data));
  }, []);

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[#3721ED]" />
            판매 트렌드 기반 추천
          </h1>
          <p className="text-sm text-slate-500 mt-1">2026년 1월 메르세데스-벤츠 판매 데이터 (533건) 기반</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab("model")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "model" ? "bg-[#3721ED] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Car className="w-4 h-4" />
            모델 고르기
          </button>
          <button
            onClick={() => setTab("color")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "color" ? "bg-[#3721ED] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Palette className="w-4 h-4" />
            색상 고르기
          </button>
        </div>

        {/* Tab Content */}
        {filterOptions ? (
          tab === "model"
            ? <ModelTab key="model" filterOptions={filterOptions} />
            : <ColorTab key="color" filterOptions={filterOptions} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400 py-8">
            <RefreshCw className="w-4 h-4 animate-spin" />
            데이터 불러오는 중...
          </div>
        )}
      </div>
    </div>
  );
}
