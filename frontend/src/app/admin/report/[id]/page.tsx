"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getAuthHeaders, isAuthenticated, getCurrentUser } from "@/utils/jwt";

interface WeeklyReport {
  id: number;
  title: string | null;
  weekStart: string;
  createdAt: string;
  updatedAt: string;
  data: Record<string, any>;
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const t = useTranslations('admin.report.detail');

  useEffect(() => {
    // 인증 체크
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    const user = getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      setError(t('accessDenied'));
      return;
    }

    // ID가 숫자가 아닌 경우 Admin Report로 리다이렉트
    if (Array.isArray(params.id) || !/^\d+$/.test(params.id as string)) {
      router.push('/admin/report');
      return;
    }

    loadReport();
  }, [params.id, router, t]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/report/weekly-reports/${params.id}`, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // 토큰이 만료되었거나 유효하지 않음
          router.push('/login');
          return;
        }
        throw new Error(`Failed to load report: ${response.status}`);
      }

      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      console.error('Report load error:', err);
      setError(err.message || t('error'));
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

  const getDisplayTitle = () => {
    if (!report) return '';
    if (report.title) return report.title;

    const date = new Date(report.createdAt);
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${t('weeklyReportTitle')}_${year}${month}${day}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(t('copySuccess'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div>{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-500 text-xl mb-4">{t('notFound')}</div>
            <div className="text-zinc-500 mb-6">{error}</div>
            <button
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-[13px] font-medium transition-colors"
              onClick={() => router.push("/admin/report")}
              data-testid="report-back-btn"
            >
              {t('backButton')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const customers = report.data ? Object.keys(report.data) : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
      <div className="max-w-full mx-auto px-2 lg:px-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin/report")}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
              data-testid="report-back-btn"
            >
              {t('backButton')}
            </button>
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">{getDisplayTitle()}</h1>
              <div className="flex items-center gap-4 mt-1 text-[12px] text-zinc-500">
                <span>{t('createdAt')}: {formatDate(report.createdAt)}</span>
                <span>{t('weekBased')}: {new Date(report.weekStart).toLocaleDateString('ko-KR')}</span>
                <span>{t('customerCount')}: {customers.length}{t('customersUnit')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 고객사 목록 (왼쪽 사이드바) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-4 sticky top-4">
              <h3 className="text-[14px] font-semibold text-zinc-200 mb-4">{t('customerList')}</h3>
              <div className="space-y-2">
                {customers.length === 0 ? (
                  <div className="text-zinc-500 text-sm">{t('noData')}</div>
                ) : (
                  customers.map((customer) => (
                    <button
                      key={customer}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm ${
                        selectedCustomer === customer
                          ? 'bg-[#111167] text-white'
                          : 'bg-zinc-900 hover:bg-zinc-800/40 text-zinc-300'
                      }`}
                    >
                      <div className="font-medium">{customer}</div>
                      <div className="text-xs opacity-70 mt-1">
                        {report.data[customer]?.summary?.totalEvents || 0}{t('eventsUnit')}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 상세 내용 (오른쪽 메인 영역) */}
          <div className="lg:col-span-3">
            {!selectedCustomer ? (
              <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-12 text-center">
                <div className="text-zinc-500 text-lg mb-4">{t('selectCustomer')}</div>
                <div className="text-zinc-500 text-sm">{t('selectDescription')}</div>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const customerData = report.data[selectedCustomer];
                  if (!customerData) {
                    return (
                      <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-6 text-center">
                        <div className="text-red-400">{t('noCustomerData')}</div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {/* 헤더 */}
                      <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-6">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-[14px] font-semibold text-zinc-200 mb-2">{selectedCustomer} {t('aiAnalysisReport')}</h3>
                          <button
                            onClick={() => handleCopy(JSON.stringify(customerData, null, 2))}
                            className="px-4 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2"
                          >
                            {t('copyAllData')}
                          </button>
                        </div>

                        {/* 요약 통계 */}
                        {customerData.summary && (
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                              <div className="text-[12px] text-zinc-500 mb-1">{t('totalEvents')}</div>
                              <div className="text-[14px] font-semibold text-zinc-100">{customerData.summary.totalEvents || 0}{t('eventsUnit')}</div>
                            </div>
                            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                              <div className="text-[12px] text-zinc-500 mb-1">{t('recentEvents')}</div>
                              <div className="text-[14px] font-semibold text-zinc-100">{customerData.summary.recentEvents || 0}{t('eventsUnit')}</div>
                            </div>
                            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                              <div className="text-[12px] text-zinc-500 mb-1">{t('openEvents')}</div>
                              <div className="text-[14px] font-semibold text-zinc-100">{customerData.summary.openEvents || 0}{t('eventsUnit')}</div>
                            </div>
                            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                              <div className="text-[12px] text-zinc-500 mb-1">{t('avgSentiment')}</div>
                              <div className="text-[14px] font-semibold text-zinc-100">
                                {typeof customerData.summary.avgSentiment === 'number' ? customerData.summary.avgSentiment.toFixed(1) : (customerData.summary.avgSentiment || '0.0')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Top 이슈 */}
                      {customerData.topIssues && customerData.topIssues.length > 0 && (
                        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-6">
                          <h4 className="text-[14px] font-semibold text-zinc-200 mb-4">{t('majorIssuesTop')} {customerData.topIssues.length}</h4>
                          <div className="space-y-4">
                            {customerData.topIssues.map((issue: any, idx: number) => (
                              <div key={idx} className="bg-zinc-900 rounded-lg p-4 border-l-4 border-red-500">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1 mr-3">
                                    <pre className="font-medium text-white whitespace-pre-wrap text-sm leading-relaxed">{issue.title}</pre>
                                  </div>
                                  <span className="text-red-400 font-bold text-sm flex-shrink-0">
                                    {typeof issue.score === 'number' ? issue.score.toFixed(1) : issue.score}
                                  </span>
                                </div>
                                {issue.plan && (
                                  <div className="text-sm text-zinc-200 mt-2">
                                    <pre className="inline whitespace-pre-wrap font-medium">{issue.plan}</pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI 전략 제언 */}
                      {customerData.aiRecommendation && (
                        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-6">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[14px] font-semibold text-zinc-200">{t('aiRecommendation')}</h4>
                            <button
                              onClick={() => handleCopy(customerData.aiRecommendation)}
                              className="px-3 py-1 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
                            >
                              {t('copyRecommendation')}
                            </button>
                          </div>
                          <div className="bg-zinc-900 rounded-lg p-4 text-sm">
                            <pre className="whitespace-pre-wrap text-zinc-300 leading-relaxed">
                              {customerData.aiRecommendation}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Evidence (근거) */}
                      {customerData.evidence && (
                        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-6">
                          <h4 className="text-[14px] font-semibold text-zinc-200 mb-4">{t('evidence')}</h4>
                          <div className="bg-zinc-900 rounded-lg p-4 text-sm">
                            <pre className="whitespace-pre-wrap text-zinc-300 leading-relaxed">
                              {customerData.evidence}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* 오류 정보 (있는 경우) */}
                      {customerData.errors && (customerData.errors.summaryError || customerData.errors.strategyError) && (
                        <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-6">
                          <h4 className="text-red-400 font-bold mb-2">{t('generationErrors')}</h4>
                          {customerData.errors.summaryError && (
                            <div className="text-sm text-red-300 mb-1">{t('summaryError')}: {customerData.errors.summaryError}</div>
                          )}
                          {customerData.errors.strategyError && (
                            <div className="text-sm text-red-300">{t('strategyError')}: {customerData.errors.strategyError}</div>
                          )}
                        </div>
                      )}

                      {/* Raw JSON 데이터 (디버깅용 - 접히는 형태) */}
                      <details className="bg-[#111113] rounded-lg border border-zinc-800/60 p-6">
                        <summary className="text-zinc-500 cursor-pointer hover:text-white transition-colors">
                          {t('rawDataToggle')}
                        </summary>
                        <div className="mt-4">
                          <pre className="bg-zinc-900 rounded p-4 text-xs text-zinc-500 overflow-auto max-h-96">
                            {JSON.stringify(customerData, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
