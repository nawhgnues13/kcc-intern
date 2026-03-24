import { useState, useEffect } from "react";
import { Plus, Search, Users } from "lucide-react";
import { RegistrationTable, ColumnDef } from "../../features/crm/components/RegistrationTable";
import { employeeService, Employee, CreateEmployeeRequest } from "../../services/api/employeeService";
import { ModalLayout } from "../../components/shared/ModalLayout";

export function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<CreateEmployeeRequest>({
    name: "", email: "", phone: "", companyCode: "kcc_autogroup", departmentCode: "sales", position: "", branchName: ""
  });

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await employeeService.getEmployees();
      setEmployees(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleOpenModal = (emp?: Employee) => {
    if (emp) {
      setEditingId(emp.employeeId);
      setFormData({
        name: emp.name, email: emp.email, phone: emp.phone,
        companyCode: emp.companyCode, departmentCode: emp.departmentCode,
        position: emp.position, branchName: emp.branchName || ""
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "", companyCode: "kcc_autogroup", departmentCode: "sales", position: "", branchName: "" });
    }
    setIsModalOpen(true);
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCompany = e.target.value;
    const newDept = newCompany === 'kcc_autogroup' ? 'sales' : 'business_support';
    setFormData({
      ...formData,
      companyCode: newCompany,
      departmentCode: newDept,
      branchName: newCompany === 'kcc_autogroup' ? formData.branchName : ""
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingId) {
        await employeeService.updateEmployee(editingId, formData);
      } else {
        await employeeService.createEmployee(formData);
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error(err);
      alert("저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!window.confirm("정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.")) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await employeeService.deleteEmployee(editingId);
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error(err);
      alert("삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = employees.filter(e => e.name.includes(searchTerm) || e.branchName.includes(searchTerm));

  const columns: ColumnDef<Employee>[] = [
    { header: "이름", field: "name" },
    { header: "이메일", field: "email" },
    { header: "연락처", field: "phone" },
    { header: "회사", field: "companyCode" },
    { header: "부서", field: "departmentCode" },
    { header: "지점명", field: "branchName" },
    { header: "계정 연결 상태", render: (item) => (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${item.linkedUserId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
        {item.linkedUserId ? '연결됨' : '미연결'}
      </span>
    )}
  ];

  return (
    <div className="flex-1 bg-[#F8F9FB] w-full h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Users className="w-8 h-8 text-[#3721ED]" />
              직원 관리 (CRM)
            </h1>
            <p className="text-slate-500 mt-2">직원 데이터를 등록하고 관리합니다.</p>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#3721ED] hover:bg-[#2c1ac0] text-white rounded-xl font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> 직원 등록
          </button>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="직원명 또는 지점 검색..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#3721ED] focus:ring-1 focus:ring-[#3721ED]"
            />
          </div>
        </div>

        <RegistrationTable 
          data={filtered}
          columns={columns}
          isLoading={isLoading}
          onRowClick={handleOpenModal}
          emptyMessage="등록된 직원이 없습니다."
        />

        <ModalLayout isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidthClass="max-w-md">
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6">{editingId ? '직원 수정' : '직원 등록'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">이름</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">이메일</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">연락처</label>
                <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">회사</label>
                  <select value={formData.companyCode} onChange={handleCompanyChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="kcc_autogroup">KCC오토그룹</option>
                    <option value="kcc_it">KCC정보통신</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">부서</label>
                  <select value={formData.departmentCode} onChange={e => setFormData({...formData, departmentCode: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                    {formData.companyCode === 'kcc_autogroup' ? (
                      <>
                        <option value="sales">영업점</option>
                        <option value="service_center">서비스센터</option>
                      </>
                    ) : (
                      <>
                        <option value="business_support">사업지원그룹</option>
                        <option value="poodly">포들리</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={formData.companyCode === 'kcc_autogroup' ? "" : "col-span-2"}>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">직급</label>
                  <input required type="text" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                {formData.companyCode === 'kcc_autogroup' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">지점명</label>
                    <input required type="text" value={formData.branchName} onChange={e => setFormData({...formData, branchName: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100 mt-6 bg-white">
                <div>
                  {editingId && (
                    <button type="button" onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                      삭제
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">취소</button>
                  <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-[#3721ED] hover:bg-[#2c1ac0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </ModalLayout>
      </div>
    </div>
  );
}
