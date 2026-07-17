"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { getCurrentUser, isAuthenticated } from "@/utils/jwt";
import { canEditCustomer, canDeleteCustomer, User as RoleUser } from "@/utils/role";
import { apiFetch } from "@/utils/api";

type Customer = {
  id: number;
  group: string;
  company: string;
  department: string;
  name: string;
  phone: string;
  email?: string;
  memo?: string;
};

type User = {
  id: number;
  name: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
};

// 재사용 정보 표시 컴포넌트
function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-zinc-500 font-medium">{label}</span>
      <span className="text-[14px] font-semibold text-zinc-100">{value ?? '-'}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[14px] font-semibold text-zinc-200 mb-1 mt-4">{children}</div>;
}

function ActionButton({ children, color, ...props }: any) {
  const base = "px-4 py-2 rounded-lg font-medium text-[13px] transition";
  const colorMap: any = {
    gray: "bg-zinc-800 hover:bg-zinc-700 text-zinc-300",
    blue: "bg-[#111167] hover:bg-[#1a1a80] text-white",
    red: "bg-red-600 hover:bg-red-500 text-white",
  };
  return <button className={`${base} ${colorMap[color] || ''}`} {...props}>{children}</button>;
}

export default function CustomerDetailPage() {
  const t = useTranslations('customer.detail');
  const tAuth = useTranslations('auth');
  const tCar = useTranslations('car');
  const tCommon = useTranslations('common');

  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = getCurrentUser() as RoleUser | null;
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    // 로그인 상태 확인
    if (!isAuthenticated()) {
      setError(tAuth('loginRequired'));
      setLoading(false);
      return;
    }

    // ID가 숫자가 아닌 경우 고객 목록으로 리다이렉트
    if (Array.isArray(id) || !/^\d+$/.test(id as string)) {
      router.push('/car/customer');
      return;
    }

    setLoading(true);
    apiFetch(`/api/customer/${id}`)
      .then((data) => setCustomer(data))
      .catch((err) => setError(err.message || t('loadFailed')))
      .finally(() => setLoading(false));
  }, [id, router]);

  const canEditOrDelete = canEditCustomer(user);
  const canDelete = canDeleteCustomer(user);

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/customer/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error(t('deleteFailed'));
      router.push("/car/customer");
    } catch (e: any) {
      alert(e.message || t('deleteFailed'));
    } finally {
      setDeleting(false);
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
  if (!customer) return <div className="p-8 bg-[#111113] min-h-screen text-white text-center">{t('noCustomerInfo')}</div>;

  return (
    <div className="p-8 bg-[#111113] min-h-screen text-white">
      <div className="max-w-3xl mx-auto bg-[#111113] rounded-lg border border-zinc-800/60 p-8">
        <h2 className="text-lg font-semibold text-zinc-100 mb-6">{t('title')}</h2>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
          <Info label={t('fields.id')} value={customer.id} />
          <Info label={t('fields.group')} value={customer.group} />
          <Info label={t('fields.company')} value={customer.company || customer.group || '-'} />
          <Info label={t('fields.department')} value={customer.department} />
          <Info label={t('fields.name')} value={customer.name} />
          <Info label={t('fields.phone')} value={customer.phone} />
          <Info label={t('fields.email')} value={customer.email || '-'} />
        </div>

        <SectionTitle>{t('fields.memo')}</SectionTitle>
        <div className="bg-zinc-900 rounded-lg p-3 mb-2 min-h-[40px] whitespace-pre-line">
          {customer.memo || '-'}
        </div>

        <div className="flex gap-2 mt-8 justify-end">
          <ActionButton
            color="gray"
            onClick={() => router.back()}
            data-testid="customer-back-btn"
          >
            {t('backToList')}
          </ActionButton>
          {canEditOrDelete && (
            <>
              <ActionButton
                color="blue"
                onClick={() => router.push(`/car/customer/${customer.id}/edit`)}
              >
                {t('edit')}
              </ActionButton>
              {canDelete && (
                <ActionButton
                  color="red"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t('deleting') : t('delete')}
                </ActionButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}