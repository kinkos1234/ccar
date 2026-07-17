"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getAuthHeaders, isAuthenticated, getCurrentUser } from "@/utils/jwt";

interface WeeklyReport {
  id: number;
  title: string | null;
  weekStart: string;
  createdAt: string;
  updatedAt: string;
  data: any;
}

export default function ReportListPage() {
  const router = useRouter();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('admin.report.list');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const user = getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      setError(t('accessDenied'));
      return;
    }

    loadReports();
  }, [router, t]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/report/weekly-reports', {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(`Failed to load reports: ${response.status}`);
      }

      const data = await response.json();
      setReports(data);
    } catch (err: any) {
      console.error('Report load error:', err);
      setError(err.message || t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDisplayTitle = (report: WeeklyReport) => {
    if (report.title) {
      return report.title;
    }
    const date = new Date(report.createdAt);
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${t('defaultTitle')}_${year}${month}${day}`;
  };

  if (loading && reports.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-[13px] text-zinc-400">{t('loadingReports')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
      <div className="max-w-full mx-auto px-2 lg:px-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {t('backButton')}
            </button>
            <h1 className="text-lg font-semibold text-zinc-100">{t('title')}</h1>
            <span className="text-[12px] text-zinc-500">({reports.length})</span>
          </div>
          <button
            onClick={loadReports}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 rounded-lg text-zinc-300 text-[13px] font-medium transition-colors flex items-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {t('refreshButton')}
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-4 mb-6">
            <div className="text-red-400 text-[13px]">{error}</div>
          </div>
        )}

        {/* 보고서 목록 */}
        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800/40">
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('tableHeaders.id')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('tableHeaders.title')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('tableHeaders.createdAt')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('tableHeaders.customerCount')}</th>
                  <th className="px-4 py-3 text-center text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('tableHeaders.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-500 text-[13px]">
                      {loading ? t('loadingReports') : t('emptyState')}
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => {
                    const customerCount = report.data && typeof report.data === 'object'
                      ? Object.keys(report.data).length
                      : 0;

                    return (
                      <tr key={report.id} className="hover:bg-zinc-800/40 border-b border-zinc-800/40 text-[13px] last:border-b-0 transition-colors">
                        <td className="px-4 py-3 text-zinc-100 font-mono">#{report.id}</td>
                        <td className="px-4 py-3">
                          <div className="text-zinc-100 font-medium">{getDisplayTitle(report)}</div>
                          <div className="text-[12px] text-zinc-500 mt-1">
                            {t('weekBased')}: {new Date(report.weekStart).toLocaleDateString('ko-KR')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {formatDate(report.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 bg-[#111167]/30 text-zinc-200 rounded text-[12px]">
                            {t('customerCountValue', { count: customerCount })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => router.push(`/admin/report/${report.id}`)}
                            className="px-3 py-1 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
                          >
                            {t('viewDetail')}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
