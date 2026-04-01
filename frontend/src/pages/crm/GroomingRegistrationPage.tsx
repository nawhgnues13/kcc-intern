import { useState, useEffect } from "react";
import { Plus, Search, Scissors } from "lucide-react";
import { RegistrationTable, ColumnDef } from "../../features/crm/components/RegistrationTable";
import { crmService, GroomingRegistration } from "../../services/api/crmService";
import { ModalLayout } from "../../components/shared/ModalLayout";
import { EmployeeSelect } from "../../features/crm/components/EmployeeSelect";
import { PhotoUploader } from "../../features/crm/components/PhotoUploader";

export function GroomingRegistrationPage() {
  const [data, setData] = useState<GroomingRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GroomingRegistration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<Record<string, any>>({
    employee_id: "", customer_name: "", customer_phone: "", customer_email: "",
    pet_name: "", pet_type: "dog", breed: "", grooming_details: "", price: 0,
    grooming_date: "", branch_name: "", note: ""
  });
  
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [keepPhotoIds, setKeepPhotoIds] = useState<string[]>([]);
  const [existingDescriptions, setExistingDescriptions] = useState<Record<string, string>>({});
  const [newDescriptions, setNewDescriptions] = useState<string[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await crmService.getGroomingRegistrations();
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

  const handleOpenModal = (item?: GroomingRegistration) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        employee_id: item.employeeId, customer_name: item.customerName,
        customer_phone: item.customerPhone, customer_email: item.customerEmail,
        pet_name: item.petName, pet_type: item.petType, breed: item.breed,
        grooming_details: item.groomingDetails, price: item.price,
        grooming_date: item.groomingDate.substring(0, 16), branch_name: item.branchName, note: item.note || ""
      });
      setKeepPhotoIds(item.photos.map(p => p.photoId));

      const exDesc: Record<string, string> = {};
      item.photos.forEach(p => exDesc[p.photoId] = p.photoDescription || "");
      setExistingDescriptions(exDesc);
    } else {
      setEditingItem(null);
      setFormData({
        employee_id: "", customer_name: "", customer_phone: "", customer_email: "",
        pet_name: "", pet_type: "dog", breed: "", grooming_details: "", price: 0,
        grooming_date: "", branch_name: "", note: ""
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
      const submissionData = { ...formData };
      if (submissionData.grooming_date && submissionData.grooming_date.length === 16) {
        submissionData.grooming_date += ":00";
      }

      const existingDescToSubmit = Object.fromEntries(
        keepPhotoIds.map((id) => [id, existingDescriptions[id] || ""])
      );

      if (editingItem) {
        await crmService.updateGroomingRegistration(
          editingItem.groomingRegistrationId, 
          submissionData, 
          newFiles, 
          newDescriptions,
          keepPhotoIds,
          existingDescToSubmit
        );
      } else {
        await crmService.createGroomingRegistration(
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
      await crmService.deleteGroomingRegistration(editingItem.groomingRegistrationId);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<GroomingRegistration>[] = [
    { header: "고객명", field: "customerName" },
    { header: "반려동물 이름", field: "petName" },
    { header: "종", field: "petType" },
    { header: "품종", field: "breed" },
    { header: "담당 직원", field: "employeeName" },
    { header: "가격", render: (item) => `${item.price.toLocaleString()}원` },
    { header: "미용 일시", render: (item) => new Date(item.groomingDate).toLocaleString() },
    { header: "지점명", field: "branchName" },
    { header: "사진", render: (item) => `${item.photos.length}장` }
  ];

  return (
    <div className="flex-1 bg-[#F8F9FB] w-full h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Scissors className="w-8 h-8 text-[#3721ED]" />
              애견 미용 등록
            </h1>
            <p className="text-slate-500 mt-2">반려동물 미용 및 스파 내역을 관리합니다.</p>
          </div>
          
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#3721ED] hover:bg-[#2c1ac0] text-white rounded-xl font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> 예약 등록
          </button>
        </div>

        <RegistrationTable 
          data={data}
          columns={columns}
          isLoading={isLoading}
          onRowClick={handleOpenModal}
          emptyMessage="애견 미용 이력이 없습니다."
        />

        <ModalLayout isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidthClass="max-w-2xl">
          <div className="p-6 h-[85vh] flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 mb-6 shrink-0">{editingItem ? '미용 내역 수정' : '애견 미용 등록'}</h2>
            <div className="flex-1 overflow-y-auto pr-2 pb-6 space-y-6">
              <form id="groomingForm" onSubmit={handleSubmit} className="space-y-6">
                
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
                  <h3 className="text-sm font-bold text-slate-700">반려동물 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">반려동물 이름</label>
                      <input required type="text" value={formData.pet_name} onChange={e => setFormData({...formData, pet_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">반려동물 종류</label>
                      <select required value={formData.pet_type} onChange={e => setFormData({...formData, pet_type: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                        <option value="dog">강아지</option>
                        <option value="cat">고양이</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">품종</label>
                      <input required type="text" value={formData.breed} onChange={e => setFormData({...formData, breed: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                  </div>
                </div>

                <div className="border border-slate-100 p-4 rounded-xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-700">미용 및 결제 정보</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">담당 미용사</label>
                      <EmployeeSelect required value={formData.employee_id} onChange={(id) => setFormData({...formData, employee_id: id})} filterDepartmentCode="poodly" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">미용 일시</label>
                      <input required type="datetime-local" value={formData.grooming_date} onChange={e => setFormData({...formData, grooming_date: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">결제 금액 (원)</label>
                      <input required type="number" min="0" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">지점명</label>
                      <input required type="text" value={formData.branch_name} onChange={e => setFormData({...formData, branch_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">미용 상세 내용</label>
                      <textarea required value={formData.grooming_details} onChange={e => setFormData({...formData, grooming_details: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white resize-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-500 block mb-1">메모</label>
                      <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white resize-none" />
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
                <button type="submit" form="groomingForm" disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-white bg-[#3721ED] hover:bg-[#2c1ac0] rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
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
