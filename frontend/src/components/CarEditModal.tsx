"use client";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/utils/api";
import { isAuthenticated } from "@/utils/jwt";
import { sortContactsByName } from "@/utils/sort";
import RiskCheckbox from "@/components/RiskCheckbox";
import InternalContactSelector, { type InternalContact } from "@/components/InternalContactSelector";

interface CustomerContact {
  id: number;
  name: string;
  group: string;
  department: string;
  phone: string;
  memo?: string;
  email?: string;
  company?: string;
  [key: string]: unknown;
}

type CarInput = {
  corporation: string;
  customerContactIds: string[];
  eventType: "ONE_TIME" | "CONTINUOUS";
  issueDate: string;
  importance: number | "";
  receptionChannel?: string;
  dueDate?: string;
  mainCategory?: string;
  internalContact?: string;
  openIssue?: string;
  followUpPlan?: string;
  completionDate?: string;
  internalScore?: number | "";
  customerScore?: number | "";
  subjectiveScore?: number | "";
  riskMitigation?: boolean;
  riskDescription?: string;
  riskLevel?: string;
};

interface CarEditModalProps {
  carId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col mb-2">
      <span className="text-[13px] font-medium text-zinc-400 mb-1.5 block">{label}</span>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[14px] font-semibold text-zinc-200 mb-3 mt-6">{children}</div>;
}

function formatDateForInput(dateValue: unknown): string {
  if (!dateValue) return '';
  if (typeof dateValue === 'bigint') dateValue = Number(dateValue);
  if (typeof dateValue === 'string' && /^\d+$/.test(dateValue as string)) dateValue = Number(dateValue);
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue as string)) return (dateValue as string).slice(0, 10);
  if (typeof dateValue === 'number') {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }
  return '';
}

export default function CarEditModal({ carId, isOpen, onClose, onSaved }: CarEditModalProps) {
  const t = useTranslations('car');

  const [form, setForm] = useState<CarInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ [k: string]: string }>({});
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([]);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    group: "", company: "", department: "", name: "", contact: "", email: "", memo: "", newGroup: "", newCompany: "",
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [internalContacts, setInternalContacts] = useState<InternalContact[]>([]);

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen || !carId) {
      setForm(null);
      setError(null);
      setLoading(true);
      return;
    }
    if (!isAuthenticated()) {
      setError(t('loginRequired'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Load customer contacts and CAR data in parallel
    Promise.all([
      apiFetch("/api/customer").catch(() => []),
      apiFetch(`/api/car/${carId}`),
    ])
      .then(([contacts, data]) => {
        setCustomerContacts(contacts);

        const toNum = (v: unknown): number | "" => {
          if (v === null || v === undefined || v === "") return "";
          const n = Number(v);
          return isNaN(n) ? "" : n;
        };

        setForm({
          corporation: (data.corporation as string) || "",
          customerContactIds: ((data.customerContacts as { id: number }[] | undefined) || []).map((c: { id: number }) => String(c.id)),
          eventType: (data.eventType as "ONE_TIME" | "CONTINUOUS") || "ONE_TIME",
          issueDate: formatDateForInput(data.issueDate),
          importance: toNum(data.importance),
          receptionChannel: (data.receptionChannel as string) || "",
          dueDate: formatDateForInput(data.dueDate),
          mainCategory: (data.mainCategory as string) || "",
          internalContact: (data.internalContact as string) || "",
          openIssue: (data.openIssue as string) || "",
          followUpPlan: (data.followUpPlan as string) || "",
          completionDate: formatDateForInput(data.completionDate),
          internalScore: toNum(data.internalScore),
          customerScore: toNum(data.customerScore),
          subjectiveScore: toNum(data.subjectiveScore),
          riskMitigation: data.riskMitigation as boolean || false,
          riskDescription: (data.riskDescription as string) || "",
          riskLevel: (data.riskLevel as string) || "MEDIUM",
        });

        // Load internal contacts
        const contactUsers = (data.internalContactUsers as { id: number; name: string; department: string; email: string }[] | undefined) || [];
        const loadedContacts: InternalContact[] = contactUsers.map((u: { id: number; name: string; department: string }) => ({
          type: "user" as const,
          userId: u.id,
          name: u.name,
          department: u.department,
        }));
        const mappedNames = new Set(contactUsers.map((u: { name: string }) => u.name));
        const textContact = (data.internalContact as string) || "";
        if (textContact) {
          textContact.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean).filter((n: string) => !mappedNames.has(n)).forEach((name: string) => {
            loadedContacts.push({ type: "manual", name });
          });
        }
        setInternalContacts(loadedContacts);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [carId, isOpen, t]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const groupOptions = Array.from(new Set(customerContacts.map(c => c.group).filter(Boolean)));
  const companyOptions = Array.from(new Set(customerContacts.map(c => c.company).filter(Boolean)));
  const departmentOptions = ["Purchasing", "Engineering", "Quality", "Production", "Developing", "ETC"];
  const selectedContacts = customerContacts.filter(c => form?.customerContactIds.includes(String(c.id)));

  const handleAddCustomer = async () => {
    const groupValue = newCustomer.group === "__new" ? newCustomer.newGroup : newCustomer.group;
    const companyValue = newCustomer.company === "__new" ? newCustomer.newCompany : newCustomer.company;
    const missing: string[] = [];
    if (!groupValue) missing.push("group");
    if (!newCustomer.department) missing.push("department");
    if (!newCustomer.name) missing.push("name");
    if (missing.length > 0) { setMissingFields(missing); setAddError(null); return; }
    setMissingFields([]);
    setAddError(null);
    try {
      const res = await apiFetch("/api/customer", {
        method: "POST",
        body: JSON.stringify({
          group: groupValue, company: companyValue, department: newCustomer.department,
          name: newCustomer.name, phone: newCustomer.contact || "", email: newCustomer.email || "", memo: newCustomer.memo || "",
        }),
        headers: { "Content-Type": "application/json" },
      });
      setCustomerContacts(prev => [...prev, res]);
      setForm(prev => prev ? { ...prev, customerContactIds: [...prev.customerContactIds, String(res.id)] } : prev);
      setIsAddCustomerOpen(false);
      setNewCustomer({ group: "", company: "", department: "", name: "", contact: "", email: "", memo: "", newGroup: "", newCompany: "" });
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "등록 실패");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (e.target instanceof HTMLSelectElement && e.target.multiple) {
      const selected = Array.from(e.target.options).filter(o => o.selected).map(o => o.value);
      setForm(prev => prev ? { ...prev, [name]: selected } : prev);
    } else {
      setForm(prev => prev ? { ...prev, [name]: type === "number" ? (value === "" ? "" : Number(value)) : value } : prev);
    }
  };

  const validate = () => {
    const err: { [k: string]: string } = {};
    if (!form?.corporation) err.corporation = t('corporationRequired');
    if (!form?.customerContactIds || form.customerContactIds.length === 0) err.customerContactIds = t('customerContactRequired');
    if (!form?.issueDate) err.issueDate = t('issueDateRequired');
    else if (new Date(form.issueDate) > new Date()) err.issueDate = t('issueDateFutureError');
    if (form?.importance === "" || form?.importance === null) err.importance = t('importanceRequired');
    else if (typeof form?.importance === "number" && (form.importance < 0 || form.importance > 1)) err.importance = t('importanceRangeError');
    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !carId) return;
    setError(null);
    const err = validate();
    setFieldError(err);
    if (Object.keys(err).length > 0) return;
    setSaving(true);
    try {
      const token = sessionStorage.getItem("token");
      const toTimestamp = (v: string | undefined) => v ? new Date(v).getTime() : null;
      const payload = {
        ...form,
        issueDate: toTimestamp(form.issueDate),
        dueDate: toTimestamp(form.dueDate),
        completionDate: toTimestamp(form.completionDate),
        internalScore: form.internalScore !== "" ? Number(form.internalScore) : null,
        customerScore: form.customerScore !== "" ? Number(form.customerScore) : null,
        subjectiveScore: form.subjectiveScore !== "" ? Number(form.subjectiveScore) : null,
        riskMitigation: form.riskMitigation || false,
        riskDescription: form.riskDescription || "",
        riskLevel: form.riskLevel || "MEDIUM",
      };
      const res = await fetch(`/api/car/${carId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify({
          ...payload,
          customerContactIds: form.customerContactIds.map(Number),
          internalContactUserIds: internalContacts.filter(c => c.type === "user").map(c => c.userId),
          internalContact: internalContacts.filter(c => c.type === "manual").map(c => c.name).join(", ") || form.internalContact,
        }),
      });
      if (!res.ok) throw new Error(t('updateFailed'));
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors";
  const inputErrorClass = "w-full px-3 py-2 bg-zinc-900 border border-red-500 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors";
  const dateInputClass = `${inputClass} [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-100`;
  const dateInputErrorClass = `${inputErrorClass} [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-100`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111113] border border-zinc-800/60 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/60">
          <h2 className="text-lg font-semibold text-zinc-100">{t('editTitle')}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading && (
            <div className="text-center py-12">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-3" />
              <div className="text-zinc-500 text-[13px]">{t('loading')}</div>
            </div>
          )}

          {error && !loading && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-red-400 text-[13px]">{error}</div>
            </div>
          )}

          {!loading && form && (
            <form onSubmit={handleSubmit}>
              <FormField label={t('eventTypeLabel')}>
                <select name="eventType" value={form.eventType} onChange={handleChange} className={inputClass}>
                  <option value="ONE_TIME">ONE_TIME</option>
                  <option value="CONTINUOUS">CONTINUOUS</option>
                </select>
              </FormField>

              <FormField label={t('customerContactsLabel')}>
                <div className="relative" ref={dropdownRef}>
                  <div
                    className={`w-full px-3 py-2 bg-zinc-900 border rounded-lg text-[13px] text-zinc-100 min-h-[42px] cursor-pointer transition-colors ${fieldError.customerContactIds ? 'border-red-500' : 'border-zinc-700'}`}
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    {selectedContacts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedContacts.map(contact => (
                          <span key={contact.id} className="bg-[#111167] px-2 py-1 rounded-lg text-xs text-white">
                            {contact.name} ({contact.group}/{contact.department})
                            <button type="button" className="ml-1 text-white hover:text-red-300" onClick={e => {
                              e.stopPropagation();
                              setForm(prev => prev ? { ...prev, customerContactIds: prev.customerContactIds.filter(id => id !== String(contact.id)) } : prev);
                            }}>x</button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-600">{t('customerContactsPlaceholder')}</span>
                    )}
                  </div>
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 w-full bg-[#111113] border border-zinc-800 rounded-lg shadow-2xl mt-1 max-h-60 overflow-y-auto z-10">
                      {sortContactsByName(customerContacts).map(contact => (
                        <div
                          key={contact.id}
                          className={`px-3 py-2 cursor-pointer text-[13px] hover:bg-zinc-800 ${form.customerContactIds.includes(String(contact.id)) ? 'bg-[#111167] text-white' : 'text-zinc-100'}`}
                          onClick={() => {
                            const isSelected = form.customerContactIds.includes(String(contact.id));
                            setForm(prev => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                customerContactIds: isSelected
                                  ? prev.customerContactIds.filter(id => id !== String(contact.id))
                                  : [...prev.customerContactIds, String(contact.id)]
                              };
                            });
                          }}
                        >
                          {contact.name} ({contact.group}/{contact.department})
                        </div>
                      ))}
                      <div className="border-t border-zinc-800">
                        <button type="button" className="w-full px-3 py-2 text-left hover:bg-zinc-800 text-[#111167] text-[13px] font-medium" onClick={() => { setIsAddCustomerOpen(true); setDropdownOpen(false); }}>
                          {t('addNewCustomer')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {fieldError.customerContactIds && <div className="text-red-400 text-[12px] mt-1">{fieldError.customerContactIds}</div>}

                {/* New customer registration sub-modal */}
                {isAddCustomerOpen && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-[#111113] rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-zinc-800/60">
                      <div className="flex items-center justify-between p-6 border-b border-zinc-800/60">
                        <h3 className="text-lg font-semibold text-zinc-100">{t('newCustomerRegistration')}</h3>
                        <button onClick={() => setIsAddCustomerOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="p-6">
                        <div className="space-y-4">
                          <div>
                            <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">{t('group')} *</label>
                            <select className={missingFields.includes('group') ? inputErrorClass : inputClass} value={newCustomer.group} onChange={e => setNewCustomer({ ...newCustomer, group: e.target.value })}>
                              <option value="">{t('selectGroup')}</option>
                              {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                              <option value="__new">{t('new')}</option>
                            </select>
                            {newCustomer.group === "__new" && (
                              <input className={`mt-2 ${missingFields.includes('group') ? inputErrorClass : inputClass}`} placeholder={t('newGroupPlaceholder')} value={newCustomer.newGroup || ""} onChange={e => setNewCustomer({ ...newCustomer, newGroup: e.target.value })} />
                            )}
                          </div>
                          <div>
                            <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">{t('company')}</label>
                            <select className={inputClass} value={newCustomer.company} onChange={e => setNewCustomer({ ...newCustomer, company: e.target.value })}>
                              <option value="">{t('selectCompany')}</option>
                              {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                              <option value="__new">{t('new')}</option>
                            </select>
                            {newCustomer.company === "__new" && (
                              <input className={`mt-2 ${inputClass}`} placeholder={t('newCompanyPlaceholder')} value={newCustomer.newCompany || ""} onChange={e => setNewCustomer({ ...newCustomer, newCompany: e.target.value })} />
                            )}
                          </div>
                          <div>
                            <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">{t('department')} *</label>
                            <select className={missingFields.includes('department') ? inputErrorClass : inputClass} value={newCustomer.department} onChange={e => setNewCustomer({ ...newCustomer, department: e.target.value })}>
                              <option value="">{t('selectDepartment')}</option>
                              {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">{t('name')} *</label>
                            <input className={missingFields.includes('name') ? inputErrorClass : inputClass} placeholder={t('namePlaceholder')} value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">{t('contact')}</label>
                            <input className={inputClass} placeholder={t('contactPlaceholder')} value={newCustomer.contact} onChange={e => setNewCustomer({ ...newCustomer, contact: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">{t('email')}</label>
                            <input type="email" className={inputClass} placeholder={t('emailPlaceholder')} value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">{t('memo')}</label>
                            <textarea className={`${inputClass} min-h-[80px] resize-none`} placeholder={t('memoPlaceholder')} value={newCustomer.memo} onChange={e => setNewCustomer({ ...newCustomer, memo: e.target.value })} />
                          </div>
                        </div>
                        {missingFields.length > 0 && (
                          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="text-red-400 text-[12px]">{t('requiredFieldsError')}</div>
                          </div>
                        )}
                        {addError && (
                          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="text-red-400 text-[12px]">{addError}</div>
                          </div>
                        )}
                        <div className="flex gap-3 justify-end mt-6 pt-6 border-t border-zinc-800/60">
                          <button type="button" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors" onClick={() => setIsAddCustomerOpen(false)}>{t('cancel')}</button>
                          <button type="button" className="bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium px-4 py-2 transition-colors" onClick={handleAddCustomer}>{t('register')}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </FormField>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-4">
                <FormField label={t('corporation')}>
                  <select name="corporation" value={form.corporation} onChange={handleChange} className={fieldError.corporation ? inputErrorClass : inputClass}>
                    <option value="">{t('selectCorporation')}</option>
                    <option value="CMKR">CMKR</option>
                    <option value="CMVN">CMVN</option>
                    <option value="CMSJ">CMSJ</option>
                    <option value="CMMX">CMMX</option>
                    <option value="CMMPL">CMMPL</option>
                    <option value="CMCZ">CMCZ</option>
                    <option value="SSNA">SSNA</option>
                  </select>
                  {fieldError.corporation && <div className="text-red-400 text-[12px] mt-1">{fieldError.corporation}</div>}
                </FormField>
                <FormField label={t('issueDate')}>
                  <input name="issueDate" type="date" value={form.issueDate} onChange={handleChange} className={fieldError.issueDate ? dateInputErrorClass : dateInputClass} />
                  {fieldError.issueDate && <div className="text-red-400 text-[12px] mt-1">{fieldError.issueDate}</div>}
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
                <FormField label={t('dueDate')}>
                  <input name="dueDate" type="date" value={form.dueDate || ""} onChange={handleChange} className={dateInputClass} />
                </FormField>
                <FormField label={t('mainCategory')}>
                  <input name="mainCategory" value={form.mainCategory || ""} onChange={handleChange} className={inputClass} />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
                <FormField label={t('importance')}>
                  <input name="importance" type="number" value={form.importance} onChange={handleChange} className={fieldError.importance ? inputErrorClass : inputClass} min={0} max={1} step={0.1} placeholder="0.0 ~ 1.0" />
                  {fieldError.importance && <div className="text-red-400 text-[12px] mt-1">{fieldError.importance}</div>}
                </FormField>
                <FormField label={t('receptionChannel')}>
                  <input name="receptionChannel" value={form.receptionChannel || ""} onChange={handleChange} placeholder={t('receptionChannelPlaceholder')} className={inputClass} />
                </FormField>
              </div>

              <FormField label={t('internalContact')}>
                <InternalContactSelector selectedContacts={internalContacts} onChange={setInternalContacts} placeholder={t('internalContactPlaceholder')} />
              </FormField>

              <SectionTitle>{t('openIssues')}</SectionTitle>
              <textarea name="openIssue" value={form.openIssue || ""} onChange={handleChange} className={`${inputClass} min-h-[40px] resize-none`} />

              <SectionTitle>{t('followUpActions')}</SectionTitle>
              <textarea name="followUpPlan" value={form.followUpPlan || ""} onChange={handleChange} className={`${inputClass} min-h-[40px] resize-none`} />

              <SectionTitle>{t('completionDate')}</SectionTitle>
              <input name="completionDate" type="date" value={form.completionDate || ""} onChange={handleChange} className={dateInputClass} />

              {form.eventType === "CONTINUOUS" ? (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <FormField label={t('internalScore')}>
                    <input name="internalScore" type="number" value={form.internalScore ?? ""} onChange={handleChange} className={inputClass} min={-5} max={5} step={1} placeholder="-5 ~ 5" />
                  </FormField>
                  <FormField label={t('customerScore')}>
                    <input name="customerScore" type="number" value={form.customerScore ?? ""} onChange={handleChange} className={inputClass} min={-5} max={5} step={1} placeholder="-5 ~ 5" />
                  </FormField>
                </div>
              ) : form.eventType === "ONE_TIME" ? (
                <div className="grid grid-cols-1 gap-4 mt-6 max-w-xs">
                  <FormField label={t('subjectiveScoreLabel')}>
                    <input name="subjectiveScore" type="number" value={form.subjectiveScore ?? ""} onChange={handleChange} className={inputClass} min={-30} max={30} step={1} placeholder="-30 ~ 30" />
                  </FormField>
                </div>
              ) : null}

              <RiskCheckbox
                riskMitigation={form.riskMitigation || false}
                riskDescription={form.riskDescription || ""}
                riskLevel={form.riskLevel || "MEDIUM"}
                onRiskMitigationChange={value => setForm(prev => prev ? { ...prev, riskMitigation: value } : prev)}
                onRiskDescriptionChange={value => setForm(prev => prev ? { ...prev, riskDescription: value } : prev)}
                onRiskLevelChange={value => setForm(prev => prev ? { ...prev, riskLevel: value } : prev)}
                className="mt-6"
              />

              {/* Footer */}
              <div className="flex justify-between mt-8 pt-5 border-t border-zinc-800/60">
                <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-[13px] font-medium text-white bg-[#111167] hover:bg-[#1a1a80] disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors">
                  {saving ? t('updating') : t('update')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
