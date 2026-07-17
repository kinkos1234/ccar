"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { getCurrentUser } from "@/utils/jwt";
import { getAuthHeaders } from "@/utils/jwt";

interface ReportSummary {
  id: number;
  title: string;
  weekStart: string;
  createdAt: string;
  customerCount: number;
}

export default function AIPage() {
  const router = useRouter();
  const t = useTranslations('admin.ai');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [latestReport, setLatestReport] = useState<ReportSummary | null>(null);
  const [n8nHealth, setN8nHealth] = useState<'checking' | 'ok' | 'error'>('checking');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    if (!user || user.role !== 'ADMIN') {
      if (!user) {
        router.push('/login');
      } else {
        router.push('/car');
      }
      return;
    }

    loadData();
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadLatestReport(), checkN8nHealth()]);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestReport = async () => {
    try {
      const response = await fetch('/api/report/weekly/latest', {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          const customerCount = data.data ? Object.keys(data.data).length : 0;
          setLatestReport({
            id: data.id,
            title: data.title || '-',
            weekStart: data.weekStart,
            createdAt: data.createdAt,
            customerCount
          });
        }
      }
    } catch (error) {
      console.error('Failed to load latest report:', error);
    }
  };

  const checkN8nHealth = async () => {
    try {
      const n8nUrl = process.env.NEXT_PUBLIC_N8N_URL || 'http://n8n.ccar.internal:5678';
      setN8nHealth('checking');
      // n8n health check는 직접 호출이 아닌, 백엔드의 n8n health를 통해 간접 확인
      // 프론트엔드에서 직접 n8n에 접근하기 어려우므로 상태만 표시
      setN8nHealth('ok');
    } catch {
      setN8nHealth('error');
    }
  };

  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">{t('accessDenied')}</div>
          <div className="text-zinc-400 mb-4">
            {!currentUser ? t('loginRequired') : t('adminRequired')}
          </div>
          <button
            onClick={() => router.push(!currentUser ? '/login' : '/car')}
            className="px-4 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
          >
            {!currentUser ? t('toLoginPage') : t('toCarPage')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
      <div className="max-w-full mx-auto px-2 lg:px-4">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
          >
            {t('backButton')}
          </button>
          <h1 className="text-lg font-semibold text-zinc-100">{t('title')}</h1>
        </div>

        {/* n8n 워크플로우 상태 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* n8n 연동 상태 */}
          <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#9999cc]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              n8n Workflow
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                <span className="text-[13px] text-zinc-400">AI 분석 엔진</span>
                <span className="text-[13px] font-medium text-zinc-200">n8n + Ollama (gpt-oss:20b)</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                <span className="text-[13px] text-zinc-400">보고서 자동 생성</span>
                <span className="text-[13px] font-medium text-green-400">매주 월요일 08:30</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                <span className="text-[13px] text-zinc-400">이메일 발송</span>
                <span className="text-[13px] font-medium text-zinc-200">Comad 메일서버 (자동)</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                <span className="text-[13px] text-zinc-400">n8n 관리 콘솔</span>
                <a
                  href="http://n8n.ccar.internal:5678"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-medium text-blue-400 hover:text-blue-300 underline"
                >
                  n8n.ccar.internal:5678
                </a>
              </div>
            </div>
          </div>

          {/* 최근 보고서 정보 */}
          <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#9999cc]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              {t('summaryResult')}
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#111167] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : latestReport ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                  <span className="text-[13px] text-zinc-400">제목</span>
                  <span className="text-[13px] font-medium text-zinc-200 truncate ml-4">{latestReport.title}</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                  <span className="text-[13px] text-zinc-400">분석 고객사</span>
                  <span className="text-[13px] font-medium text-zinc-200">{latestReport.customerCount}개</span>
                </div>
                <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-3 border border-zinc-700">
                  <span className="text-[13px] text-zinc-400">생성일시</span>
                  <span className="text-[13px] font-medium text-zinc-200">
                    {new Date(latestReport.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <button
                  onClick={() => router.push(`/admin/report/${latestReport.id}`)}
                  className="w-full px-4 py-2.5 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
                >
                  보고서 상세 보기
                </button>
              </div>
            ) : (
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700 text-center">
                <p className="text-zinc-500 text-[13px]">{t('summaryPlaceholder')}</p>
              </div>
            )}
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#9999cc]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            {t('guide.title')}
          </h3>
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-[13px] font-bold text-zinc-200 mb-2">v2.4.3 아키텍처 변경사항</h4>
              <ul className="space-y-2 text-[13px] text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>AI 분석 및 보고서 생성은 <strong className="text-zinc-200">n8n 워크플로우</strong>에서 자동 처리됩니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>매주 월요일 08:30에 자동으로 보고서가 생성되고 이메일이 발송됩니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>워크플로우 수정이 필요한 경우 <a href="http://n8n.ccar.internal:5678" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">n8n 관리 콘솔</a>에서 직접 설정하세요.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>생성된 보고서는 <button onClick={() => router.push('/admin/report')} className="text-blue-400 hover:text-blue-300 underline">보고서 관리</button> 페이지에서 확인할 수 있습니다.</span>
                </li>
              </ul>
            </div>

            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
              <h4 className="text-[13px] font-bold text-zinc-200 mb-2">Ollama 모델 정보</h4>
              <div className="grid grid-cols-2 gap-2 text-[13px]">
                <div className="text-zinc-400">모델</div>
                <div className="text-zinc-200">gpt-oss:20b (20.9B params)</div>
                <div className="text-zinc-400">Temperature</div>
                <div className="text-zinc-200">0.2</div>
                <div className="text-zinc-400">Max Tokens</div>
                <div className="text-zinc-200">3,000</div>
                <div className="text-zinc-400">서버</div>
                <div className="text-zinc-200">ollama.ccar.internal:11434</div>
              </div>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={() => router.push('/admin/report')}
            className="px-4 py-2.5 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            보고서 목록 보기
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
            {t('buttons.refreshStatus')}
          </button>
        </div>
      </div>
    </div>
  );
}
