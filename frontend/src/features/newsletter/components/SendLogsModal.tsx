import { useState, useEffect } from "react";
import { History, X, Loader2 } from "lucide-react";
import { ModalLayout } from "../../../components/shared/ModalLayout";
import { newsletterService } from "../../../services/api/newsletterService";

interface SendLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleId: string;
}

export function SendLogsModal({ isOpen, onClose, articleId }: SendLogsModalProps) {
  const [logs, setLogs] = useState<Array<{ id: string; recipientEmail: string; recipientName: string; subject: string; status: string; sentAt: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    newsletterService.getSendLogs(articleId)
      .then((res) => setLogs(res.items))
      .finally(() => setLoading(false));
  }, [isOpen, articleId]);

  return (
    <ModalLayout isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <History className="w-5 h-5 text-[#3721ED]" /> 발송 이력
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">발송 이력이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left pb-2 font-medium">수신자</th>
                <th className="text-left pb-2 font-medium">발송 시각</th>
                <th className="text-left pb-2 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50">
                  <td className="py-2.5 pr-4">
                    <p className="text-slate-700">{log.recipientEmail}</p>
                    {log.recipientName && <p className="text-xs text-slate-400">{log.recipientName}</p>}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">
                    {new Date(log.sentAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {log.status === 'success' ? '성공' : '실패'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ModalLayout>
  );
}
