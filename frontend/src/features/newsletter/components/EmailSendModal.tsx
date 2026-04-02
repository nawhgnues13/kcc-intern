import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Mail, X, Send, Plus, Users, UserCheck, Building2, ChevronDown } from "lucide-react";
import { ModalLayout } from "../../../components/shared/ModalLayout";
import { recipientService, EmailRecipient } from "../../../services/api/recipientService";
import { newsletterService } from "../../../services/api/newsletterService";
import { useAuthStore } from "../../../store/useAuthStore";
import { renderEmailHtml } from "../utils/renderEmailHtml";

interface EmailSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  articleId?: string;
  headerFooter?: string;
  bodyContent?: unknown;
}

// 고정 그룹
type FixedGroupKey = "employees" | "customers" | "my_customers";
// 회사 코드 그룹은 "company:KCC_IT" 형태로 구분
type GroupKey = FixedGroupKey | `company:${string}`;

const COMPANY_LABEL_MAP: Record<string, string> = {
  KCC_IT: "KCC정보통신",
  KCC_AUTOGROUP: "KCC오토그룹",
};

function getGroupLabel(group: GroupKey): string {
  if (group === "employees") return "전체 직원";
  if (group === "customers") return "전체 고객";
  if (group === "my_customers") return "내 고객";
  const code = group.replace("company:", "");
  return COMPANY_LABEL_MAP[code.toUpperCase()] ?? code;
}

function getGroupColor(group: GroupKey): string {
  if (group === "employees") return "bg-blue-100 text-blue-700";
  if (group === "customers") return "bg-emerald-100 text-emerald-700";
  if (group === "my_customers") return "bg-violet-100 text-violet-700";
  return "bg-amber-100 text-amber-700";
}

function GroupIcon({ group, className }: { group: GroupKey; className?: string }) {
  if (group === "employees") return <Users className={className} />;
  if (group === "customers" || group === "my_customers") return <UserCheck className={className} />;
  return <Building2 className={className} />;
}

export function EmailSendModal({ isOpen, onClose, title, articleId, headerFooter, bodyContent }: EmailSendModalProps) {
  const user = useAuthStore((s) => s.user);

  const [subject, setSubject] = useState(title);
  const [groupRecipients, setGroupRecipients] = useState<Map<GroupKey, EmailRecipient[]>>(new Map());
  const [loadingGroup, setLoadingGroup] = useState<GroupKey | null>(null);
  const [companyCodes, setCompanyCodes] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showEmployeeSubmenu, setShowEmployeeSubmenu] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sentCount: number; totalCount: number; skippedEmails: string[] } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [manualEmailInput, setManualEmailInput] = useState("");
  const [manualRecipients, setManualRecipients] = useState<EmailRecipient[]>([]);
  const [manualInputError, setManualInputError] = useState<string | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSubject(title);
      setGroupRecipients(new Map());
      setManualRecipients([]);
      setManualEmailInput("");
      setManualInputError(null);
      setSendResult(null);
      setSendError(null);
      setShowPicker(false);
      setShowEmployeeSubmenu(false);
      recipientService.getCompanyCodes().then(setCompanyCodes).catch(() => {});
    }
  }, [isOpen, title]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addedGroups = Array.from(groupRecipients.keys());

  const allRecipients: EmailRecipient[] = (() => {
    const seen = new Set<string>();
    const result: EmailRecipient[] = [];
    for (const list of groupRecipients.values()) {
      for (const r of list) {
        const key = r.email.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(r);
        }
      }
    }
    for (const r of manualRecipients) {
      const key = r.email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(r);
      }
    }
    return result;
  })();

  const allEmployeeAdded = groupRecipients.has("employees");
  const availableCompanyCodes = companyCodes.filter((c) => !groupRecipients.has(`company:${c}` as GroupKey));
  const showEmployeesMenu = !allEmployeeAdded || availableCompanyCodes.length > 0;
  const showCustomers = !groupRecipients.has("customers");
  const showMyCustomers = !!user && !groupRecipients.has("my_customers");
  const hasAnyAvailable = showEmployeesMenu || showCustomers || showMyCustomers;

  const handleAddGroup = async (group: GroupKey) => {
    setShowPicker(false);
    setLoadingGroup(group);
    try {
      let recipients: EmailRecipient[];
      if (group === "employees") {
        recipients = await recipientService.getEmployeeRecipients();
      } else if (group === "customers") {
        recipients = await recipientService.getCustomerRecipients();
      } else if (group === "my_customers") {
        recipients = await recipientService.getCustomerRecipients(user!.email);
      } else {
        const code = group.replace("company:", "");
        recipients = await recipientService.getEmployeeRecipients(code);
      }
      setGroupRecipients((prev) => new Map(prev).set(group, recipients));
    } catch {
      // 에러 시 조용히 무시
    } finally {
      setLoadingGroup(null);
    }
  };

  const handleRemoveGroup = (group: GroupKey) => {
    setGroupRecipients((prev) => {
      const next = new Map(prev);
      next.delete(group);
      return next;
    });
  };

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleAddManualEmail = () => {
    const email = manualEmailInput.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      setManualInputError("올바른 이메일 형식이 아닙니다.");
      return;
    }
    const alreadyAdded = allRecipients.some((r) => r.email.toLowerCase() === email.toLowerCase());
    if (alreadyAdded) {
      setManualInputError("이미 추가된 이메일입니다.");
      return;
    }
    setManualRecipients((prev) => [...prev, { name: "", email }]);
    setManualEmailInput("");
    setManualInputError(null);
    manualInputRef.current?.focus();
  };

  const handleManualKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddManualEmail();
    }
  };

  const handleRemoveManualRecipient = (email: string) => {
    setManualRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  const handleSend = async () => {
    if (!articleId || allRecipients.length === 0 || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      let html: string | undefined;
      if (headerFooter && bodyContent) {
        html = renderEmailHtml(headerFooter, bodyContent, subject || title);
      }
      const result = await newsletterService.sendNewsletter(articleId, allRecipients, subject || undefined, html);
      setSendResult({ sentCount: result.sentCount, totalCount: result.totalCount, skippedEmails: result.skippedEmails ?? [] });
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSendError(detail || "이메일 발송 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ModalLayout isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#3721ED]" />
          이메일 전송하기
        </h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {sendResult ? (
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <Send className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">발송 완료</p>
            <p className="text-sm text-slate-500 mt-1">
              {sendResult.totalCount}명 중 {sendResult.sentCount}명에게 이메일을 발송했습니다.
            </p>
            {sendResult.skippedEmails.length > 0 && (
              <div className="mt-3 text-left bg-amber-50 border border-amber-200/50 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">수신거부로 제외된 이메일</p>
                {sendResult.skippedEmails.map((email) => (
                  <p key={email} className="text-xs text-amber-600">{email}</p>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 bg-[#3721ED] text-white font-medium rounded-xl hover:bg-[#2c1ac0] transition-colors text-sm"
          >
            닫기
          </button>
        </div>
      ) : (
        <>
          <div className="p-6 space-y-5">
            {/* 받는 사람 */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">받는 사람</label>
              <div
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-2 cursor-text"
                onClick={() => manualInputRef.current?.focus()}
              >
                {/* 그룹 칩 */}
                {addedGroups.map((group) => (
                  <span
                    key={group}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getGroupColor(group)}`}
                  >
                    <GroupIcon group={group} className="w-3 h-3" />
                    {getGroupLabel(group)}
                    <span className="opacity-60">({groupRecipients.get(group)?.length ?? 0}명)</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveGroup(group); }}
                      className="ml-0.5 hover:opacity-70 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                {/* 수동 입력 이메일 칩 */}
                {manualRecipients.map((r) => (
                  <span
                    key={r.email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-pink-100 text-pink-700"
                  >
                    {r.email}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveManualRecipient(r.email); }}
                      className="ml-0.5 hover:opacity-70 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                {loadingGroup && (
                  <span className="text-xs text-slate-400 animate-pulse">불러오는 중...</span>
                )}

                {/* 인라인 이메일 직접 입력 */}
                <input
                  ref={manualInputRef}
                  type="email"
                  value={manualEmailInput}
                  onChange={(e) => { setManualEmailInput(e.target.value); setManualInputError(null); }}
                  onKeyDown={handleManualKeyDown}
                  placeholder={addedGroups.length === 0 && manualRecipients.length === 0 ? "이메일 입력 후 Enter, 또는 그룹 추가" : ""}
                  className="flex-1 min-w-[160px] bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 py-0.5"
                />

                {/* 그룹 추가 드롭다운 */}
                {hasAnyAvailable && !loadingGroup && (
                  <div className="relative" ref={pickerRef}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowPicker((v) => !v); setShowEmployeeSubmenu(false); }}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#3721ED] transition-colors px-1.5 py-1 rounded-lg hover:bg-[#3721ED]/5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      그룹 추가
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showPicker && (
                      <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                        {showEmployeesMenu && (
                          <div className="relative">
                            <button
                              onClick={() => setShowEmployeeSubmenu((v) => !v)}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                            >
                              <span className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-blue-500" />
                                직원
                              </span>
                              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showEmployeeSubmenu ? "rotate-180" : ""}`} />
                            </button>
                            {showEmployeeSubmenu && (
                              <div className="bg-slate-50 border-t border-slate-100">
                                {!allEmployeeAdded && (
                                  <button
                                    onClick={() => handleAddGroup("employees")}
                                    className="w-full text-left pl-8 pr-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
                                  >
                                    <Users className="w-3 h-3 text-blue-400" />
                                    전체 직원
                                  </button>
                                )}
                                {availableCompanyCodes.map((code) => (
                                  <button
                                    key={code}
                                    onClick={() => handleAddGroup(`company:${code}` as GroupKey)}
                                    className="w-full text-left pl-8 pr-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
                                  >
                                    <Building2 className="w-3 h-3 text-amber-500" />
                                    {COMPANY_LABEL_MAP[code.toUpperCase()] ?? code}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {showCustomers && (
                          <button
                            onClick={() => handleAddGroup("customers")}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                            전체 고객
                          </button>
                        )}
                        {showMyCustomers && (
                          <button
                            onClick={() => handleAddGroup("my_customers")}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-violet-500" />
                            내 고객
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {manualInputError && (
                <p className="text-xs text-rose-500 mt-1.5">{manualInputError}</p>
              )}
              {allRecipients.length > 0 && (
                <p className="text-xs text-slate-400 mt-1.5">총 {allRecipients.length}명 (중복 제거)</p>
              )}
            </div>

            {/* 제목 */}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">제목</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3721ED]/50 focus:border-[#3721ED] transition-all text-slate-700 text-sm"
              />
            </div>

            {/* 안내 / 에러 */}
            {sendError ? (
              <div className="bg-rose-50 border border-rose-200/50 rounded-xl p-4 text-sm text-rose-700">
                {sendError}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
                선택된 모든 수신자에게 이메일로 발송합니다. 발송 전 AI로 생성된 내용을 모두 확인하셨나요?
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200/50 rounded-xl transition-colors text-sm"
            >
              취소
            </button>
            <button
              onClick={handleSend}
              disabled={allRecipients.length === 0 || !articleId || isSending}
              className="px-6 py-2.5 bg-[#3721ED] text-white font-medium rounded-xl hover:bg-[#2c1ac0] transition-colors shadow-md shadow-[#3721ED]/25 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {isSending ? "발송 중..." : `발송하기${allRecipients.length > 0 ? ` (${allRecipients.length}명)` : ""}`}
            </button>
          </div>
        </>
      )}
    </ModalLayout>
  );
}
