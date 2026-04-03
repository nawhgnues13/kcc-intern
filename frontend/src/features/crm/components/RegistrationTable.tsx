import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

export interface ColumnDef<T> {
  header: string;
  field?: keyof T;
  render?: (item: T) => React.ReactNode;
}

interface RegistrationTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (item: T) => void;
  isLoading: boolean;
  emptyMessage?: string;
  onAddClick?: () => void;
}

export function RegistrationTable<T extends { [key: string]: any }>({
  data,
  columns,
  onRowClick,
  isLoading,
  emptyMessage = "등록된 데이터가 없습니다.",
  onAddClick
}: RegistrationTableProps<T>) {

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <Loader2 className="w-8 h-8 text-[#3721ED] animate-spin mb-4" />
        <p className="text-slate-500 font-medium">데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <p className="text-slate-500 font-medium">{emptyMessage}</p>
        {onAddClick && (
          <button 
            onClick={onAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all"
          >
            데이터 불러오기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {columns.map((col, idx) => (
                <th key={idx} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, rowIdx) => (
              <motion.tr
                key={`${item.id || item.employeeId || item.salesRegistrationId || item.serviceRegistrationId || item.groomingRegistrationId || 'row'}-${rowIdx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: rowIdx * 0.05 }}
                onClick={() => onRowClick && onRowClick(item)}
                className={`border-b border-slate-50 last:border-0 hover:bg-blue-50/30 transition-colors ${onRowClick ? 'cursor-pointer group' : ''}`}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">
                    {col.render ? col.render(item) : (col.field ? String(item[col.field] || '-') : '-')}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
