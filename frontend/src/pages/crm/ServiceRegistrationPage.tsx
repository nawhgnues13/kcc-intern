import { useState, useEffect } from "react";
import { Plus, Search, Wrench, Database } from "lucide-react";
import { RegistrationTable, ColumnDef } from "../../features/crm/components/RegistrationTable";
import { crmService, ServiceRegistration } from "../../services/api/crmService";
import { ModalLayout } from "../../components/shared/ModalLayout";
import { EmployeeSelect } from "../../features/crm/components/EmployeeSelect";
import { PhotoUploader } from "../../features/crm/components/PhotoUploader";
import { CheckSquare, Square } from "lucide-react";

// --- Custom Brand SVG Icons ---
const InstagramIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FEE411"/><stop offset="0.1" stopColor="#FEDB16"/><stop offset="0.2" stopColor="#FEC125"/><stop offset="0.3" stopColor="#FE983D"/><stop offset="0.4" stopColor="#FE5F5E"/><stop offset="0.5" stopColor="#FE2181"/><stop offset="0.6" stopColor="#9000DC"/><stop offset="0.75" stopColor="#515BD4"/><stop offset="1" stopColor="#5851DB"/>
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#ig-grad)"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M12 7C9.2385 7 7 9.2385 7 12C7 14.7615 9.2385 17 12 17C14.7615 17 17 14.7615 17 12C17 9.2385 14.7615 7 12 7ZM12 14.6C10.5641 14.6 9.4 13.4359 9.4 12C9.4 10.5641 10.5641 9.4 12 9.4C13.4359 9.4 14.6 10.5641 14.6 12C14.6 13.4359 13.4359 14.6 12 14.6Z" fill="white"/>
    <rect x="5.5" y="5.5" width="13" height="13" rx="3.5" stroke="white" strokeWidth="2"/>
    <circle cx="16.5" cy="7.5" r="1" fill="white"/>
  </svg>
);

const FacebookIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#1877F2"/>
    <path d="M15.5 12L16 8.5H12.5V6.5C12.5 5.5 13 4.5 14.5 4.5H16.5V1.5C16.5 1.5 14.5 1 13 1C9.5 1 7.5 3 7.5 6.5V8.5H4.5V12H7.5V20H12.5V12H15.5Z" fill="white"/>
  </svg>
);

const BlogIcon = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#03C75A"/>
    <rect x="5.5" y="6.5" width="13" height="11" rx="2" stroke="white" strokeWidth="1.5"/>
    <path d="M8 10.5h8M8 13.5h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const CONTENT_CHANNELS = [
  { id: "blog", label: "블로그", format: "blog", template: "blog_naver_basic", defaultChecked: false, icon: BlogIcon },
  { id: "instagram", label: "인스타그램", format: "instagram", template: "instagram_default", defaultChecked: false, icon: InstagramIcon },
  { id: "facebook", label: "페이스북", format: "facebook", template: "facebook_page_basic", defaultChecked: false, icon: FacebookIcon },
];

export function ServiceRegistrationPage() {
  const [data, setData] = useState<ServiceRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceRegistration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  
  const [formData, setFormData] = useState<Record<string, any>>({
    employee_id: "", customer_name: "", customer_phone: "", customer_email: "",
    vehicle_model: "", service_date: "", repair_details: "", repair_cost: 0, branch_name: "", note: ""
  });
  
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [keepPhotoIds, setKeepPhotoIds] = useState<string[]>([]);
  const [existingDescriptions, setExistingDescriptions] = useState<Record<string, string>>({});
  const [newDescriptions, setNewDescriptions] = useState<string[]>([]);

  // 채널 선택 상태
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    CONTENT_CHANNELS.filter(c => c.defaultChecked).map(c => c.id)
  );

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await crmService.getServiceRegistrations();
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

  const handleNavigateToResult = (e: React.MouseEvent, taskId: string, articleId?: string | null) => {
    e?.stopPropagation();
    const params = new URLSearchParams();
    if (articleId) params.set('articleId', articleId);
    params.set('taskId', taskId);
    window.location.href = `/generation-results?${params.toString()}`;
  };

  const handleOpenModal = (item?: ServiceRegistration) => {
    if (item) {
      setEditingItem(item);
      const currentFormData = {
        employee_id: item.employeeId, 
        customer_name: item.customerName,
        customer_phone: item.customerPhone, 
        customer_email: item.customerEmail,
        vehicle_model: item.vehicleModel, 
        service_date: item.serviceDate.substring(0, 16),
        repair_details: item.repairDetails, 
        repair_cost: item.repairCost,
        branch_name: item.branchName, 
        note: item.note || ""
      };
      setFormData(currentFormData);
      setKeepPhotoIds(item.photos.map(p => p.photoId));

      const exDesc: Record<string, string> = {};
      item.photos.forEach(p => exDesc[p.photoId] = p.photoDescription || "");
      setExistingDescriptions(exDesc);

      const generatedIds = item.createdTasks?.map(t => {
          const found = CONTENT_CHANNELS.find(c => c.format === t.contentFormat.toLowerCase());
          return found?.id;
      }).filter(Boolean) as string[] || [];
      setSelectedChannels(generatedIds);

      // Snapshot
      setSnapshot({
        formData: currentFormData,
        keepPhotoIds: item.photos.map(p => p.photoId),
        existingDescriptions: exDesc,
        generatedIds: generatedIds
      });
      setIsViewMode(true);
      setIsEditMode(false);
    } else {
      setEditingItem(null);
      setFormData({
        employee_id: "", customer_name: "", customer_phone: "", customer_email: "",
        vehicle_model: "", service_date: "", repair_details: "", repair_cost: 0, branch_name: "", note: ""
      });
      setKeepPhotoIds([]);
      setExistingDescriptions({});
      setSelectedChannels(CONTENT_CHANNELS.filter(c => c.defaultChecked).map(c => c.id));
      setIsViewMode(false);
      setIsEditMode(true);
      setSnapshot(null);
    }
    setNewFiles([]);
    setNewDescriptions([]);
    setIsModalOpen(true);
  };

  const handleCreateSinglePost = async (format: string) => {
    if (!editingItem) return;
    const ch = CONTENT_CHANNELS.find(c => c.format === format);
    if (!ch) return;

    if (!window.confirm(`${ch.label} 게시물을 생성하시겠습니까?`)) return;

    setIsSubmitting(true);
    try {
      const requestedContents = [{ content_format: ch.format, template_style: ch.template }];
      await crmService.updateServiceRegistration(
        editingItem.serviceRegistrationId,
        formData,
        [], 
        [], 
        keepPhotoIds,
        existingDescriptions,
        requestedContents,
        "" 
      );
      fetchData(); 
      const updatedItem = await crmService.getServiceRegistrations().then(list => list.find(r => r.serviceRegistrationId === editingItem.serviceRegistrationId));
      if (updatedItem) setEditingItem(updatedItem);
    } catch (err) {
      console.error(err);
      alert("생성 요청에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    if (checkIsBaseDataChanged()) {
      if (!window.confirm("변경 내용을 버리고 상세 보기로 돌아가시겠습니까?")) return;
    }
    
    if (snapshot) {
      setFormData(snapshot.formData);
      setKeepPhotoIds(snapshot.keepPhotoIds);
      setExistingDescriptions(snapshot.existingDescriptions);
      setSelectedChannels(snapshot.generatedIds);
    }
    
    setIsViewMode(true);
    setIsEditMode(false);
  };

  const enterEditMode = () => {
    setIsViewMode(false);
    setIsEditMode(true);
    if (snapshot) setSelectedChannels(snapshot.generatedIds);
  };

  const checkIsBaseDataChanged = () => {
    if (!snapshot) return false;
    const fieldsToCompare = [
        'customer_name', 'customer_phone', 'customer_email', 'vehicle_model', 
        'service_date', 'repair_details', 'repair_cost', 'branch_name', 'note'
    ];
    for (const f of fieldsToCompare) {
        if (formData[f] !== snapshot.formData[f]) return true;
    }
    if (newFiles.length > 0) return true;
    if (keepPhotoIds.length !== snapshot.keepPhotoIds.length) return true;
    for (const id of snapshot.keepPhotoIds) {
        if (!keepPhotoIds.includes(id)) return true;
    }
    for (const id of keepPhotoIds) {
        if (existingDescriptions[id] !== snapshot.existingDescriptions[id]) return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const submissionData = { ...formData };
      if (submissionData.service_date && submissionData.service_date.length === 16) {
        submissionData.service_date += ":00";
      }

      const requestedContents = selectedChannels.map(chId => {
        const ch = CONTENT_CHANNELS.find(c => c.id === chId)!;
        return { content_format: ch.format, template_style: ch.template };
      });

      // Regeneration Identification
      const isBaseDataChanged = checkIsBaseDataChanged();
      const previouslyGeneratedFormats = editingItem?.createdTasks?.map(t => t.contentFormat.toLowerCase()) || [];
      
      const regenerateFormats = selectedChannels
        .map(id => CONTENT_CHANNELS.find(c => c.id === id)?.format)
        .filter(f => f && previouslyGeneratedFormats.includes(f));
      
      const forceRegenerateFormats = (isBaseDataChanged && regenerateFormats.length > 0)
        ? JSON.stringify(regenerateFormats) 
        : "";

      const existingDescToSubmit = Object.fromEntries(
        keepPhotoIds.map((id) => [id, existingDescriptions[id] || ""])
      );

      if (editingItem) {
        await crmService.updateServiceRegistration(
          editingItem.serviceRegistrationId, 
          submissionData, 
          newFiles, 
          newDescriptions,
          keepPhotoIds,
          existingDescToSubmit,
          requestedContents,
          forceRegenerateFormats
        );
      } else {
        await crmService.createServiceRegistration(
          submissionData, 
          newFiles,
          newDescriptions,
          requestedContents
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
      await crmService.deleteServiceRegistration(editingItem.serviceRegistrationId);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<ServiceRegistration>[] = [
    { header: "고객명", field: "customerName" },
    { header: "차량 모델", field: "vehicleModel" },
    { header: "담당 직원", field: "employeeName" },
    { header: "수리 일시", render: (item) => new Date(item.serviceDate).toLocaleString() },
    { header: "지점명", field: "branchName" },
    { 
        header: "생성 콘텐츠", 
        render: (item) => (
          <div className="flex gap-2">
            {item.createdTasks?.map((task, idx) => {
              const Icon = STATUS_ICONS[task.contentFormat.toLowerCase() as keyof typeof STATUS_ICONS];
              if (!Icon) return null;
              
              const statusColors = {
                completed: "text-emerald-500 bg-emerald-50 border-emerald-100",
                pending: "text-amber-500 bg-amber-50 border-amber-100",
                in_progress: "text-blue-500 bg-blue-50 border-blue-100",
                failed: "text-rose-500 bg-rose-50 border-rose-100",
                skipped: "text-slate-400 bg-slate-50 border-slate-100"
              };
              
              return (
                <button
                  key={idx}
                  onClick={(e) => handleNavigateToResult(e, task.taskId, task.articleId)}
                  className={`p-1.5 rounded-lg border transition-all hover:scale-110 ${statusColors[task.status as keyof typeof statusColors] || "text-slate-400"}`}
                  title={`${task.contentFormat} (${task.status})`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
            {!item.createdTasks?.length && <span className="text-xs text-slate-400">-</span>}
          </div>
        )
      }
  ];

  const STATUS_ICONS = {
    blog: BlogIcon,
    instagram: InstagramIcon,
    facebook: FacebookIcon,
  };

  return (
    <div className="flex-1 bg-[#F8F9FB] w-full h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Wrench className="w-8 h-8 text-[#3721ED]" />
              차량 수리 등록
            </h1>
            <p className="text-slate-500 mt-2">차량 AS 및 수리 내역을 관리합니다.</p>
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
          emptyMessage="차량 수리 이력이 없습니다."
        />

        <ModalLayout isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidthClass="max-w-3xl">
          <div className="flex flex-col h-[85vh] bg-white rounded-3xl overflow-hidden relative">
            {/* X Close Button */}
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-6 z-30 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>

            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-20">
              <h2 className="text-xl font-bold text-slate-800">
                {isViewMode ? '수리 내역 상세' : '내용 수정 및 재생성'}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
              {/* Warning Banner for Edit Mode */}
              {isEditMode && snapshot && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 items-start">
                  <Wrench className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-800">내용 수정 시 안내</h4>
                    <p className="text-xs text-amber-700 leading-relaxed mt-1">메모, 사진, 사진 설명을 수정하면 기존 생성 게시물이 최신 내용 기준으로 다시 생성됩니다. 기존 결과물은 새로운 정보로 대체됩니다.</p>
                  </div>
                </div>
              )}

              {/* View/Edit Form Section */}
              <div className="space-y-6">
                  {/* Basic Info Section */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-[#3721ED]" />
                        <h3 className="text-lg font-bold text-slate-800">기본 등록 정보</h3>
                      </div>
                      {isEditMode && snapshot && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">입력된 기본 정보는 수정할 수 없습니다</span>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                      {isEditMode && !snapshot ? (
                        <>
                          <div className="col-span-1">
                            <label className="text-xs font-bold text-slate-600 block mb-1">고객명</label>
                            <input required type="text" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                          </div>
                          <div className="col-span-1">
                            <label className="text-xs font-bold text-slate-600 block mb-1">차량 모델</label>
                            <input required type="text" value={formData.vehicle_model} onChange={e => setFormData({...formData, vehicle_model: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                          </div>
                          <div className="col-span-1">
                            <label className="text-xs font-bold text-slate-600 block mb-1">담당 직원</label>
                            <EmployeeSelect required value={formData.employee_id} onChange={(id) => setFormData({...formData, employee_id: id})} filterDepartmentCode="service_center" />
                          </div>
                          <div className="col-span-1">
                            <label className="text-xs font-bold text-slate-600 block mb-1">수리 일시</label>
                            <input required type="datetime-local" value={formData.service_date} onChange={e => setFormData({...formData, service_date: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                          </div>
                          <div className="col-span-1">
                            <label className="text-xs font-bold text-slate-600 block mb-1">수리 비용</label>
                            <input required type="number" value={formData.repair_cost} onChange={e => setFormData({...formData, repair_cost: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                          </div>
                          <div className="col-span-1">
                            <label className="text-xs font-bold text-slate-600 block mb-1">전시장/지점</label>
                            <input required type="text" value={formData.branch_name} onChange={e => setFormData({...formData, branch_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">고객명</p><p className="text-sm font-semibold text-slate-700">{formData.customer_name || '-'}</p></div>
                          <div><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">차량 모델</p><p className="text-sm font-semibold text-slate-700">{formData.vehicle_model || '-'}</p></div>
                          <div><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">수리 일시</p><p className="text-sm font-semibold text-slate-700">{formData.service_date?.replace('T', ' ') || '-'}</p></div>
                          <div><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">수리 비용</p><p className="text-sm font-semibold text-slate-700">{Number(formData.repair_cost || 0).toLocaleString()}원</p></div>
                          <div><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">전시장/지점</p><p className="text-sm font-semibold text-slate-700">{formData.branch_name || '-'}</p></div>
                        </>
                      )}
                      <div className="col-span-1 md:col-span-3 h-px bg-slate-50 my-2" />
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">수리 상세 내역</label>
                            {isEditMode ? (
                                <textarea required value={formData.repair_details} onChange={e => setFormData({...formData, repair_details: e.target.value})} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white resize-none" />
                            ) : (
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl min-h-[60px] whitespace-pre-wrap">{formData.repair_details}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">특이사항 (노트)</label>
                            {isEditMode ? (
                                <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white resize-none" />
                            ) : (
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl min-h-[40px] whitespace-pre-wrap">{formData.note || '등록된 메모가 없습니다.'}</p>
                            )}
                        </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-slate-400" /> 사진 및 설명 ({editingItem?.photos.length || 0})
                    </h3>
                    {isEditMode ? (
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
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {editingItem?.photos.map((p, idx) => (
                                <div key={p.photoId} className="group relative aspect-video rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                                    <img src={p.fileUrl} className="w-full h-full object-cover" alt="Service Photo" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-[10px] text-white font-medium line-clamp-2">{p.photoDescription || '설명 없음'}</p>
                                    </div>
                                </div>
                            ))}
                            {editingItem?.photos.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-400">등록된 사진이 없습니다.</p>}
                        </div>
                    )}
                  </div>
              </div>

              {/* Generated Posts Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4">
                    {isEditMode ? '재생성될 게시물' : '생성한 게시물'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {CONTENT_CHANNELS.map(ch => {
                      const task = editingItem?.createdTasks?.find(t => t.contentFormat.toLowerCase() === ch.format);
                      const Icon = ch.icon;
                      const isCompleted = task?.status === 'completed';
                      const isProcessing = task?.status === 'pending' || task?.status === 'in_progress';
                      const isFailed = task?.status === 'failed';
                      const isNotCreated = !task;

                      return (
                        <div 
                          key={ch.id} 
                          className={`flex flex-col p-4 rounded-2xl border transition-all ${
                            isEditMode ? 
                                (snapshot ? 
                                    (isNotCreated ? 'bg-slate-50 opacity-40 border-slate-100' : 'bg-blue-50/30 border-blue-100 ring-1 ring-blue-100') :
                                    (selectedChannels.includes(ch.id) ? 'bg-blue-50/30 border-blue-100 ring-1 ring-blue-100' : 'bg-slate-50 border-slate-200 opacity-60')
                                ) :
                                isCompleted ? 'bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/50' : 
                                isProcessing ? 'bg-amber-50/30 border-amber-100 animate-pulse' :
                                isFailed ? 'bg-rose-50/30 border-rose-100 hover:bg-rose-50/50' :
                                'bg-slate-50 border-slate-100 hover:bg-slate-100/50'
                          }`}
                          onClick={() => {
                            if (isEditMode && !snapshot) {
                                setSelectedChannels(prev => prev.includes(ch.id) ? prev.filter(c => c !== ch.id) : [...prev, ch.id]);
                            }
                          }}
                        >
                          {/* Card Content (same as Sales) */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-50">
                                <Icon className="w-5 h-5" />
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isCompleted ? 'text-emerald-600 bg-emerald-100' :
                                isProcessing ? 'text-amber-600 bg-amber-100' :
                                isFailed ? 'text-rose-600 bg-rose-100' :
                                'text-slate-400 bg-slate-200'
                            }`}>
                                {isCompleted ? '생성 완료' : isProcessing ? '생성 중' : isFailed ? '실패' : '아직 없음'}
                            </span>
                          </div>
                          
                          <div className="flex-1">
                            <span className="text-sm font-bold text-slate-700 block mb-1">{ch.label}</span>
                            {isEditMode && snapshot && !isNotCreated && <p className="text-[10px] text-blue-500 font-bold">내용 수정 시 자동 재생성</p>}
                          </div>

                          <div className="mt-4">
                            {!isEditMode && (
                                <>
                                    {isCompleted && (
                                        <button onClick={(e) => handleNavigateToResult(e, task.taskId, task.articleId)} className="w-full py-2 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-1.5 transition-all">
                                            <Search className="w-3.5 h-3.5" /> 결과 보기
                                        </button>
                                    )}
                                    {isNotCreated && (
                                        <button onClick={() => handleCreateSinglePost(ch.format)} disabled={isSubmitting} className="w-full py-2 bg-[#3721ED] hover:bg-[#2c1ac0] text-white text-xs font-bold rounded-xl shadow-sm transition-all">
                                            만들기
                                        </button>
                                    )}
                                </>
                            )}
                            {isEditMode && !snapshot && (
                                <div className="flex justify-end">
                                    {selectedChannels.includes(ch.id) ? <CheckSquare className="w-5 h-5 text-[#3721ED]" /> : <Square className="w-5 h-5 text-slate-300" />}
                                </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="shrink-0 p-4 border-t border-slate-200 bg-white flex items-center justify-between">
                <div>
                   {isViewMode && editingItem && (
                     <button type="button" onClick={handleDelete} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors">
                       삭제
                     </button>
                   )}
                </div>
                <div className="flex gap-2">
                   {isViewMode ? (
                     <button type="button" onClick={enterEditMode} className="px-6 py-2.5 text-sm font-bold text-white bg-[#3721ED] hover:bg-[#2c1ac0] rounded-xl transition-colors shadow-sm flex items-center gap-2">
                       내용 수정 후 재생성
                     </button>
                   ) : (
                     <>
                       <button type="button" onClick={handleCancelEdit} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">취소</button>
                       <button 
                         onClick={handleSubmit}
                         disabled={isSubmitting || (snapshot && !checkIsBaseDataChanged()) || (!snapshot && selectedChannels.length === 0)} 
                         className="px-6 py-2.5 text-sm font-bold text-white bg-[#3721ED] hover:bg-[#2c1ac0] rounded-xl transition-colors shadow-sm disabled:opacity-50"
                       >
                         {isSubmitting ? '처리 중...' : snapshot ? '재생성 및 반영' : '등록 및 생성'}
                       </button>
                     </>
                   )}
                </div>
            </div>
          </div>
        </ModalLayout>
      </div>
    </div>
  );
}
