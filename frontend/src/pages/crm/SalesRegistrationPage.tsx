import { useState, useEffect } from "react";
import { Plus, Search, Car } from "lucide-react";
import { RegistrationTable, ColumnDef } from "../../features/crm/components/RegistrationTable";
import { crmService, SalesRegistration } from "../../services/api/crmService";
import { ModalLayout } from "../../components/shared/ModalLayout";
import { EmployeeSelect } from "../../features/crm/components/EmployeeSelect";
import { PhotoUploader } from "../../features/crm/components/PhotoUploader";

export function SalesRegistrationPage() {
  const [data, setData] = useState<SalesRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SalesRegistration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<Record<string, any>>({
    employee_id: "", customer_name: "", customer_phone: "", customer_email: "",
    vehicle_model: "", sale_price: 0, sale_date: "", branch_name: "", note: ""
  });
  
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [keepPhotoIds, setKeepPhotoIds] = useState<string[]>([]);
  const [existingDescriptions, setExistingDescriptions] = useState<Record<string, string>>({});
  const [newDescriptions, setNewDescriptions] = useState<string[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await crmService.getSalesRegistrations();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (item?: SalesRegistration) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        employee_id: item.employeeId, customer_name: item.customerName,
        customer_phone: item.customerPhone, customer_email: item.customerEmail,
        vehicle_model: item.vehicleModel, sale_price: item.salePrice,
        sale_date: item.saleDate.substring(0, 16), branch_name: item.branchName, note: item.note || ""
      });
      setKeepPhotoIds(item.photos.map(p => p.photoId));
      
      const exDesc: Record<string, string> = {};
      item.photos.forEach(p => exDesc[p.photoId] = p.description || "");
      setExistingDescriptions(exDesc);
    } else {
      setEditingItem(null);
      setFormData({
        employee_id: "", customer_name: "", customer_phone: "", customer_email: "",
        vehicle_model: "", sale_price: 0, sale_date: "", branch_name: "", note: ""
      });
      setKeepPhotoIds([]);
      setExistingDescriptions({});
    }
    setNewFiles([]);
    setNewDescriptions([]);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Append seconds if datetime-local input lacks it for strict iso parsing
      const submissionData = { ...formData };
      if (submissionData.sale_date && submissionData.sale_date.length === 16) {
        submissionData.sale_date += ":00";
      }

      const existingDescToSubmit = keepPhotoIds.map(id => existingDescriptions[id] || "");

      if (editingItem) {
        await crmService.updateSalesRegistration(
          editingItem.salesRegistrationId, 
          submissionData, 
          newFiles, 
          newDescriptions,
          keepPhotoIds, 
          existingDescToSubmit
        );
      } else {
        await crmService.createSalesRegistration(
          submissionData, 
          newFiles,
          newDescriptions
        );
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    if (!window.confirm("정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.")) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await crmService.deleteSalesRegistration(editingItem.salesRegistrationId);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<SalesRegistration>[] = [
    { header: "고객명", field: "customerName" },
    { header: "차량 모델", field: "vehicleModel" },
    { header: "담당 직원", field: "employeeName" },
    { header: "판매 금액", render: (item) => `${item.salePrice.toLocaleString()}원` },
    { header: "일시", render: (item) => new Date(item.saleDate).toLocaleString() },
    { header: "지점명", field: "branchName" },
    { header: "사진", render: (item) => `${item.photos.length}장` }
  ];

  return (
    <div className="flex-1 bg-[#F8F9FB] w-full h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Car className="w-8 h-8 text-[#3721ED]" />
              차량 구매 등록
            </h1>
            <p className="text-slate-500 mt-2">고객의 신차 출고 데이터를 빠르게 등록합니다.</p>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#3721ED] hover:bg-[#2c1ac0] text-white rounded-xl font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> 내역 등록
          </button>
        </div>

        <RegistrationTable 
          data={data}
          columns={columns}
          isLoading={isLoading}
          onRowClick={handleOpenModal}
          emptyMessage="차량 구매 이력이 없습니다."
        />

        <ModalLayout isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidthClass="max-w-2xl">
          <div className="p-6 h-[85vh] flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 mb-6 shrink-0">{editingItem ? '구매 내역 수정' : '차량 구매 등록'}</h2>
            <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
              <form id="salesForm" onSubmit={handleSubmit} className="space-y-6">
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">고객 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">고객명</label>
                      <input required type="text" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">연락처</label>
                      <input required type="text" value={formData.customer_phone} onChange={e => setFormData({...formData, customer_phone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">이메일</label>
                      <input required type="email" value={formData.customer_email} onChange={e => setFormData({...formData, customer_email: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                  </div>
                </div>

                <div className="border border-slate-100 p-4 rounded-xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">판매 및 담당 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">담당 직원</label>
                      <EmployeeSelect required value={formData.employee_id} onChange={(id) => setFormData({...formData, employee_id: id})} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">차량 모델</label>
                      <input required type="text" value={formData.vehicle_model} onChange={e => setFormData({...formData, vehicle_model: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">판매 금액 (원)</label>
                      <input required type="number" min="0" value={formData.sale_price} onChange={e => setFormData({...formData, sale_price: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">지점명</label>
                      <input required type="text" value={formData.branch_name} onChange={e => setFormData({...formData, branch_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">판매 일시</label>
                      <input required type="datetime-local" value={formData.sale_date} onChange={e => setFormData({...formData, sale_date: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">특이사항 (노트)</label>
                      <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white resize-none" />
                    </div>
                  </div>
                </div>

                <div className="border border-slate-100 p-4 rounded-xl">
                  <PhotoUploader 
                    existingPhotos={editingItem?.photos || []}
                    onKeepPhotosChange={setKeepPhotoIds}
                    newFiles={newFiles}
                    onNewFilesChange={setNewFiles}
                    existingDescriptions={existingDescriptions}
                    onExistingDescriptionChange={(photoId, desc) => setExistingDescriptions(prev => ({...prev, [photoId]: desc}))}
                    newDescriptions={newDescriptions}
                    onNewDescriptionChange={(idx, desc) => {
                      const updated = [...newDescriptions];
                      updated[idx] = desc;
                      setNewDescriptions(updated);
                    }}
                    onNewFileRemove={(index) => {
                      const updated = [...newDescriptions];
                      updated.splice(index, 1);
                      setNewDescriptions(updated);
                    }}
                  />
                </div>

              </form>
            </div>
            <div className="shrink-0 pt-4 flex items-center justify-between border-t border-slate-100 bg-white">
              <div>
                {editingItem && (
                  <button type="button" onClick={handleDelete} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    삭제
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">취소</button>
                <button type="submit" form="salesForm" disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-white bg-[#3721ED] hover:bg-[#2c1ac0] rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          </div>
        </ModalLayout>
      </div>
    </div>
  );
}
