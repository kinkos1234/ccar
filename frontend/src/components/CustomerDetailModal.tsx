"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

interface CustomerDetailModalProps {
  customerId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onCustomerDeleted?: () => void;
}

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
  const base = "px-4 py-2 rounded-lg text-[13px] font-medium transition";
  const colorMap: any = {
    gray: "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
    blue: "bg-[#111167] text-white hover:bg-[#1a1a80]",
    red: "bg-red-500 text-white hover:bg-red-600",
  };
  return <button className={`${base} ${colorMap[color] || ''}`} {...props}>{children}</button>;
}

export default function CustomerDetailModal({ customerId, isOpen, onClose, onCustomerDeleted }: CustomerDetailModalProps) {
  const router = useRouter();
  const t = useTranslations('customer.modal');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = getCurrentUser() as RoleUser | null;
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen || !customerId) {
      setCustomer(null);
      setError(null);
      return;
    }

    if (!isAuthenticated()) {
      setError(t('loginRequired'));
      return;
    }

    setLoading(true);
    setError(null);
    apiFetch(`/api/customer/${customerId}`)
      .then((data) => setCustomer(data))
      .catch((err) => setError(err.message || t('loadFailed')))
      .finally(() => setLoading(false));
  }, [customerId, isOpen, t]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const canEditOrDelete = canEditCustomer(user);
  const canDelete = canDeleteCustomer(user);

  const handleDelete = async () => {
    if (!customerId) return;
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/customer/${customerId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error(t('deleteFailed'));
      onCustomerDeleted?.();
      onClose();
    } catch (e: any) {
      alert(e.message || t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    router.push(`/car/customer/${customerId}/edit`);
  };

  // 모달이 열려있지 않으면 렌더링하지 않음
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#111113] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/60">
          <h2 className="text-lg font-semibold text-zinc-100">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 모달 컨텐츠 */}
        <div className="p-6 text-white">
          {loading && (
            <div className="text-center py-8">
              <div className="text-zinc-400">{t('loading')}</div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-red-400 mb-4">{t('error')}: {error}</div>
            </div>
          )}

          {!loading && !error && customer && (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
                <Info label={t('id')} value={customer.id} />
                <Info label={t('group')} value={customer.group} />
                <Info label={t('company')} value={customer.company || customer.group || '-'} />
                <Info label={t('department')} value={customer.department} />
                <Info label={t('name')} value={customer.name} />
                <Info label={t('phone')} value={customer.phone} />
                <Info label={t('email')} value={customer.email || '-'} />
              </div>

              <SectionTitle>{t('memo')}</SectionTitle>
              <div className="bg-zinc-900 rounded-lg p-3 mb-2 min-h-[40px] whitespace-pre-line">
                {customer.memo || '-'}
              </div>
            </>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="flex gap-2 justify-end p-6 border-t border-zinc-800/60">
          <ActionButton color="gray" onClick={onClose}>
            {t('close')}
          </ActionButton>
          {!loading && !error && customer && canEditOrDelete && (
            <>
              <ActionButton color="blue" onClick={handleEdit}>
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
