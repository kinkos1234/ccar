"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { isAuthenticated } from "@/utils/jwt";
import { apiFetch } from "@/utils/api";

type CustomerInput = {
  group: string;
  company: string;
  department: string;
  name: string;
  phone: string;
  email: string;
  memo: string;
  newGroup: string;
  newCompany: string;
};

export default function CustomerNewPage() {
  const t = useTranslations('customer.create');
  const tAuth = useTranslations('auth');
  const tCar = useTranslations('car');

  const router = useRouter();
  const [form, setForm] = useState<CustomerInput>({
    group: "",
    company: "",
    department: "",
    name: "",
    phone: "",
    email: "",
    memo: "",
    newGroup: "",
    newCompany: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ [k: string]: string }>({});
  const [customerContacts, setCustomerContacts] = useState<any[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 인증 상태 확인
    const checkAuth = () => {
      const authStatus = isAuthenticated();
      setAuthenticated(authStatus);
      setIsAuthChecked(true);

      // 기존 고객 데이터 로드
      if (authStatus) {
        apiFetch("/api/customer").then(setCustomerContacts).catch(() => setCustomerContacts([]));
      }
    };

    checkAuth();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 고객 담당자 관련 옵션들
  const groupOptions = Array.from(new Set(customerContacts.map(c => c.group).filter(Boolean)));
  const companyOptions = Array.from(new Set(customerContacts.map(c => c.company).filter(Boolean)));
  const departmentOptions = ["Purchasing", "Engineering", "Quality", "Sales", "Finance", "HR", "IT"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMissingFields([]);

    const missing = [];
    if (!form.group && !form.newGroup) missing.push('group');
    if (!form.department) missing.push('department');
    if (!form.name) missing.push('name');
    if (!form.phone) missing.push('phone');

    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    setLoading(true);
    try {
      const finalGroup = form.group === "__new" ? form.newGroup : form.group;
      const finalCompany = form.company === "__new" ? form.newCompany : form.company;

      const customerData = {
        group: finalGroup,
        company: finalCompany || "",
        department: form.department,
        name: form.name,
        phone: form.phone,
        email: form.email || "",
        memo: form.memo || "",
      };

      const token = sessionStorage.getItem("token");
      const res = await fetch("/api/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(customerData),
      });
      if (!res.ok) throw new Error(t('registerFailed'));
      router.back();
    } catch (e: any) {
      setError(e.message || t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 인증 상태 확인 중
  if (!isAuthChecked) {
    return (
      <div className="p-6 bg-[#111113] min-h-screen text-white">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-zinc-400">{t('loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  // 인증되지 않은 경우
  if (!authenticated) {
    return (
      <div className="p-6 bg-[#111113] min-h-screen text-white">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-red-400 text-lg mb-2">{tCar('accessDenied')}</div>
            <div className="text-zinc-400 mb-4">{tAuth('loginRequired')}</div>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
            >
              {tCar('goToLogin')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#111113] min-h-screen text-white">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.back()}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-zinc-100">{t('title')}</h1>
          </div>
          <p className="text-zinc-500">{t('subtitle')}</p>
        </div>

        {/* 폼 카드 */}
        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 transition-all duration-300 ease-in-out">
          {/* 카드 헤더 */}
          <div className="p-6 border-b border-zinc-800/60">
            <h2 className="text-[14px] font-semibold text-zinc-200">{t('formTitle')}</h2>
            <p className="text-[13px] text-zinc-500 mt-1">{t('formSubtitle')}</p>
          </div>

          {/* 폼 컨텐츠 */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 그룹 드롭다운 + 신규 입력 */}
              <div>
                <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                  {t('labels.group')} <span className="text-red-400">*</span>
                </label>
                <select
                  name="group"
                  value={form.group}
                  onChange={handleChange}
                  className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('group') ? 'border-red-500 focus:border-red-500' : ''}`}
                  required
                >
                  <option value="">{t('groupSelect')}</option>
                  {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="__new">{t('newOption')}</option>
                </select>
                {form.group === "__new" && (
                  <input
                    name="newGroup"
                    value={form.newGroup}
                    onChange={handleChange}
                    className={`w-full mt-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('group') ? 'border-red-500 focus:border-red-500' : ''}`}
                    placeholder={t('placeholders.newGroup')}
                  />
                )}
              </div>

              {/* 회사 드롭다운 + 신규 입력 (비필수) */}
              <div>
                <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">{t('labels.company')}</label>
                <select
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors"
                >
                  <option value="">{t('companySelect')}</option>
                  {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new">{t('newOption')}</option>
                </select>
                {form.company === "__new" && (
                  <input
                    name="newCompany"
                    value={form.newCompany}
                    onChange={handleChange}
                    className="w-full mt-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors"
                    placeholder={t('placeholders.newCompany')}
                  />
                )}
              </div>

              {/* 부서 드롭다운 (고정 옵션) */}
              <div>
                <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                  {t('labels.department')} <span className="text-red-400">*</span>
                </label>
                <select
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('department') ? 'border-red-500 focus:border-red-500' : ''}`}
                  required
                >
                  <option value="">{t('departmentSelect')}</option>
                  {departmentOptions.map(d => <option key={d} value={d}>{t(`departments.${d.toLowerCase()}`)}</option>)}
                </select>
              </div>

              {/* 이름 */}
              <div>
                <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                  {t('labels.name')} <span className="text-red-400">*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('name') ? 'border-red-500 focus:border-red-500' : ''}`}
                  placeholder={t('placeholders.name')}
                  required
                />
              </div>

              {/* 연락처 (필수) */}
              <div>
                <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                  {t('labels.phone')} <span className="text-red-400">*</span>
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors ${missingFields.includes('phone') ? 'border-red-500 focus:border-red-500' : ''}`}
                  placeholder={t('placeholders.phoneRequired')}
                  required
                />
              </div>

              {/* 이메일 (비필수) */}
              <div>
                <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">{t('labels.email')}</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors"
                  placeholder={t('placeholders.email')}
                />
              </div>

              {/* 메모 (비필수) - 전체 너비 */}
              <div className="lg:col-span-2">
                <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">{t('labels.memo')}</label>
                <textarea
                  name="memo"
                  value={form.memo}
                  onChange={handleChange}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-3 focus:outline-none focus:border-[#111167] transition-colors resize-none"
                  placeholder={t('placeholders.memo')}
                  rows={4}
                />
              </div>
            </div>

            {/* 오류 메시지 */}
            {missingFields.length > 0 && (
              <div className="mt-6 bg-red-950/30 border border-red-900/40 rounded-lg p-3">
                <div className="text-red-400/90 text-[13px] font-medium">{t('requiredFieldsMessage')}</div>
              </div>
            )}
            {error && (
              <div className="mt-6 bg-red-950/30 border border-red-900/40 rounded-lg p-3">
                <div className="text-red-400/90 text-[13px] font-medium">{error}</div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-zinc-800/60">
              <button
                type="button"
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                onClick={() => router.back()}
                disabled={loading}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 min-w-[100px]"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('registering')}
                  </div>
                ) : (
                  t('register')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}