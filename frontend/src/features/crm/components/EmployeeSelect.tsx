import { useEffect, useState, useRef } from "react";
import { employeeService, Employee } from "../../../services/api/employeeService";
import { Loader2, Search, ChevronDown, Check } from "lucide-react";

interface EmployeeSelectProps {
  value: string;
  onChange: (employeeId: string) => void;
  required?: boolean;
  filterDepartmentCode?: string;
}

export function EmployeeSelect({ value, onChange, required = false, filterDepartmentCode }: EmployeeSelectProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const deptMapping: Record<string, string> = {
    sales: "영업점",
    service_center: "서비스센터",
    business_support: "사업지원그룹",
    poodly: "포들리"
  };

  useEffect(() => {
    async function loadEmployees() {
      try {
        const data = await employeeService.getEmployees();
        setEmployees(data);
      } catch (err) {
        console.error("직원 목록을 불러오지 못했습니다.", err);
      } finally {
        setLoading(false);
      }
    }
    loadEmployees();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-2 border border-slate-200 rounded-xl px-3 bg-slate-50">
        <Loader2 className="w-4 h-4 animate-spin" /> 직원 목록 로딩중...
      </div>
    );
  }

  const selectedEmployee = employees.find(e => e.employeeId === value);
  
  const filteredEmployees = employees.filter(emp => {
    if (filterDepartmentCode && emp.departmentCode !== filterDepartmentCode) return false;
    const searchLower = searchTerm.toLowerCase();
    const deptName = deptMapping[emp.departmentCode] || emp.departmentCode;
    return emp.name.toLowerCase().includes(searchLower) ||
           (emp.branchName && emp.branchName.toLowerCase().includes(searchLower)) ||
           deptName.toLowerCase().includes(searchLower) ||
           (emp.position && emp.position.toLowerCase().includes(searchLower));
  });

  return (
    <div className="relative w-full" ref={wrapperRef}>
      {/* Hidden input for form validation */}
      <input type="text" className="hidden" required={required} value={value} readOnly />
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3721ED]/20 focus:border-[#3721ED] transition-colors"
      >
        <span className={selectedEmployee ? "text-slate-900" : "text-slate-400"}>
          {selectedEmployee 
            ? `${selectedEmployee.name} (${selectedEmployee.branchName || deptMapping[selectedEmployee.departmentCode] || selectedEmployee.departmentCode} - ${selectedEmployee.position})` 
            : "담당 직원을 검색 및 선택하세요"}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg shadow-black/5 overflow-hidden">
          <div className="p-2 border-b border-slate-100 relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-transparent rounded-md focus:bg-white focus:border-[#3721ED] focus:ring-1 focus:ring-[#3721ED] outline-none transition-all"
              placeholder="이름, 지점명, 부서 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {filteredEmployees.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-500">
                {filterDepartmentCode === "poodly" ? "등록된 미용사가 없습니다." : filterDepartmentCode === "sales" ? "등록된 영업 직원이 없습니다." : filterDepartmentCode === "service_center" ? "등록된 서비스센터 직원이 없습니다." : "검색된 직원이 없습니다."}
              </div>
            ) : (
              filteredEmployees.map(emp => {
                const isSelected = emp.employeeId === value;
                const deptName = deptMapping[emp.departmentCode] || emp.departmentCode;
                
                return (
                  <button
                    key={emp.employeeId}
                    type="button"
                    onClick={() => {
                      onChange(emp.employeeId);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                      isSelected 
                        ? "bg-[#3721ED]/10 text-[#3721ED] font-medium" 
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span>{emp.name}</span>
                      <span className="text-xs text-slate-400 font-normal">
                        {emp.companyCode?.toUpperCase() === 'KCC_AUTOGROUP' ? 'KCC오토그룹' : 'KCC정보통신'} / {emp.branchName || deptName} / {emp.position}
                      </span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#3721ED]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
