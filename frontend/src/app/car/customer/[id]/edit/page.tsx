"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { apiFetch } from "@/utils/api";
import { isAuthenticated } from "@/utils/jwt";

type CustomerInput = {
  group: string;
  company: string;
  department: string;
  name: string;
  phone: string;
  email: string;
  memo: string;
};

function FormField({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-4">
      <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function CustomerEditPage() {
  const t = useTranslations('customer.edit');
  const tAuth = useTranslations('auth');
  const tCar = useTranslations('car');
  const tCommon = useTranslations('common');
  const tCustomer = useTranslations('customer');

  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [form, setForm] = useState<CustomerInput>({
    group: "",
    company: "",
    department: "",
    name: "",
    phone: "",
    email: "",
    memo: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ [k: string]: string }>({});

  useEffect(() => {
    if (!id) return;

    // 로그인 상태 확인
    if (!isAuthenticated()) {
      setError(tAuth('loginRequired'));
      return;
    }

    // ID가 숫자가 아닌 경우 고객 목록으로 리다이렉트
    if (Array.isArray(id) || !/^\d+$/.test(id as string)) {
      router.push('/car/customer');
      return;
    }

    setLoading(true);
    apiFetch(`/api/customer/${id}`)
      .then((data) => setForm({
        group: data.group || "",
        company: data.company || "",
        department: data.department || "",
        name: data.name || "",
        phone: data.phone || "",
        email: data.email || "",
        memo: data.memo || "",
      }))
      .catch((err) => setError(err.message || t('loadFailed')))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const err: { [k: string]: string } = {};
    if (!form.group) err.group = t('validation.groupRequired');
    if (!form.department) err.department = t('validation.departmentRequired');
    if (!form.name) err.name = t('validation.nameRequired');
    return err;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validate();
    setFieldError(err);
    if (Object.keys(err).length > 0) return;
    setSaving(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/customer/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(t('updateFailed'));
      router.back();
    } catch (e: any) {
      setError(e.message || t('updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  // 권한 체크: 로그인되지 않은 경우 (로딩보다 우선)
  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-[#111113] text-white p-8">
        <div className="text-center">
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
    );
  }

  if (loading) return <div className="p-8 bg-[#111113] min-h-screen text-white text-center">{tCommon('loading')}</div>;
  if (error) return <div className="p-8 bg-[#111113] min-h-screen text-red-500 text-center">{tCommon('error')}: {error}</div>;

  return (
    <div className="p-8 bg-[#111113] min-h-screen text-white">
      <div className="max-w-2xl mx-auto bg-[#111113] rounded-lg border border-zinc-800/60 p-8">
        <h2 className="text-lg font-semibold text-zinc-100 mb-6">{t('title')}</h2>

        <form onSubmit={handleSubmit}>
          <FormField label={tCustomer('detail.fields.group')} required>
            <input
              name="group"
              value={form.group}
              onChange={handleChange}
              className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-2 focus:outline-none focus:border-[#111167] ${fieldError.group ? 'border-red-500' : ''}`}
              required
              autoFocus
            />
            {fieldError.group && <div className="text-red-500 text-xs mt-1">{fieldError.group}</div>}
          </FormField>

          <FormField label={tCustomer('detail.fields.company')}>
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-2 focus:outline-none focus:border-[#111167]"
            />
          </FormField>

          <FormField label={tCustomer('detail.fields.department')} required>
            <select
              name="department"
              value={form.department}
              onChange={handleChange}
              className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-2 focus:outline-none focus:border-[#111167] ${fieldError.department ? 'border-red-500' : ''}`}
              required
            >
              <option value="">{t('departmentSelect')}</option>
              <option value="Purchasing">{t('departments.purchasing')}</option>
              <option value="Engineering">{t('departments.engineering')}</option>
              <option value="Quality">{t('departments.quality')}</option>
              <option value="Production">{t('departments.production')}</option>
              <option value="Developing">{t('departments.developing')}</option>
              <option value="ETC">{t('departments.etc')}</option>
            </select>
            {fieldError.department && <div className="text-red-500 text-xs mt-1">{fieldError.department}</div>}
          </FormField>

          <FormField label={tCustomer('detail.fields.name')} required>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-2 focus:outline-none focus:border-[#111167] ${fieldError.name ? 'border-red-500' : ''}`}
              required
            />
            {fieldError.name && <div className="text-red-500 text-xs mt-1">{fieldError.name}</div>}
          </FormField>

          <FormField label={tCustomer('detail.fields.phone')}>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-2 focus:outline-none focus:border-[#111167]"
            />
          </FormField>

          <FormField label={tCustomer('detail.fields.email')}>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-2 focus:outline-none focus:border-[#111167]"
              placeholder={t('emailPlaceholder')}
            />
          </FormField>

          <FormField label={tCustomer('detail.fields.memo')}>
            <textarea
              name="memo"
              value={form.memo}
              onChange={handleChange}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 px-3 py-2 focus:outline-none focus:border-[#111167] min-h-[100px] resize-y"
            />
          </FormField>

          {error && <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-red-400/90 text-[13px] mb-4">{error}</div>}

          <div className="flex gap-2 mt-8 justify-end">
            <button
              type="button"
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium transition"
              onClick={() => router.back()}
              disabled={saving}
              data-testid="customer-edit-cancel-btn"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium disabled:opacity-50 transition"
              disabled={saving || Object.keys(fieldError).length > 0}
            >
              {saving ? t('updating') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}