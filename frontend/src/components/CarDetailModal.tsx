"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getCurrentUser, isAuthenticated } from "@/utils/jwt";
import { canEditCar, canDeleteCar, User as RoleUser } from "@/utils/role";
import { apiFetch } from "@/utils/api";
import RiskIndicator from "@/components/RiskIndicator";
import CarActivityTimeline from "@/components/CarActivityTimeline";

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
  riskMitigation?: boolean;
  riskDescription?: string;
  riskLevel?: string;
};

interface CarDetailModalProps {
  carId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onCarDeleted?: () => void;
  onEdit?: (carId: number) => void;
}

function Info({ label, value, highlight = false }: { label: string; value: unknown; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] text-zinc-500 font-medium">{label}</span>
      <span className={`text-[14px] font-medium ${highlight ? 'text-emerald-400' : 'text-zinc-100'}`}>
        {value !== undefined && value !== null && value !== '' ? String(value) : '-'}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold text-zinc-300 mb-1.5 mt-5">{children}</div>;
}

function formatDate(ts?: string | number | null) {
  if (!ts) return '-';
  let d = ts;
  if (typeof ts === 'bigint') d = Number(ts);
  else if (typeof ts === 'string' && /^\d+$/.test(ts)) d = Number(ts);
  else if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ts)) return ts.slice(0, 10);
  if (!d || isNaN(d as number)) return '-';
  return new Date(d as number).toISOString().slice(0, 10);
}

export default function CarDetailModal({ carId, isOpen, onClose, onCarDeleted, onEdit }: CarDetailModalProps) {
  const t = useTranslations('car.modal');
  const carT = useTranslations('car');
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = getCurrentUser() as RoleUser | null;
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen || !carId) { setCar(null); setError(null); return; }
    if (!isAuthenticated()) { setError(t('loginRequired')); return; }
    setLoading(true);
    setError(null);
    apiFetch(`/api/car/${carId}`)
      .then((data) => setCar(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [carId, isOpen, t]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const canEditOrDelete = canEditCar(user, car);

  const handleDelete = async () => {
    if (!carId) return;
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/car/${carId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!res.ok) throw new Error(t('deleteFailed'));
      onCarDeleted?.();
      onClose();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111113] border border-zinc-800/60 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/60">
          <h2 className="text-lg font-semibold text-zinc-100">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-zinc-100">
          {loading && (
            <div className="text-center py-12">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-3" />
              <div className="text-zinc-500 text-[13px]">{t('loading')}</div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-400/80 text-[13px]">{t('error')}: {error}</div>
            </div>
          )}

          {!loading && !error && car && (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
                <Info label={t('corporation')} value={car.corporation} />
                <Info label={t('customer')} value={car.customerContacts?.length > 0 ? car.customerContacts.map(cc => cc.group).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') : '-'} />
                <Info label={t('contact')} value={car.customerContacts?.length > 0 ? car.customerContacts.map(cc => cc.name).join(', ') : '-'} />
                <Info label={t('department')} value={car.customerContacts?.length > 0 ? car.customerContacts.map(cc => cc.department).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') : '-'} />
                <Info label={t('eventType')} value={car.eventType} />
                <Info label={carT('statusLabel')} value={car.status ? carT(`status.${car.status}`) : '-'} highlight />
                <Info label={t('issueDate')} value={formatDate(car.issueDate)} />
                <Info label={t('dueDate')} value={formatDate(car.dueDate)} />
                <Info label={t('internalContact')} value={car.internalContact} />
                <Info label={t('importance')} value={car.importance} />
                <Info label={t('completionDate')} value={formatDate(car.completionDate)} />
                <Info label={t('finalScore')} value={car.score !== undefined && car.score !== null ? Number(car.score).toFixed(1) : '-'} highlight />
              </div>

              <SectionLabel>{t('mainCategory')}</SectionLabel>
              <div className="bg-zinc-900/50 rounded-lg p-3 mb-1 min-h-[36px] text-[13px] text-zinc-300">
                {car.mainCategory || '-'}
              </div>

              <SectionLabel>Open Issue</SectionLabel>
              <div className="bg-zinc-900/50 rounded-lg p-3 mb-1 min-h-[60px] whitespace-pre-line text-[13px] text-zinc-300">
                {car.openIssue || '-'}
              </div>

              <SectionLabel>Follow-up Plan</SectionLabel>
              <div className="bg-zinc-900/50 rounded-lg p-3 mb-1 min-h-[60px] whitespace-pre-line text-[13px] text-zinc-300">
                {car.followUpPlan || '-'}
              </div>

              <SectionLabel>{t('scoreDetails')}</SectionLabel>
              {car.eventType === "ONE_TIME" ? (
                <div className="grid grid-cols-1 gap-4 mb-4 max-w-xs">
                  <Info label={t('subjectiveScore')} value={car.subjectiveScore !== undefined && car.subjectiveScore !== null ? Number(car.subjectiveScore).toFixed(1) : '-'} />
                </div>
              ) : car.eventType === "CONTINUOUS" ? (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Info label={t('internalScore')} value={car.internalScore !== undefined && car.internalScore !== null ? Number(car.internalScore).toFixed(1) : '-'} />
                  <Info label={t('customerScore')} value={car.customerScore !== undefined && car.customerScore !== null ? Number(car.customerScore).toFixed(1) : '-'} />
                  <Info label={t('dateScore')} value={car.dateScore !== undefined && car.dateScore !== null ? Number(car.dateScore).toFixed(1) : '0.0'} />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <Info label={t('internalScore')} value={car.internalScore !== undefined && car.internalScore !== null ? Number(car.internalScore).toFixed(1) : '-'} />
                  <Info label={t('customerScore')} value={car.customerScore !== undefined && car.customerScore !== null ? Number(car.customerScore).toFixed(1) : '-'} />
                  <Info label={t('subjectiveScore')} value={car.subjectiveScore !== undefined && car.subjectiveScore !== null ? Number(car.subjectiveScore).toFixed(1) : '-'} />
                  <Info label={t('dateScore')} value={car.dateScore !== undefined && car.dateScore !== null ? Number(car.dateScore).toFixed(1) : '-'} />
                </div>
              )}

              {/* Risk Management */}
              <SectionLabel>Risk Management</SectionLabel>
              <div className="bg-zinc-900/50 rounded-lg p-3 mb-1">
                <div className="flex items-center gap-3 mb-2">
                  <RiskIndicator riskMitigation={car.riskMitigation || false} riskLevel={car.riskLevel} />
                  <span className="text-[13px] text-zinc-300">
                    {car.riskMitigation ? 'Risk mitigation activity exists' : 'No risk identified'}
                  </span>
                </div>

                {car.riskMitigation && (
                  <>
                    <div className="grid grid-cols-1 gap-3">
                      <Info label="Risk Level" value={car.riskLevel || 'MEDIUM'} highlight={car.riskLevel === 'HIGH' || car.riskLevel === 'CRITICAL'} />
                    </div>
                    {car.riskDescription && (
                      <div className="mt-3">
                        <span className="text-[12px] text-zinc-500 font-medium block mb-1">Risk Description</span>
                        <div className="text-[13px] text-zinc-300 bg-zinc-900 p-3 rounded-lg border-l-2 border-red-500/60 whitespace-pre-line">
                          {car.riskDescription}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <SectionLabel>{carT('timeline.sectionTitle')}</SectionLabel>
              <div className="bg-zinc-900/50 rounded-lg p-4">
                <CarActivityTimeline carId={car.id} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-5 border-t border-zinc-800/60">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
            {t('close')}
          </button>
          {!loading && !error && car && canEditOrDelete && (
            <>
              <button onClick={() => { if (onEdit && carId) { onClose(); onEdit(carId); } }} className="px-4 py-2 text-[13px] font-medium text-white bg-[#111167] hover:bg-[#1a1a80] rounded-lg transition-colors">
                {t('edit')}
              </button>
              {canDeleteCar(user, car) && (
                <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors">
                  {deleting ? t('deleting') : t('delete')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
