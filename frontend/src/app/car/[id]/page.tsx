"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { getCurrentUser, isAuthenticated } from "@/utils/jwt";
import { canEditCar } from "@/utils/role";
import { apiFetch } from "@/utils/api";
import RiskIndicator from "@/components/RiskIndicator";
import CarActivityTimeline from "@/components/CarActivityTimeline";

// CAR 타입 정의 (실제 필드에 맞게 수정 필요)
type CustomerContact = {
  id: number;
  name: string;
  group: string;
  department: string;
  phone: string;
  memo?: string;
};

type Car = {
  id: number;
  corporation: string;
  customerContacts: CustomerContact[];
  eventType: string;
  issueDate: string;
  dueDate?: string;
  importance: number;
  internalContact?: string;
  mainCategory?: string;
  openIssue?: string;
  followUpPlan?: string;
  completionDate?: string;
  internalScore?: number;
  customerScore?: number;
  subjectiveScore?: number;
  score?: number;
  dateScore?: number;
  createdBy: number;
  status?: string;
  // Risk 관련 필드들 추가 (2025-10-01)
  riskMitigation?: boolean;
  riskDescription?: string;
  riskLevel?: string;
};

type User = {
  id: number;
  name: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
};

// 재사용 정보 표시 컴포넌트
function Info({ label, value, highlight = false }: { label: string; value: unknown; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-zinc-500 font-medium">{label}</span>
      <span className={`text-[14px] font-semibold ${highlight ? 'text-green-400' : 'text-zinc-100'}`}>{value !== undefined && value !== null && value !== '' ? String(value) : '-'}</span>
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[14px] font-semibold text-zinc-200 mb-1 mt-4">{children}</div>;
}
function ActionButton({ children, color, ...props }: { children: React.ReactNode; color: string; [key: string]: unknown }) {
  const base = "px-4 py-2 rounded-lg font-medium text-[13px] transition";
  const colorMap: Record<string, string> = {
    gray: "bg-zinc-800 hover:bg-zinc-700 text-zinc-300",
    green: "bg-green-600 text-white hover:bg-green-700",
    red: "bg-red-600 hover:bg-red-500 text-white",
    blue: "bg-[#111167] hover:bg-[#1a1a80] text-white",
  };
  return <button className={`${base} ${colorMap[color] || ''}`} {...props}>{children}</button>;
}

function formatDate(ts?: string | number | null) {
  if (!ts) return '-';

  // BigInt인 경우 Number로 변환
  let d = ts;
  if (typeof ts === 'bigint') {
    d = Number(ts);
  } else if (typeof ts === 'string' && /^\d+$/.test(ts)) {
    // 문자열 숫자인 경우 Number로 변환
    d = Number(ts);
  } else if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ts)) {
    // 이미 YYYY-MM-DD 형태라면 그대로 사용
    return ts.slice(0, 10);
  }

  if (!d || isNaN(d as number)) return '-';
  return new Date(d as number).toISOString().slice(0, 10);
}

export default function CarDetailPage() {
  const t = useTranslations('car');

  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = getCurrentUser() as User | null;
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    // 로그인 상태 확인
    if (!isAuthenticated()) {
      setError(t('loginRequired'));
      setLoading(false);
      return;
    }

    // ID가 숫자가 아닌 경우 CAR 목록으로 리다이렉트
    if (Array.isArray(id) || !/^\d+$/.test(id as string)) {
      router.replace('/car');
      return;
    }

    setLoading(true);
    apiFetch(`/api/car/${id}`)
      .then((data) => setCar(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, router, t]);

  const canEditOrDelete = canEditCar(user, car);
  const canEdit = canEditCar(user, car);

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/car/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) throw new Error(t('deleteFailed'));
      router.push("/car");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  // 권한 체크: 로그인되지 않은 경우 (로딩보다 우선)
  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-[#111113] text-white p-8">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">{t('accessDenied')}</div>
          <div className="text-zinc-400 mb-4">{t('loginRequired')}</div>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
          >
            {t('goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 bg-[#111113] min-h-screen text-white text-center">{t('loading')}</div>;

  if (error) {
    if (error === "NOT_FOUND")
      return (
        <div className="p-8 bg-[#111113] min-h-screen text-red-500 text-center">
          {t('notFound')}<br />
          <ActionButton color="gray" onClick={() => router.push("/car")}>{t('backToList')}</ActionButton>
        </div>
      );
    if (error === "FORBIDDEN")
      return (
        <div className="p-8 bg-[#111113] min-h-screen text-red-500 text-center">
          {t('forbidden')}<br />
          <ActionButton color="gray" onClick={() => router.push("/car")}>{t('backToList')}</ActionButton>
        </div>
      );
    return (
      <div className="p-8 bg-[#111113] min-h-screen text-red-500 text-center">
        {t('errorPrefix')} {error}<br />
        <ActionButton color="gray" onClick={() => router.push("/car")}>{t('backToList')}</ActionButton>
      </div>
    );
  }

  if (!car) return <div className="p-8 bg-[#111113] min-h-screen text-red-500 text-center">{t('noCarInfo')}</div>;

  return (
    <div className="p-8 bg-[#111113] min-h-screen text-white">
      <div className="max-w-4xl mx-auto bg-[#111113] rounded-lg border border-zinc-800/60 p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-6">{t('detailTitle')}</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
          <Info label={t('corporation')} value={car.corporation} />
          <Info label={t('customerGroup')} value={car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map(cc => cc.group).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') : '-'} />
          <Info label={t('customerContact')} value={car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map(cc => cc.name).join(', ') : '-'} />
          <Info label={t('department')} value={car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map(cc => cc.department).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') : '-'} />
          <Info label={t('eventType')} value={car.eventType} />
                        <Info label={t('statusLabel')} value={car.status ? t(`status.${car.status}`) : '-'} highlight />
          <Info label={t('issueDate')} value={formatDate(car.issueDate)} />
          <Info label={t('dueDate')} value={formatDate(car.dueDate)} />
          <Info label={t('internalContact')} value={car.internalContact || '-'} />
          <Info label={t('importance')} value={car.importance} />
          <Info label={t('completionDate')} value={formatDate(car.completionDate)} />
          <Info label={t('finalScore')} value={car.score !== undefined && car.score !== null ? Number(car.score).toFixed(1) : '-'} highlight />
        </div>

        <SectionTitle>{t('mainCategory')}</SectionTitle>
        <div className="bg-zinc-900 rounded-lg p-3 mb-2 min-h-[40px]">
          {car.mainCategory || '-'}
        </div>

        <SectionTitle>{t('openIssue')}</SectionTitle>
        <div className="bg-zinc-900 rounded-lg p-3 mb-2 min-h-[80px] whitespace-pre-line">
          {car.openIssue || '-'}
        </div>

        <SectionTitle>{t('followUpPlan')}</SectionTitle>
        <div className="bg-zinc-900 rounded-lg p-3 mb-2 min-h-[80px] whitespace-pre-line">
          {car.followUpPlan || '-'}
        </div>

        <SectionTitle>{t('scoreDetails')}</SectionTitle>
        {car.eventType === "ONE_TIME" ? (
          <div className="grid grid-cols-1 gap-4 mb-6 max-w-xs">
            <Info label={t('subjectiveScore')} value={car.subjectiveScore !== undefined && car.subjectiveScore !== null ? Number(car.subjectiveScore).toFixed(1) : '-'} />
          </div>
        ) : car.eventType === "CONTINUOUS" ? (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Info label={t('internalScore')} value={car.internalScore !== undefined && car.internalScore !== null ? Number(car.internalScore).toFixed(1) : '-'} />
            <Info label={t('customerScore')} value={car.customerScore !== undefined && car.customerScore !== null ? Number(car.customerScore).toFixed(1) : '-'} />
            <Info label={t('dateScore')} value={car.dateScore !== undefined && car.dateScore !== null ? Number(car.dateScore).toFixed(1) : '0.0'} />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Info label={t('internalScore')} value={car.internalScore !== undefined && car.internalScore !== null ? Number(car.internalScore).toFixed(1) : '-'} />
            <Info label={t('customerScore')} value={car.customerScore !== undefined && car.customerScore !== null ? Number(car.customerScore).toFixed(1) : '-'} />
            <Info label={t('subjectiveScore')} value={car.subjectiveScore !== undefined && car.subjectiveScore !== null ? Number(car.subjectiveScore).toFixed(1) : '-'} />
            <Info label={t('dateScore')} value={car.dateScore !== undefined && car.dateScore !== null ? Number(car.dateScore).toFixed(1) : '-'} />
          </div>
        )}

        {/* Risk Management Section (2025-10-01) */}
        <SectionTitle>Risk Management</SectionTitle>
        <div className="bg-zinc-900 rounded-lg p-3 mb-2">
          <div className="flex items-center gap-3 mb-3">
            <RiskIndicator
              riskMitigation={car.riskMitigation || false}
              riskLevel={car.riskLevel}
            />
            <span className="text-zinc-100 font-medium">
              {car.riskMitigation ? '수주 리스크 제거 활동 있음' : '수주 리스크 없음'}
            </span>
          </div>

          {car.riskMitigation && (
            <>
              <div className="grid grid-cols-1 gap-3">
                <Info label="Risk Level" value={car.riskLevel || 'MEDIUM'} highlight={car.riskLevel === 'HIGH' || car.riskLevel === 'CRITICAL'} />
              </div>

              {car.riskDescription && (
                <div className="mt-3">
                  <span className="text-[12px] text-zinc-500 font-medium block mb-2">Risk Description</span>
                  <div className="text-sm text-zinc-100 bg-[#0F0F0F] p-3 rounded-lg border-l-4 border-red-500 whitespace-pre-line">
                    {car.riskDescription}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

                  <div className="flex gap-2 mt-8 justify-end">
            <ActionButton color="gray" onClick={() => router.back()}>{t('backToList')}</ActionButton>
            {canEdit && (
              <ActionButton color="blue" onClick={() => router.push(`/car/${id}/edit`)}>{t('edit')}</ActionButton>
            )}
            {canEditOrDelete && (
              <ActionButton color="red" onClick={handleDelete} disabled={deleting}>{deleting ? t('deleting') : t('delete')}</ActionButton>
            )}
          </div>

        <SectionTitle>{t('timeline.sectionTitle')}</SectionTitle>
        <div className="bg-zinc-900 rounded-lg p-4">
          <CarActivityTimeline carId={car.id} />
        </div>
      </div>
    </div>
  );
}