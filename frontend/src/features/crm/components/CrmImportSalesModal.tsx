import { useState, useEffect } from "react";
import { Search, Loader2, FileText, Instagram, Facebook } from "lucide-react";
import { ExternalSalesDelivery, crmService } from "../../../services/api/crmService";
import { useAuthStore } from "../../../store/useAuthStore";
import { ModalLayout } from "../../../components/shared/ModalLayout";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: ExternalSalesDelivery) => void;
}

export function CrmImportSalesModal({ isOpen, onClose, onSelect }: Props) {
  const { user } = useAuthStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ExternalSalesDelivery[]>([]);

  // Initialize dates to today and today+7 when opened
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      setFromDate(todayStr);
      
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      setToDate(nextWeek.toISOString().split('T')[0]);
      
      setData([]);
    }
  }, [isOpen]);

  // Update toDate when fromDate changes
  const handleFromDateChange = (val: string) => {
    setFromDate(val);
    if (val) {
      const d = new Date(val);
      d.setDate(d.getDate() + 7);
      setToDate(d.toISOString().split('T')[0]);
    } else {
      setToDate("");
    }
  };

  const handleSearch = async () => {
    if (!user?.id || !fromDate || !toDate) return;
    
    // YYYY-MM-DD -> YYYYMMDD
    const fDate = fromDate.replace(/-/g, "");
    const tDate = toDate.replace(/-/g, "");
    
    setIsLoading(true);
    try {
      const res = await crmService.getExternalSalesDeliveries(user.id, fDate, tDate);
      setData(res);
    } catch (err) {
      console.error(err);
      alert("출고 건을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (item: ExternalSalesDelivery) => {
    if (item.isImported) return;
    onSelect(item);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return dateStr;
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    if (dateStr.length === 8) {
      return `${dateStr.substring(0,4)}.${dateStr.substring(4,6)}.${dateStr.substring(6,8)}`;
    }
    return dateStr;
  };

  const renderStatusIcons = (contents: ExternalSalesDelivery["generatedContents"]) => {
    if (!contents || contents.length === 0) return <span className="text-slate-300">-</span>;
    
    const formats = contents.map(c => c.contentFormat);
    return (
      <div className="flex gap-1.5 justify-center">
        {formats.includes("blog") && <span title="블로그 생성됨"><FileText className="w-3.5 h-3.5 text-blue-500" /></span>}
        {formats.includes("instagram") && <span title="인스타그램 생성됨"><Instagram className="w-3.5 h-3.5 text-pink-500" /></span>}
        {formats.includes("facebook") && <span title="페이스북 생성됨"><Facebook className="w-3.5 h-3.5 text-blue-700" /></span>}
      </div>
    );
  };

  return (
    <ModalLayout isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-5xl">
      <div className="p-6 h-[85vh] flex flex-col">
        <h2 className="text-xl font-bold text-slate-800 mb-6 shrink-0">CRM 출고건 불러오기</h2>
        
        <div className="flex gap-4 items-end mb-6 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">조회 시작일</label>
            <input 
              type="date" 
              value={fromDate} 
              onChange={e => handleFromDateChange(e.target.value)} 
              disabled={isLoading}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED]" 
            />
          </div>
          <div className="flex-1 text-center self-center pt-5">
            <span className="text-slate-400 font-bold">~</span>
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">조회 종료일 (7일 고정)</label>
            <input 
              type="date" 
              value={toDate} 
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed" 
            />
          </div>
          <button 
            onClick={handleSearch}
            disabled={isLoading || !fromDate}
            className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 h-[38px]"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            조회
          </button>
        </div>

        <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 shadow-sm z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-slate-500">상태</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 text-center">생성 채널</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500">출고일자</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500">고객명</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500">차량 모델</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500">트림</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500">판매 금액</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 text-center">선택</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#3721ED]" />
                    수집 데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Search className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm font-medium">조회 기간을 설정하고 조회 버튼을 눌러주세요.</p>
                      <p className="text-xs mt-1">(최대 7일간의 본인 담당 출고 내역이 표시됩니다)</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item, i) => (
                  <tr key={i} className={`hover:bg-slate-50 transition-colors ${item.isImported ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      {item.isImported ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          이미 등록됨
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                          신규 건
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderStatusIcons(item.generatedContents)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatDate(item.saleDate)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{item.customerName}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{item.vehicleModel}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 truncate max-w-[150px]" title={item.className}>{item.className}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-bold">
                      {Number(item.salePrice).toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => handleSelect(item)}
                        disabled={item.isImported}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          item.isImported 
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                          : "bg-[#3721ED] hover:bg-[#2c1ac0] text-white shadow-sm hover:shadow-md"
                        }`}
                      >
                        {item.isImported ? "완료" : "등록하기"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ModalLayout>
  );
}
