"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { apiFetch } from "@/utils/api";
import { isAuthenticated } from "@/utils/jwt";
import { sortContactsByName } from "@/utils/sort";
import RiskCheckbox from "@/components/RiskCheckbox";
import InternalContactSelector, { type InternalContact } from "@/components/InternalContactSelector";

type CustomerContact = {
  id: number;
  name: string;
  group: string;
  company?: string;
  department: string;
  phone: string;
  memo?: string;
};

type CarInput = {
  eventType: "ONE_TIME" | "CONTINUOUS";
  corporation: string;
  customerContactIds: string[];
  issueDate: string;
  internalContact: string;
  receptionChannel?: string;
  mainCategory?: string;
  importance: number | "";
  openIssue?: string;
  followUpPlan?: string;
  dueDate?: string;
  completionDate?: string;
  internalScore?: number | "";
  customerScore?: number | "";
  subjectiveScore?: number | "";
  riskMitigation?: boolean;
  riskDescription?: string;
  riskLevel?: string;
};

function FormField({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-4">
      <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[14px] font-semibold text-zinc-200 mb-3 mt-6">{children}</div>;
}

export default function CarNewPage() {
  const t = useTranslations('car');

  const router = useRouter();
  const [form, setForm] = useState<CarInput>({
    eventType: "ONE_TIME",
    corporation: "",
    customerContactIds: [],
    issueDate: new Date().toISOString().slice(0, 10),
    internalContact: "",
    importance: "",
    riskMitigation: false,
    riskDescription: "",
    riskLevel: "MEDIUM",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ [k: string]: string }>({});
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([]);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    group: "",
    company: "",
    department: "",
    name: "",
    contact: "",
    memo: "",
    newGroup: "",
    newCompany: "",
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [internalContacts, setInternalContacts] = useState<InternalContact[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      setError(t('loginRequired'));
      return;
    }

    apiFetch("/api/customer").then(setCustomerContacts).catch(() => setCustomerContacts([]));
  }, [t]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAddCustomer = async () => {
    setMissingFields([]);
    setAddError(null);

    const missing = [];
    if (!newCustomer.group && !newCustomer.newGroup) missing.push('group');
    if (!newCustomer.department) missing.push('department');
    if (!newCustomer.name) missing.push('name');
    if (!newCustomer.contact) missing.push('contact');

    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    try {
      const finalGroup = newCustomer.group === "__new" ? newCustomer.newGroup : newCustomer.group;
      const finalCompany = newCustomer.company === "__new" ? newCustomer.newCompany : newCustomer.company;

      const customerData = {
        group: finalGroup,
        company: finalCompany || "",
        department: newCustomer.department,
        name: newCustomer.name,
        phone: newCustomer.contact || "N/A",
        memo: newCustomer.memo || "",
      };

      const result = await apiFetch("/api/customer", {
        method: "POST",
        body: JSON.stringify(customerData),
      });

      setCustomerContacts(prev => [...prev, result]);
      setForm(prev => ({ ...prev, customerContactIds: [...prev.customerContactIds, String(result.id)] }));
      setNewCustomer({ group: "", company: "", department: "", name: "", contact: "", memo: "", newGroup: "", newCompany: "" });
      setIsAddCustomerOpen(false);
    } catch (e: unknown) {
      setAddError((e as Error).message || t('customerContactAddFailed'));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (e.target instanceof HTMLSelectElement && e.target.multiple) {
      const options = e.target.options;
      const selected = Array.from(options).filter((o) => o.selected).map((o) => o.value);
      setForm((prev) => ({ ...prev, [name]: selected }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: type === "number" ? (value === "" ? "" : Number(value)) : value,
      }));
    }
  };

  const validate = () => {
    const err: { [k: string]: string } = {};
    if (!form.corporation) err.corporation = t('corporationRequired');
    if (!form.customerContactIds || form.customerContactIds.length === 0) err.customerContactIds = t('customerContactRequired');
    if (!form.issueDate) err.issueDate = t('issueDateRequired');
    else if (new Date(form.issueDate) > new Date()) err.issueDate = t('issueDateFutureError');
    if (internalContacts.length === 0 && !form.internalContact) err.internalContact = t('internalContactRequired');
    if (form.importance === "" || form.importance === null) err.importance = t('importanceRequired');
    else if (typeof form.importance === "number" && (form.importance < 0 || form.importance > 1)) err.importance = t('importanceRangeError');
    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validate();
    setFieldError(err);
    if (Object.keys(err).length > 0) {
      setError(t('requiredFieldsNotFilled'));
      return;
    }
    setLoading(true);
    try {
      const userStr = sessionStorage.getItem("user");
      if (!userStr) throw new Error(t('loginInfoMissing'));
      const user = JSON.parse(userStr);
      const token = sessionStorage.getItem("token");

      const toTimestamp = (v: string | undefined) => v ? new Date(v).getTime() : null;

      const res = await fetch("/api/car", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          ...form,
          issueDate: toTimestamp(form.issueDate),
          dueDate: toTimestamp(form.dueDate),
          completionDate: toTimestamp(form.completionDate),
          customerContactIds: form.customerContactIds.map(Number),
          internalContactUserIds: internalContacts.filter(c => c.type === "user").map(c => c.userId),
          internalContact: internalContacts.filter(c => c.type === "manual").map(c => c.name).join(", ") || form.internalContact,
          createdBy: user.id
        }),
      });
      if (!res.ok) throw new Error(t('registrationFailed'));
      router.back();
    } catch (e: unknown) {
      setError((e as Error).message || t('registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const groupOptions = Array.from(new Set(customerContacts.map(c => c.group).filter(Boolean)));
  const companyOptions = Array.from(new Set(customerContacts.map(c => c.company).filter(Boolean)));
  const departmentOptions = ["Purchasing", "Engineering", "Quality", "Sales", "Finance", "HR", "IT"];

  const selectedContacts = customerContacts.filter(c => form.customerContactIds.includes(String(c.id)));

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white p-8">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">{t('accessDenied')}</div>
          <div className="text-zinc-400 mb-4">{t('loginRequired')}</div>
          <button
            onClick={() => router.push('/login')}
            className="bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
          >
            {t('goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-zinc-900 min-h-screen text-white">
      <div className="max-w-4xl mx-auto bg-[#111113] border border-zinc-800/60 rounded-lg shadow p-8">
        <h2 className="text-lg font-semibold text-zinc-100 mb-6">{t('newTitle')}</h2>

        <form onSubmit={handleSubmit}>
          {/* 1. 이벤트 타입 (최상단) */}
          <FormField label={t('eventTypeLabel')} required>
            <select
              name="eventType"
              value={form.eventType}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
              required
            >
              <option value="ONE_TIME">ONE_TIME</option>
              <option value="CONTINUOUS">CONTINUOUS</option>
            </select>
          </FormField>

          <SectionTitle>{t('common')}</SectionTitle>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {/* 법인 */}
            <FormField label={t('corporation')} required>
              <select
                name="corporation"
                value={form.corporation}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${fieldError.corporation ? 'border-red-500' : ''}`}
                required
              >
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

            {/* 발생일 */}
            <FormField label={t('issueDate')} required>
              <div className="relative">
                <input
                  name="issueDate"
                  type="date"
                  value={form.issueDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${fieldError.issueDate ? 'border-red-500' : ''} [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-100`}
                  required
                />
              </div>
              {fieldError.issueDate && <div className="text-red-400 text-[12px] mt-1">{fieldError.issueDate}</div>}
            </FormField>
          </div>

          {/* 고객 담당자 */}
          <FormField label={t('customerContactsLabel')} required>
            <div className="relative" ref={dropdownRef}>
              <div
                className={`w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 min-h-[42px] cursor-pointer ${fieldError.customerContactIds ? 'border-red-500' : ''}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {selectedContacts.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedContacts.map(contact => (
                      <span key={contact.id} className="bg-[#111167] px-2 py-1 rounded-lg text-xs text-white">
                        {contact.name} ({contact.group}/{contact.department})
                        <button
                          type="button"
                          className="ml-1 text-white hover:text-red-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm(prev => ({
                              ...prev,
                              customerContactIds: prev.customerContactIds.filter(id => id !== String(contact.id))
                            }));
                          }}
                        >
                          x
                        </button>
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
                      className={`px-3 py-2 cursor-pointer text-[13px] text-zinc-100 hover:bg-zinc-800 ${form.customerContactIds.includes(String(contact.id)) ? 'bg-[#111167]' : ''}`}
                      onClick={() => {
                        const isSelected = form.customerContactIds.includes(String(contact.id));
                        if (isSelected) {
                          setForm(prev => ({
                            ...prev,
                            customerContactIds: prev.customerContactIds.filter(id => id !== String(contact.id))
                          }));
                        } else {
                          setForm(prev => ({
                            ...prev,
                            customerContactIds: [...prev.customerContactIds, String(contact.id)]
                          }));
                        }
                      }}
                    >
                      {contact.name} ({contact.group}/{contact.department})
                    </div>
                  ))}
                  <div className="border-t border-zinc-800">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-[13px] hover:bg-zinc-800 text-zinc-400"
                      onClick={() => {
                        setIsAddCustomerOpen(true);
                        setDropdownOpen(false);
                      }}
                    >
                      {t('addNewCustomer')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {fieldError.customerContactIds && <div className="text-red-400 text-[12px] mt-1">{fieldError.customerContactIds}</div>}

            {/* 새 고객 담당자 추가 모달 */}
            {isAddCustomerOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-[#111113] border border-zinc-800/60 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-4">{t('newCustomerRegistration')}</h3>

                  {/* 그룹 드롭다운 + 신규 입력 */}
                  <select
                    className={`w-full mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('group') ? 'border-red-500' : ''}`}
                    value={newCustomer.group}
                    onChange={e => setNewCustomer({ ...newCustomer, group: e.target.value })}
                  >
                    <option value="">{t('selectGroup')}</option>
                    {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    <option value="__new">{t('new')}</option>
                  </select>
                  {newCustomer.group === "__new" && (
                    <input
                      className={`w-full mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('group') ? 'border-red-500' : ''}`}
                      placeholder={t('newGroupPlaceholder')}
                      value={newCustomer.newGroup || ""}
                      onChange={e => setNewCustomer({ ...newCustomer, newGroup: e.target.value })}
                    />
                  )}

                  {/* 회사 드롭다운 + 신규 입력 (비필수) */}
                  <select
                    className="w-full mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                    value={newCustomer.company}
                    onChange={e => setNewCustomer({ ...newCustomer, company: e.target.value })}
                  >
                    <option value="">{t('selectCompany')}</option>
                    {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__new">{t('new')}</option>
                  </select>
                  {newCustomer.company === "__new" && (
                    <input
                      className="w-full mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                      placeholder={t('newCompanyPlaceholder')}
                      value={newCustomer.newCompany || ""}
                      onChange={e => setNewCustomer({ ...newCustomer, newCompany: e.target.value })}
                    />
                  )}

                  {/* 부서 드롭다운 (고정 옵션) */}
                  <select
                    className={`w-full mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('department') ? 'border-red-500' : ''}`}
                    value={newCustomer.department}
                    onChange={e => setNewCustomer({ ...newCustomer, department: e.target.value })}
                  >
                    <option value="">{t('selectDepartment')}</option>
                    {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>

                  {/* 이름 */}
                  <input
                    className={`w-full mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('name') ? 'border-red-500' : ''}`}
                    placeholder={t('namePlaceholder')}
                    value={newCustomer.name}
                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />

                  {/* 연락처 (필수) */}
                  <input
                    className={`w-full mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('contact') ? 'border-red-500' : ''}`}
                    placeholder={t('contactPlaceholder')}
                    value={newCustomer.contact}
                    onChange={e => setNewCustomer({ ...newCustomer, contact: e.target.value })}
                  />

                  {/* 메모 (비필수) */}
                  <textarea
                    className="w-full mb-4 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors resize-none min-h-[40px]"
                    placeholder={t('memoPlaceholder')}
                    value={newCustomer.memo}
                    onChange={e => setNewCustomer({ ...newCustomer, memo: e.target.value })}
                  />

                  {missingFields.length > 0 && (
                    <div className="text-red-400 text-[12px] mb-2">{t('requiredFieldsError')}</div>
                  )}
                  {addError && (
                    <div className="text-red-400 text-[12px] mb-2">{addError}</div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button type="button" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2" onClick={() => setIsAddCustomerOpen(false)}>{t('cancel')}</button>
                    <button type="button" className="bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium px-4 py-2" onClick={handleAddCustomer}>{t('register')}</button>
                  </div>
                </div>
              </div>
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {/* 내부 담당자 */}
            <FormField label={t('internalContact')} required>
              <InternalContactSelector
                selectedContacts={internalContacts}
                onChange={setInternalContacts}
                placeholder={t('internalContactPlaceholder')}
                error={fieldError.internalContact}
              />
            </FormField>

            {/* 접수 채널 */}
            <FormField label={t('receptionChannel')}>
              <input
                name="receptionChannel"
                value={form.receptionChannel || ""}
                onChange={handleChange}
                placeholder={t('receptionChannelPlaceholder')}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
              />
            </FormField>

            {/* 주제 */}
            <FormField label={t('mainCategory')}>
              <input
                name="mainCategory"
                value={form.mainCategory || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
              />
            </FormField>

            {/* 중요도 */}
            <FormField label={t('importance')} required>
              <input
                name="importance"
                type="number"
                value={form.importance}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${fieldError.importance ? 'border-red-500' : ''}`}
                required
                min={0}
                max={1}
                step={0.1}
                placeholder="0.0 ~ 1.0"
              />
              {fieldError.importance && <div className="text-red-400 text-[12px] mt-1">{fieldError.importance}</div>}
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-4">
            {/* 기한일 */}
            <FormField label={t('dueDate')}>
              <div className="relative">
                <input
                  name="dueDate"
                  type="date"
                  value={form.dueDate || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-100"
                />
              </div>
            </FormField>

            {/* 완료일 */}
            <FormField label={t('completionDate')}>
              <div className="relative">
                <input
                  name="completionDate"
                  type="date"
                  value={form.completionDate || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:contrast-100"
                />
              </div>
            </FormField>
          </div>

          {/* 오픈 이슈 */}
          <FormField label={t('openIssues')}>
            <textarea
              name="openIssue"
              value={form.openIssue || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors resize-none min-h-[100px]"
              style={{ overflowY: 'auto' }}
            />
          </FormField>

          {/* 후속 업무 */}
          <FormField label={t('followUpActions')}>
            <textarea
              name="followUpPlan"
              value={form.followUpPlan || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors resize-none min-h-[100px]"
              style={{ overflowY: 'auto' }}
            />
          </FormField>

          {/* 분기 항목 */}
          <SectionTitle>{t('scoreInput')}</SectionTitle>

          {form.eventType === "CONTINUOUS" ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <FormField label={t('internalScore')}>
                <input
                  name="internalScore"
                  type="number"
                  value={form.internalScore ?? ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                  min={-5}
                  max={5}
                  step={1}
                  placeholder="-5 ~ 5"
                />
              </FormField>
              <FormField label={t('customerScore')}>
                <input
                  name="customerScore"
                  type="number"
                  value={form.customerScore ?? ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                  min={-5}
                  max={5}
                  step={1}
                  placeholder="-5 ~ 5"
                />
              </FormField>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 max-w-xs">
              <FormField label={t('subjectiveScoreLabel')}>
                <input
                  name="subjectiveScore"
                  type="number"
                  value={form.subjectiveScore ?? ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                  min={-30}
                  max={30}
                  step={1}
                  placeholder="-30 ~ 30"
                />
              </FormField>
            </div>
          )}

          {/* Risk Management Section */}
          <RiskCheckbox
            riskMitigation={form.riskMitigation || false}
            riskDescription={form.riskDescription || ""}
            riskLevel={form.riskLevel || "MEDIUM"}
            onRiskMitigationChange={(value) =>
              setForm(prev => ({ ...prev, riskMitigation: value }))
            }
            onRiskDescriptionChange={(value) =>
              setForm(prev => ({ ...prev, riskDescription: value }))
            }
            onRiskLevelChange={(value) =>
              setForm(prev => ({ ...prev, riskLevel: value }))
            }
            className="mt-6"
          />

          {error && <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-red-400/90 text-[13px] mt-4">{error}</div>}

          <div className="flex gap-2 mt-8 justify-end">
            <button
              type="button"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
              onClick={() => router.back()}
              disabled={loading}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium px-4 py-2 disabled:opacity-50 transition-colors"
              disabled={loading}
            >
              {loading ? t('registering') : t('register')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
