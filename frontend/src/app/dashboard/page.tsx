"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useTranslations } from 'next-intl';
import { getCurrentUser, getAuthHeaders, isAuthenticated } from "@/utils/jwt";
import { User as RoleUser } from "@/utils/role";
import { apiFetch } from "@/utils/api";
import { calculateCarStatus, getStatusCounts, type CarStatus } from "@/utils/carStatus";
import { sortTableData, toggleSortDirection, type SortDirection, type TableSortConfig } from "@/utils/sort";
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Title } from 'chart.js';
import Pagination, { usePagination } from "@/components/Pagination";
import SortIcon from "@/components/SortIcon";
ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Title);

function CarDetailModal({ open, onClose, data, loading }: any) {
  const td = useTranslations('dashboard');
  const tc = useTranslations('car');
  if (!open) return null;

  // CAR 상세 페이지와 동일한 컴포넌트들
  function Info({ label, value, highlight = false }: { label: string; value: any; highlight?: boolean }) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400 font-medium">{label}</span>
        <span className={`text-base font-semibold ${highlight ? 'text-green-400' : 'text-white'}`}>{value ?? '-'}</span>
      </div>
    );
  }

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div className="text-sm font-bold text-[#9999cc] mb-1 mt-4">{children}</div>;
  }

  function formatDate(ts?: string | number | null) {
    if (!ts) return '-';
    
    let d = ts;
    if (typeof ts === 'bigint') {
      d = Number(ts);
    } else if (typeof ts === 'string' && /^\d+$/.test(ts)) {
      d = Number(ts);
    } else if (typeof ts === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ts)) {
      return ts.slice(0, 10);
    }
    
    if (!d || isNaN(d as number)) return '-';
    return new Date(d as number).toISOString().slice(0, 10);
  }

  // 최상위 data를 우선 사용하되, originalCar의 상세 정보 병합
  const car = data ? {
    ...data, // 최상위 data 우선 (dateScore 포함)
    ...(data.originalCar || {}) // originalCar 정보 병합 (덮어쓰기)
  } : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111113] border border-zinc-800/60 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800/60">
          <h2 className="text-2xl font-bold text-white">{td('carDetails')}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-8">
          {loading ? (
            <div className="text-center text-zinc-400">{td('loadingData')}</div>
          ) : car ? (
            <div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
                <Info label={td('corporation')} value={car.corporation} />
                <Info label={td('customer')} value={car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map((cc: any) => cc.group).filter((v: any, i: number, arr: any[]) => arr.indexOf(v) === i).join(', ') : (data.customer || '-')} />
                <Info label={td('customerContact')} value={car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map((cc: any) => cc.name).join(', ') : (data.customerManager || '-')} />
                <Info label={td('department')} value={car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map((cc: any) => cc.department).filter((v: any, i: number, arr: any[]) => arr.indexOf(v) === i).join(', ') : (data.dept || '-')} />
                <Info label={td('eventType')} value={car.eventType} />
                <Info label={td('status')} value={car.status ? tc(`status.${car.status}`) : '-'} highlight />
                <Info label={td('issueDate')} value={formatDate(car.issueDate) || data.date} />
                <Info label={td('dueDate')} value={formatDate(car.dueDate) || data.due} />
                <Info label={td('internalContact')} value={car.internalContact || data.internalManager || '-'} />
                <Info label={td('importance')} value={car.importance} />
                <Info label={td('completionDate')} value={formatDate(car.completionDate) || data.completion || '-'} />
                <Info label={td('finalScore')} value={car.score !== undefined && car.score !== null ? Number(car.score).toFixed(1) : '-'} highlight />
              </div>

              <SectionTitle>{td('mainCategory')}</SectionTitle>
              <div className="bg-zinc-900 rounded p-3 mb-2 min-h-[40px]">
                {car.mainCategory || '-'}
              </div>

              <SectionTitle>{td('openIssue')}</SectionTitle>
              <div className="bg-zinc-900 rounded p-3 mb-2 min-h-[80px] whitespace-pre-line">
                {car.openIssue || '-'}
              </div>

              <SectionTitle>{td('followUpPlan')}</SectionTitle>
              <div className="bg-zinc-900 rounded p-3 mb-2 min-h-[80px] whitespace-pre-line">
                {car.followUpPlan || '-'}
              </div>

              <SectionTitle>{td('scoreDetails')}</SectionTitle>
              {car.eventType === "ONE_TIME" ? (
                <div className="grid grid-cols-1 gap-4 mb-6 max-w-xs">
                  <Info label={td('subjectiveScore')} value={car.subjectiveScore !== undefined && car.subjectiveScore !== null ? Number(car.subjectiveScore).toFixed(1) : '-'} />
                </div>
              ) : car.eventType === "CONTINUOUS" ? (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Info label={td('internalScore')} value={car.internalScore !== undefined && car.internalScore !== null ? Number(car.internalScore).toFixed(1) : '-'} />
                  <Info label={td('customerScore')} value={car.customerScore !== undefined && car.customerScore !== null ? Number(car.customerScore).toFixed(1) : '-'} />
                  <Info label={td('dateScore')} value={car.dateScore !== undefined && car.dateScore !== null ? Number(car.dateScore).toFixed(1) : '0.0'} />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <Info label={td('internalScore')} value={car.internalScore !== undefined && car.internalScore !== null ? Number(car.internalScore).toFixed(1) : '-'} />
                  <Info label={td('customerScore')} value={car.customerScore !== undefined && car.customerScore !== null ? Number(car.customerScore).toFixed(1) : '-'} />
                  <Info label={td('subjectiveScore')} value={car.subjectiveScore !== undefined && car.subjectiveScore !== null ? Number(car.subjectiveScore).toFixed(1) : '-'} />
                  <Info label={td('dateScore')} value={car.dateScore !== undefined && car.dateScore !== null ? Number(car.dateScore).toFixed(1) : '-'} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-zinc-400">{td('noDataAvailable')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StrategyModal({ open, onClose, data, loading, error, onCopy }: any) {
  const modalRef = useRef<HTMLDivElement>(null);
  const td = useTranslations('dashboard');
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        ref={modalRef}
        className="bg-[#111113] rounded-lg  p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        <button className="absolute top-4 right-4 text-zinc-400 hover:text-white text-xl" onClick={onClose}>×</button>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div>{td('aiAnalysisLoading')}</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 text-lg mb-4">{td('dataLoadFailed')}</div>
            <div className="text-zinc-400">{error}</div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* 헤더 */}
            <div className="border-b border-zinc-800/60 pb-4">
              <h3 className="text-2xl font-bold text-white mb-2">{td('aiStrategyReport')}</h3>
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <span>{td('customer')}: <strong className="text-white">{data.customer}</strong></span>
                <span>{td('generatedDate')}: {new Date(data.generatedAt || data.updatedAt).toLocaleString('ko-KR')}</span>
              </div>
            </div>

            {/* 요약 통계 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                <div className="text-xs text-zinc-400 mb-1">{td('totalEvents')}</div>
                <div className="text-xl font-bold text-[#9999cc]">{data.summary?.totalEvents || 0}{td('items')}</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                <div className="text-xs text-zinc-400 mb-1">{td('recent30Days')}</div>
                <div className="text-xl font-bold text-green-400">{data.summary?.recentEvents || 0}{td('items')}</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                <div className="text-xs text-zinc-400 mb-1">{td('unresolved')}</div>
                <div className="text-xl font-bold text-yellow-400">{data.summary?.openEvents || 0}{td('items')}</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                <div className="text-xs text-zinc-400 mb-1">{td('averageSentiment')}</div>
                <div className="text-xl font-bold text-purple-400">
                  {typeof data.summary?.avgSentiment === 'number' ? data.summary.avgSentiment.toFixed(1) : (data.summary?.avgSentiment || 0)}
                </div>
              </div>
            </div>

            {/* Top 이슈 */}
            {data.topIssues && data.topIssues.length > 0 && (
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
                <h4 className="text-lg font-bold text-red-400 mb-3">{td('majorIssuesTop')} {data.topIssues.length}</h4>
                <div className="space-y-2">
                  {data.topIssues.map((issue: any, idx: number) => (
                    <div key={idx} className="bg-[#111113] rounded p-3 border-l-4 border-red-500">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 mr-3">
                          <pre className="font-medium text-white whitespace-pre-wrap text-sm leading-relaxed">{issue.title}</pre>
                        </div>
                        <span className="text-red-400 font-bold text-sm flex-shrink-0">
                          {typeof issue.score === 'number' ? issue.score.toFixed(1) : issue.score}
                        </span>
                      </div>
                      <div className="text-sm text-[#9999cc] mt-2">
                        <span className="inline-block mr-1"></span>
                        <pre className="inline whitespace-pre-wrap font-medium">{issue.plan}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 전략 제언 */}
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
              <h4 className="text-lg font-bold text-green-400 mb-3">{td('aiRecommendation')}</h4>
              <div className="bg-[#111113] rounded p-4 text-sm">
                <pre className="whitespace-pre-wrap text-zinc-300 leading-relaxed">
                  {data.aiRecommendation || td('strategyNotGenerated')}
                </pre>
              </div>
            </div>

            {/* Evidence (근거) */}
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800/60">
              <h4 className="text-lg font-bold text-yellow-400 mb-3">{td('evidence')}</h4>
              <div className="bg-[#111113] rounded p-3 text-sm">
                <pre className="whitespace-pre-wrap text-zinc-300 leading-relaxed">
                  {data.evidence || td('noAnalysisEvidence')}
                </pre>
              </div>
            </div>

            {/* 오류 정보 (있는 경우) */}
            {data.errors && (data.errors.summaryError || data.errors.strategyError) && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
                <h4 className="text-red-400 font-bold mb-2">{td('generationErrors')}</h4>
                {data.errors.summaryError && (
                  <div className="text-sm text-red-300 mb-1">{td('summaryError')}: {data.errors.summaryError}</div>
                )}
                {data.errors.strategyError && (
                  <div className="text-sm text-red-300">{td('strategyError')}: {data.errors.strategyError}</div>
                )}
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3 pt-4 border-t border-zinc-800/60">
              <button 
                className="px-6 py-2 bg-[#111167] hover:bg-[#1a1a80] rounded-lg text-white text-[13px] font-medium transition-colors flex items-center gap-2"
                onClick={() => onCopy(data.aiRecommendation || '')}
              >
                {td('copyRecommendation')}
              </button>
              <button 
                className="px-6 py-2 bg-[#111167] hover:bg-[#1a1a80] rounded-lg text-white text-[13px] font-medium transition-colors flex items-center gap-2"
                onClick={() => onCopy(JSON.stringify(data, null, 2))}
              >
                {td('copyAllData')}
              </button>
              <button 
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-[13px] font-medium transition-colors"
                onClick={onClose}
              >
                {td('close')}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-400">
            {td('noDataToDisplay')}
          </div>
        )}
      </div>
    </div>
  );
}

// 다중 선택 드롭다운 컴포넌트
function MultiSelectDropdown({ 
  label, 
  options, 
  selectedValues, 
  onSelectionChange, 
  placeholder = undefined
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const td = useTranslations('dashboard');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (option: string) => {
    if (selectedValues.includes(option)) {
      // 이미 선택된 항목이면 제거
      onSelectionChange(selectedValues.filter(v => v !== option));
    } else {
      // 선택되지 않은 항목이면 추가
      onSelectionChange([...selectedValues, option]);
    }
  };

  const displayText = selectedValues.length === 0 
    ? td('all')
    : selectedValues.length === 1 
      ? selectedValues[0]
      : `${selectedValues[0]} 외 ${selectedValues.length - 1}개`;

  return (
    <div className="flex flex-col items-start w-full" ref={dropdownRef}>
      <span className="text-xs text-zinc-400 mb-0.5">{label}</span>
      <div className="relative w-full">
        <button
          type="button"
          className="bg-zinc-900 border border-zinc-700 rounded-lg h-10 px-3 text-[13px] text-zinc-100 focus:outline-none focus:border-[#111167] w-full text-left flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="truncate">{displayText}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg max-h-48 overflow-y-auto z-50">
            {options.map(option => (
              <div
                key={option}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-[#111113] flex items-center ${
                  selectedValues.includes(option) ? 'bg-[#111113] text-[#9999cc]' : 'text-white'
                }`}
                onClick={() => handleOptionClick(option)}
              >
                <div className={`w-3 h-3 mr-2 border rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedValues.includes(option) ? 'bg-[#111167] border-[#111167]' : 'border-zinc-400'
                }`}>
                </div>
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 커스텀 월 선택기 컴포넌트
function CustomMonthPicker({
  label,
  value,
  onChange,
  td
}: {
  label: string;
  value: string; // YYYY-MM 형태
  onChange: (value: string) => void;
  td: (key: string) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // value를 년/월로 파싱
  const parseValue = (val: string) => {
    if (!val) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    const [year, month] = val.split('-').map(Number);
    return { year: year || new Date().getFullYear(), month: month || new Date().getMonth() + 1 };
  };
  
  const { year: selectedYear, month: selectedMonth } = parseValue(value);
  
  // 옵션 생성
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear - 3; year <= currentYear + 1; year++) {
    years.push(year);
  }
  
  const months = [];
  for (let month = 1; month <= 12; month++) {
    months.push({
      value: month,
      label: month.toString()
    });
  }
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleYearMonthSelect = (newYear: number, newMonth: number) => {
    const newValue = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    onChange(newValue);
    setIsOpen(false);
  };
  
  const displayValue = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  
  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex flex-col items-start min-w-[120px]">
        <span className="text-xs text-zinc-400 mb-0.5">{label}</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg h-10 px-3 text-[13px] text-zinc-100 focus:outline-none focus:border-[#111167] w-full text-left flex items-center justify-between hover:border-zinc-600 transition-colors"
        >
          <span className="text-white">{displayValue}</span>
          <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg z-50 min-w-[200px]">
            <div className="p-2">
              <div className="text-xs text-zinc-400 mb-2">{td('year')}</div>
              <div className="grid grid-cols-2 gap-1 mb-3">
                {years.map(year => (
                  <button
                    key={year}
                    onClick={() => handleYearMonthSelect(year, selectedMonth)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      year === selectedYear 
                        ? 'bg-[#111167] text-white' 
                        : 'text-zinc-300 hover:bg-[#111113]'
                    }`}
                  >
                                         {year}
                  </button>
                ))}
              </div>
              
              <div className="text-xs text-zinc-400 mb-2">{td('month')}</div>
              <div className="grid grid-cols-3 gap-1">
                {months.map(month => (
                  <button
                    key={month.value}
                    onClick={() => handleYearMonthSelect(selectedYear, month.value)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      month.value === selectedMonth 
                        ? 'bg-[#111167] text-white' 
                        : 'text-zinc-300 hover:bg-[#111113]'
                    }`}
                  >
                    {month.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 단일 선택 드롭다운 컴포넌트 (토글 기능 포함)
function SingleSelectDropdown({ 
  label, 
  options, 
  selectedValue, 
  onSelectionChange, 
  placeholder = undefined
}: {
  label: string;
  options: string[];
  selectedValue: string;
  onSelectionChange: (value: string) => void;
  placeholder?: string;
}) {
  const td = useTranslations('dashboard');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (option: string) => {
    if (selectedValue === option) {
      onSelectionChange(td('all'));
    } else {
      // 선택되지 않은 항목이면 해당 값 선택
      onSelectionChange(option);
    }
    setIsOpen(false);
  };

  const displayText = selectedValue === td('all') || selectedValue === (placeholder || td('all')) ? td('all') : selectedValue;

  return (
    <div className="flex flex-col items-start w-full" ref={dropdownRef}>
      <span className="text-xs text-zinc-400 mb-0.5">{label}</span>
      <div className="relative w-full">
        <button
          type="button"
          className="bg-zinc-900 border border-zinc-700 rounded-lg h-10 px-3 text-[13px] text-zinc-100 focus:outline-none focus:border-[#111167] w-full text-left flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="truncate">{displayText}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg max-h-48 overflow-y-auto z-50">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-400">
                {td('noData')}
              </div>
            ) : (
              options.map(option => (
                <div
                  key={option}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-[#111113] flex items-center ${
                    selectedValue === option ? 'bg-[#111113] text-[#9999cc]' : 'text-white'
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  <div className={`w-3 h-3 mr-2 border rounded-full flex items-center justify-center flex-shrink-0 ${
                    selectedValue === option ? 'bg-[#111167] border-[#111167]' : 'border-zinc-400'
                  }`}>
                  </div>
                  {option}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 빈 대시보드 데이터 구조
const getEmptyDashboardData = () => ({
  kpi: { total: 0, inProgress: 0, delayed: 0, closed: 0, dueSoon: 0 },
  corporations: [],
  customers: [],
  customerContacts: [],
  managers: [],
  carList: [],
  worstScore: [],
  worstDelay: [],
  allCarList: []
});

export default function DashboardPage() {
  // 번역 훅
  const t = useTranslations('auth');
  const td = useTranslations('dashboard');
  

  
  // 상태 관리
  const [user, setUser] = useState<RoleUser | null>(null);
  const [data, setData] = useState<any>(getEmptyDashboardData());
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerGroups, setCustomerGroups] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  
  // 🎯 기간 필터 기본값 설정 (최근 6개월)
  const getDefaultDateRange = () => {
    const now = new Date();
    const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 6개월 전
    const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    
    return { startMonth, endMonth };
  };

  // 데이터 범위 상태 (실제 CAR 데이터의 최초/최종월)
  const [dataDateRange, setDataDateRange] = useState<{firstMonth: string, lastMonth: string} | null>(null);
  
  // 필터 상태 (기본값으로 최근 6개월 설정)
  const defaultDateRange = getDefaultDateRange();
  const [filters, setFilters] = useState({
    corp: td('all'),
    customerGroups: [] as string[], // 복수 선택으로 변경
    dept: td('all'),
    status: td('all'),
    startMonth: defaultDateRange.startMonth,
    endMonth: defaultDateRange.endMonth,
    manager: ''
  });
  const [filteredFilters, setFilteredFilters] = useState(filters);

  // 차트/모달 상태
  const [chartTab, setChartTab] = useState<'score'|'sentiment'>('score');
  const [groupTab, setGroupTab] = useState<'company'|'customer'|'manager'>('company');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // CAR 상세 정보 모달 상태
  const [carDetailModalOpen, setCarDetailModalOpen] = useState(false);
  const [carDetailData, setCarDetailData] = useState<any>(null);
  const [carDetailLoading, setCarDetailLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 누적 Score 데이터 상태 추가
  const [accumulatedScores, setAccumulatedScores] = useState<any[]>([]);
  const [accumulatedLoading, setAccumulatedLoading] = useState(false);
  
  // 고객사 카드용 누적 점수 상태 추가
  const [customerAccumulatedScores, setCustomerAccumulatedScores] = useState<any[]>([]);
  const [customerAccumulatedLoading, setCustomerAccumulatedLoading] = useState(false);

  // 📈 월별 추이 데이터 상태
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [monthlyTrendLoading, setMonthlyTrendLoading] = useState(false);

  // 🔽 테이블 정렬 상태 (기본: issue date 최신순)
  const [allCarListSort, setAllCarListSort] = useState<TableSortConfig>({
    column: 'date',
    direction: 'desc'
  });
  
  // 🔽 정렬된 전체 CAR 목록 생성
  const sortedAllCarList = useMemo(() => {
    if (!data.allCarList) return [];
    return sortTableData(data.allCarList, allCarListSort.column, allCarListSort.direction);
  }, [data.allCarList, allCarListSort]);
  
  // 🔢 페이지네이션 상태 추가 (정렬된 데이터 사용)
  const allCarListPagination = usePagination(sortedAllCarList, 15);

  // 🎯 차트 클릭 상태 관리
  const [chartSyncLoading, setChartSyncLoading] = useState(false);
  const [activeManagerFilter, setActiveManagerFilter] = useState<string>('');
  const [activeCompanyFilter, setActiveCompanyFilter] = useState<string>(''); // ✅ 법인 필터 추가
  const [activeCustomerFilter, setActiveCustomerFilter] = useState<string>(''); // ✅ 고객사 필터 추가

  // ✅ 통합된 CAR 상태 계산 함수 사용 (백엔드와 동일한 로직)

  // ✅ Status 기반 집계를 위한 useMemo (KPI와 동일한 데이터 소스 사용)
  const statusCounts = useMemo(() => {
    // 기본 데이터가 없으면 빈 구조 사용  
    const currentData = data || { kpi: { inProgress: 0, delayed: 0, closed: 0 } };
  
    // KPI 데이터와 동일한 소스를 사용하여 데이터 정합성 보장
    return {
      IN_PROGRESS: currentData.kpi.inProgress || 0,
      DELAYED: currentData.kpi.delayed || 0,
      CLOSED: currentData.kpi.closed || 0
      };
  }, [data]);

  // 상태별 총합 계산
  const totalCars = Object.values(statusCounts).reduce((sum: number, count: number) => sum + count, 0);

  // 퍼센트 계산 함수
  const getPercentage = (count: number) => {
    if (totalCars === 0) return '0.0';
    return ((count / totalCars) * 100).toFixed(1);
  };

  // 누적 기간 반영 Score 계산 함수
  const calculateAccumulatedScore = (car: any, targetYear: number, targetMonth: number) => {
    const score = car.calculatedScore || car.score || 0;
    const eventType = car.eventType;
    
    if (!car.issueDate && !car.completionDate) return 0;
    
    let startDate: Date;
    let duration: number; // 개월 수

    if (eventType === 'ONE_TIME') {
      // ONE_TIME: issueDate로부터 6개월간
      startDate = new Date(Number(car.issueDate));
      duration = 6;
    } else if (eventType === 'CONTINUOUS') {
      // CONTINUOUS: completionDate로부터 12개월간
      if (!car.completionDate) return 0;
      startDate = new Date(Number(car.completionDate));
      duration = 12;
    } else {
      return 0;
    }

    // 유효하지 않은 날짜 체크
    if (isNaN(startDate.getTime())) return 0;

    // targetDate가 startDate ~ startDate+duration 범위에 있는지 확인
    const targetDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + duration, 0);
    
    if (targetDate >= startDate && targetDate <= endDate) {
      return score;
    }
    return 0;
  };

  // 사용자 정보 로드
  useEffect(() => {
    setUser(getCurrentUser() as RoleUser | null);
  }, []);

  // 🎯 CAR 데이터에서 실제 날짜 범위 계산 함수
  const calculateDataDateRange = (cars: any[]) => {
    if (!cars || cars.length === 0) return null;
    
    const dates = cars
      .map(car => {
        const issueDate = car.issueDate;
        if (!issueDate) return null;
        
        // Unix timestamp를 Date로 변환
        const date = typeof issueDate === 'string' 
          ? new Date(parseInt(issueDate))
          : new Date(issueDate);
          
        return isNaN(date.getTime()) ? null : date;
      })
      .filter(date => date !== null)
      .sort((a, b) => a!.getTime() - b!.getTime());
    
    if (dates.length === 0) return null;
    
    const firstDate = dates[0]!;
    const lastDate = dates[dates.length - 1]!;
    
    const firstMonth = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
    
    return { firstMonth, lastMonth };
  };

  // 대시보드 데이터 로드
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      
      // 기본 상태 목록 미리 설정
      if (statuses.length === 0) {
        setStatuses(['IN_PROGRESS', 'DELAYED', 'CLOSED']);
      }
      
      // 로그인 상태 확인
      if (!isAuthenticated()) {
        setError(td('loginRequired'));
        setLoading(false);
        return;
      }
      
      try {
        // 필터 파라미터 구성
        const params = new URLSearchParams();
        
        // 회사 필터
        if (filteredFilters.corp !== td('all')) {
          params.append('corp', filteredFilters.corp);
        }
        
        // 고객사 복수 선택 필터
        if (filteredFilters.customerGroups.length > 0) {
          filteredFilters.customerGroups.forEach(group => {
            params.append('customerGroup', group);
          });
        }
        
        // 부서 필터
        if (filteredFilters.dept !== td('all')) {
          params.append('dept', filteredFilters.dept);
        }
        
        // 상태 필터
        if (filteredFilters.status !== td('all')) {
          params.append('status', filteredFilters.status);
        }
        
        // 날짜 범위 필터
        if (filteredFilters.startMonth) {
          params.append('startMonth', filteredFilters.startMonth);
        }
        if (filteredFilters.endMonth) {
          params.append('endMonth', filteredFilters.endMonth);
        }
        
        // 담당자 검색 필터
        if (filteredFilters.manager.trim()) {
          params.append('manager', filteredFilters.manager.trim());
        }
        
        // 대시보드용 대용량 데이터 요청
        params.append('limit', '1000');
        
        // 1. CAR 데이터 로드 (필터 적용)
        const carsResponse = await apiFetch(`/api/car?${params.toString()}`);
        
        // API 응답 구조 확인 및 데이터 추출
        let cars = [];
        if (Array.isArray(carsResponse)) {
          cars = carsResponse;
        } else if (carsResponse && carsResponse.items) {
          cars = carsResponse.items;
        } else if (carsResponse && carsResponse.data) {
          cars = carsResponse.data;
        } else {
          console.warn('예상하지 못한 CAR API 응답 구조:', carsResponse);
        }

        // 2. 주간 보고서 데이터 로드 (전략 제언용)
        let weeklyReportData = null;
        try {
          const reportResponse = await apiFetch('/api/report/weekly/latest');
          weeklyReportData = reportResponse;
        } catch (reportError) {
          // 주간 보고서는 선택사항이므로 에러 무시
        }

        // 3. 고객 담당자 데이터 로드 (group, department 필터링용)
        const customersResponse = await apiFetch('/api/customer');
        
        // 고객 데이터 추출
        let customers = [];
        if (Array.isArray(customersResponse)) {
          customers = customersResponse;
        } else if (customersResponse && customersResponse.items) {
          customers = customersResponse.items;
        } else if (customersResponse && customersResponse.data) {
          customers = customersResponse.data;
        } else {
          console.warn('예상하지 못한 고객 API 응답 구조:', customersResponse);
        }
        
        // 고객 그룹 추출 (중복 제거)
        const uniqueGroups = Array.from(new Set(customers.map((c: any) => c.group).filter(Boolean))) as string[];
        setCustomerGroups(uniqueGroups);
        
        // 부서 추출 (중복 제거)
        const uniqueDepartments = Array.from(new Set(customers.map((c: any) => c.department).filter(Boolean))) as string[];
        
        // 부서 데이터가 없으면 기본 부서 사용
        const finalDepartments = uniqueDepartments.length > 0 
          ? uniqueDepartments 
          : ['Purchasing', 'Engineering', 'Quality', 'Production', 'Developing'];
        
        setDepartments(finalDepartments);

        // 4. 데이터 가공 (이제 필터링된 데이터로 처리)
        const processedData = processDashboardData(cars, customers, weeklyReportData);
        
        // 🎯 실제 CAR 데이터 범위 계산 및 저장
        const calculatedRange = calculateDataDateRange(cars);
        if (calculatedRange) {
          setDataDateRange(calculatedRange);
        }
        
        setData(processedData);
        setWeeklyReport(weeklyReportData);
        setError(null);
      } catch (err: any) {
        setError(err.message || td('dataLoadFailure'));
        // 에러 시 빈 데이터로 초기화
        setData(getEmptyDashboardData());
        // 에러 시 기본 상태 목록 강제 설정
        setStatuses(['IN_PROGRESS', 'DELAYED', 'CLOSED']);
        setCustomerGroups([]);
        setDepartments(['Purchasing', 'Engineering', 'Quality', 'Production', 'Developing']);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [filteredFilters]);

  // 누적 Score 데이터 로드 함수 (필터 적용)
  const loadAccumulatedScores = async (customFilters?: any) => {
    try {
      setAccumulatedLoading(true);
      
      // 사용할 필터 결정 (customFilters가 있으면 우선 사용)
      const useFilters = customFilters || filteredFilters;
      
      // 현재 필터의 endMonth 또는 현재 월 사용
      const now = new Date();
      const targetYear = useFilters.endMonth ? new Date(useFilters.endMonth).getFullYear() : now.getFullYear();
      const targetMonth = useFilters.endMonth ? new Date(useFilters.endMonth).getMonth() + 1 : now.getMonth() + 1;
      
      // 필터 파라미터 추가
      const params = new URLSearchParams({
        groupType: groupTab,
        targetYear: String(targetYear),
        targetMonth: String(targetMonth)
      });
      
      // 추가 필터 적용
      if (useFilters.corp !== td('all')) {
        params.append('corp', useFilters.corp);
      }
      if (useFilters.customerGroups.length > 0) {
        useFilters.customerGroups.forEach((group: string) => {
          params.append('customerGroup', group);
        });
      }
      if (useFilters.dept !== td('all')) {
        params.append('dept', useFilters.dept);
      }
      if (useFilters.status !== td('all')) {
        params.append('status', useFilters.status);
      }
      if (useFilters.manager && useFilters.manager.trim()) {
        params.append('manager', useFilters.manager.trim());
      }
      // 🎯 기간 필터 추가
      if (useFilters.startMonth) {
        params.append('startMonth', useFilters.startMonth);
      }
      if (useFilters.endMonth) {
        params.append('endMonth', useFilters.endMonth);
      }
      

      
      const result = await apiFetch(`/api/car/accumulated-scores?${params.toString()}`);
      
      if (result.success) {
        setAccumulatedScores(result.data || []);
      } else {
        throw new Error(result.message || td('accumulatedScoreLoadFailure'));
      }
    } catch (error) {
              console.error('Accumulated Score load error:', error);
      setAccumulatedScores([]);
    } finally {
      setAccumulatedLoading(false);
    }
  };

  // ✅ 초기 로딩 완료 후 누적 스코어 자동 로드 (데이터 있을 때만)
  useEffect(() => {
    if (!loading && data && data.carList && data.carList.length > 0) {
      loadAccumulatedScores();
    }
  }, [loading, data]); // 초기 로딩 완료 시 한 번 실행

  // groupTab 또는 필터 변경 시 누적 Score 다시 로드
  useEffect(() => {
    if (!loading) {
      loadAccumulatedScores();
    }
  }, [groupTab, filteredFilters.endMonth, filteredFilters.corp, filteredFilters.customerGroups, filteredFilters.dept, filteredFilters.status, filteredFilters.manager]);

  // 🎯 담당자 필터 상태 동기화
  useEffect(() => {
    setActiveManagerFilter(filteredFilters.manager);
  }, [filteredFilters.manager]);

  // 고객사 카드용 누적 Score 데이터 로드 함수 (필터 적용)
  const loadCustomerAccumulatedScores = async (customFilters?: any) => {
    try {
      setCustomerAccumulatedLoading(true);
      
      // 사용할 필터 결정 (customFilters가 있으면 우선 사용)
      const useFilters = customFilters || filteredFilters;
      
      // 현재 필터의 endMonth 또는 현재 월 사용
      const now = new Date();
      const targetYear = useFilters.endMonth ? new Date(useFilters.endMonth).getFullYear() : now.getFullYear();
      const targetMonth = useFilters.endMonth ? new Date(useFilters.endMonth).getMonth() + 1 : now.getMonth() + 1;
      
      // 필터 파라미터 추가
      const params = new URLSearchParams({
        groupType: 'customer',
        targetYear: String(targetYear),
        targetMonth: String(targetMonth)
      });
      
      // 추가 필터 적용
      if (useFilters.corp !== td('all')) {
        params.append('corp', useFilters.corp);
      }
      if (useFilters.customerGroups.length > 0) {
        useFilters.customerGroups.forEach((group: string) => {
          params.append('customerGroup', group);
        });
      }
      if (useFilters.dept !== td('all')) {
        params.append('dept', useFilters.dept);
      }
      if (useFilters.status !== td('all')) {
        params.append('status', useFilters.status);
      }
      if (useFilters.manager && useFilters.manager.trim()) {
        params.append('manager', useFilters.manager.trim());
      }
      
      const result = await apiFetch(`/api/car/accumulated-scores?${params.toString()}`);
      
      if (result.success) {
        setCustomerAccumulatedScores(result.data || []);
      } else {
        throw new Error(result.message || td('customerAccumulatedScoreLoadFailure'));
      }
    } catch (error) {
      console.error('Customer accumulated score load error:', error);
      setCustomerAccumulatedScores([]);
    } finally {
      setCustomerAccumulatedLoading(false);
    }
  };

  // 데이터 로드 완료 후 고객사 누적 점수 로드
  useEffect(() => {
    if (!loading && data) {
      loadCustomerAccumulatedScores();
    }
  }, [filteredFilters.startMonth, filteredFilters.endMonth, filteredFilters.corp, filteredFilters.customerGroups, filteredFilters.dept, filteredFilters.status, filteredFilters.manager, data]);

  // 월별 추이 데이터 로드 함수 (필터 적용)
  const loadMonthlyTrendData = async (customFilters?: any) => {
    try {
      setMonthlyTrendLoading(true);
      
      // 사용할 필터 결정 (customFilters가 있으면 우선 사용)
      const useFilters = customFilters || filteredFilters;
      
      // 🎯 개선된 기간 설정 로직
      let startYear, startMonth, endYear, endMonth;
      
      if (useFilters.startMonth && useFilters.endMonth) {
        // 사용자가 기간 필터를 설정한 경우
        const startDate = new Date(useFilters.startMonth);
        const endDate = new Date(useFilters.endMonth);
        
        startYear = startDate.getFullYear();
        startMonth = startDate.getMonth() + 1;
        endYear = endDate.getFullYear();
        endMonth = endDate.getMonth() + 1;
      } else if (useFilters.startMonth) {
        // 시작월만 설정된 경우 - 시작월부터 현재월까지
        const startDate = new Date(useFilters.startMonth);
        const now = new Date();
        
        startYear = startDate.getFullYear();
        startMonth = startDate.getMonth() + 1;
        endYear = now.getFullYear();
        endMonth = now.getMonth() + 1;
      } else if (useFilters.endMonth) {
        // 종료월만 설정된 경우 - 데이터 최초월부터 종료월까지
        const endDate = new Date(useFilters.endMonth);
        endYear = endDate.getFullYear();
        endMonth = endDate.getMonth() + 1;
        
        // 🎯 데이터 범위가 있으면 사용, 없으면 최근 6개월 전
        if (dataDateRange) {
          const firstDate = new Date(dataDateRange.firstMonth);
          startYear = firstDate.getFullYear();
          startMonth = firstDate.getMonth() + 1;
        } else {
          const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 5, 1);
          startYear = startDate.getFullYear();
          startMonth = startDate.getMonth() + 1;
        }
      } else {
        // 🎯 기간 필터가 없는 경우 - 데이터 전체 범위 사용
        if (dataDateRange) {
          // 데이터 범위가 있으면 전체 범위 사용
          const firstDate = new Date(dataDateRange.firstMonth);
          const lastDate = new Date(dataDateRange.lastMonth);
          
          startYear = firstDate.getFullYear();
          startMonth = firstDate.getMonth() + 1;
          endYear = lastDate.getFullYear();
          endMonth = lastDate.getMonth() + 1;
        } else {
          // 데이터 범위가 없으면 기본값 (최근 6개월)
          const now = new Date();
          endYear = now.getFullYear();
          endMonth = now.getMonth() + 1;
          const startDate = new Date(endYear, endMonth - 7, 1);
          startYear = startDate.getFullYear();
          startMonth = startDate.getMonth() + 1;
        }
      }
      
      // 필터 파라미터 추가
      const params = new URLSearchParams({
        groupType: groupTab,
        startYear: String(startYear),
        startMonth: String(startMonth),
        endYear: String(endYear),
        endMonth: String(endMonth)
      });
      
      // 추가 필터 적용
      if (useFilters.corp !== td('all')) {
        params.append('corp', useFilters.corp);
      }
      if (useFilters.customerGroups.length > 0) {
        useFilters.customerGroups.forEach((group: string) => {
          params.append('customerGroup', group);
        });
      }
      if (useFilters.dept !== td('all')) {
        params.append('dept', useFilters.dept);
      }
      if (useFilters.status !== td('all')) {
        params.append('status', useFilters.status);
      }
      if (useFilters.manager && useFilters.manager.trim()) {
        params.append('manager', useFilters.manager.trim());
      }
      
      const result = await apiFetch(`/api/car/monthly-trend?${params.toString()}`);
      
      if (result.success && result.data) {
        setMonthlyTrendData(result.data);
      } else {
        console.warn(td('monthlyTrendUnexpectedResponse'), result);
        setMonthlyTrendData([]);
      }
    } catch (error) {
      console.error('Monthly trend data load error:', error);
      setMonthlyTrendData([]);
    } finally {
      setMonthlyTrendLoading(false);
    }
  };

  // ✅ 초기 로딩 완료 후 월별 추이 데이터 자동 로드
  useEffect(() => {
    if (!loading && data && data.carList && data.carList.length > 0) {
      loadMonthlyTrendData();
    }
  }, [loading, data]); // 초기 로딩 완료 시 한 번 실행

  // groupTab이 변경될 때마다 월별 추이 데이터 로드
  useEffect(() => {
    if (!loading && data) {
      loadMonthlyTrendData();
    }
  }, [groupTab, filteredFilters, dataDateRange]); // 🎯 data 의존성 제거하여 무한 루프 방지



  // 그룹별 누적 Score 집계 (개선된 필터링 로직)
  const calculateGroupAccumulatedScores = (cars: any[], groupType: string) => {
    const now = new Date();
    
    // 🎯 기간 필터 적용
    let targetYear, targetMonth;
    if (filteredFilters.endMonth) {
      const endDate = new Date(filteredFilters.endMonth);
      targetYear = endDate.getFullYear();
      targetMonth = endDate.getMonth() + 1;
    } else {
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }
    
    const groupStats = new Map();

    // 🎯 필터링된 CAR 데이터만 사용
    const filteredCars = cars.filter(car => {
      // 🎯 기간 필터 적용 (가장 중요)
      if (filteredFilters.startMonth || filteredFilters.endMonth) {
        const issueDate = car.issueDate;
        if (issueDate) {
          const carDate = typeof issueDate === 'string' 
            ? new Date(parseInt(issueDate))
            : new Date(issueDate);
            
          if (!isNaN(carDate.getTime())) {
            const carYearMonth = `${carDate.getFullYear()}-${String(carDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (filteredFilters.startMonth && carYearMonth < filteredFilters.startMonth) {
              return false;
            }
            if (filteredFilters.endMonth && carYearMonth > filteredFilters.endMonth) {
              return false;
            }
          }
        }
      }

      // 법인 필터 적용
      if (filteredFilters.corp !== td('all') && car.corporation !== filteredFilters.corp) {
        return false;
      }

      // 고객사 필터 적용 (다중 선택)
      if (filteredFilters.customerGroups.length > 0) {
        const customerContacts = car.carCustomerContacts || car.customerContacts || [];
        const hasMatchingCustomer = customerContacts.some((cc: any) => {
          const group = cc.CustomerContact?.group || cc.customerContact?.group || cc.group;
          return group && filteredFilters.customerGroups.includes(group);
        });
        if (!hasMatchingCustomer) {
          return false;
        }
      }

      // 부서 필터 적용
      if (filteredFilters.dept !== td('all')) {
        const customerContacts = car.carCustomerContacts || car.customerContacts || [];
        const hasMatchingDept = customerContacts.some((cc: any) => {
          const dept = cc.CustomerContact?.department || cc.customerContact?.department || cc.department;
          return dept === filteredFilters.dept;
        });
        if (!hasMatchingDept) {
          return false;
        }
      }

      // 담당자 필터 적용
      if (filteredFilters.manager && filteredFilters.manager.trim()) {
        const customerContacts = car.carCustomerContacts || car.customerContacts || [];
        const hasMatchingManager = customerContacts.some((cc: any) => {
          const managerName = cc.CustomerContact?.name || cc.customerContact?.name || cc.name;
          return managerName === filteredFilters.manager.trim();
        });
        if (!hasMatchingManager) {
          return false;
        }
      }

      // 상태 필터 적용
      if (filteredFilters.status !== td('all') && car.status !== filteredFilters.status) {
        return false;
      }

      return true;
    });

    filteredCars.forEach(car => {
      const accumulatedScore = calculateAccumulatedScore(car, targetYear, targetMonth);
      
      // ✅ 모든 CAR을 포함하도록 수정 (0점도 유효한 데이터)
      // 누적 점수가 있거나 기본 점수가 있으면 포함 (0도 포함)
      const hasAnyScore = accumulatedScore !== undefined || (car.calculatedScore !== undefined || car.score !== undefined);
      if (!hasAnyScore) return; // undefined인 경우만 스킵

      let groupKeys: string[] = [];

      if (groupType === 'company') {
        // 법인별
        groupKeys = [car.corporation || 'Unknown'];
      } else if (groupType === 'customer') {
        // 고객사별 (CustomerContact의 group 기준)
        const customerContacts = car.carCustomerContacts || car.customerContacts || [];
        if (customerContacts.length > 0) {
          customerContacts.forEach((cc: any) => {
            const group = cc.CustomerContact?.group || cc.customerContact?.group || cc.group;
            if (group) groupKeys.push(group);
          });
        }
        if (groupKeys.length === 0) groupKeys = ['Unknown'];
      } else if (groupType === 'manager') {
        // 담당자별 (CustomerContact의 name 기준)
        const customerContacts = car.carCustomerContacts || car.customerContacts || [];
        if (customerContacts.length > 0) {
          customerContacts.forEach((cc: any) => {
            let managerName = null;
            
            if (cc.CustomerContact && cc.CustomerContact.name) {
              managerName = cc.CustomerContact.name;
            } else if (cc.customerContact && cc.customerContact.name) {
              managerName = cc.customerContact.name;
            } else if (cc.name) {
              managerName = cc.name;
            }
            
            if (managerName) {
              groupKeys.push(managerName);
            }
          });
        }
      }

      groupKeys.forEach(groupKey => {
        if (!groupStats.has(groupKey)) {
          groupStats.set(groupKey, {
            name: groupKey,
            score: 0,
            accumulatedScore: 0,
            sentimentScore: 0,
            sentimentCount: 0,
            total: 0,
            eventCount: 0
          });
        }
        
        const group = groupStats.get(groupKey);
        group.accumulatedScore += accumulatedScore;
        group.eventCount += 1;
        group.total += 1;
        // 기존 점수도 유지 (비교용)
        group.score += car.calculatedScore || car.score || 0;
        // ✅ sentiment 점수가 있는 경우만 평균 계산에 포함
        const carSentimentScore = car.sentimentScore || 0;
        if (carSentimentScore > 0) {
          group.sentimentScore += carSentimentScore;
          group.sentimentCount += 1;
        }
      });
    });

    return Array.from(groupStats.values())
      .map(group => ({
        name: group.name,
        score: group.score,
        accumulatedScore: group.accumulatedScore,
        sentimentScore: group.sentimentCount > 0 
          ? Math.round((group.sentimentScore / group.sentimentCount) * 100) / 100 
          : 0,
        total: group.total,
        eventCount: group.eventCount
      }))
      .sort((a, b) => b.accumulatedScore - a.accumulatedScore);
  };

  // 개선된 그룹 데이터 로직: 백엔드 API 데이터 우선 사용 (라인차트와 동일)
  const enhancedGroupData = useMemo(() => {
    // ✅ 백엔드 API 결과 우선 사용 (라인차트와 동일한 데이터 소스)
    if (!accumulatedLoading && accumulatedScores.length > 0) {
      return accumulatedScores;
    }
    
    // 프론트엔드에서 필터링된 데이터가 있고, CAR 데이터가 존재하는 경우 사용
    if (data.carList && data.carList.length > 0) {
      return calculateGroupAccumulatedScores(data.carList, groupTab);
    }
    
    // 기존 처리된 데이터 사용 (fallback)
    return (
      groupTab === 'company' ? data.corporations :
      groupTab === 'customer' ? data.customers :
      groupTab === 'manager' ? data.managers :
      data.customerContacts
    );
  }, [accumulatedLoading, accumulatedScores, data.carList, data.corporations, data.customers, data.managers, data.customerContacts, groupTab, filteredFilters]);

  const sortedGroup = useMemo(() => {
    return [...enhancedGroupData]
      .sort((a, b) => {
        const scoreA = a.accumulatedScore !== undefined ? a.accumulatedScore : a.score;
        const scoreB = b.accumulatedScore !== undefined ? b.accumulatedScore : b.score;
        return scoreB - scoreA || b.total - a.total || a.name.localeCompare(b.name, 'ko-KR');
      })
      .filter(item => {
        // 점수가 있는 항목만 필터링 (0도 포함)
        const score = item.accumulatedScore !== undefined ? item.accumulatedScore : item.score;
        return score !== undefined && score !== null;
      });
  }, [enhancedGroupData, groupTab, chartTab]);



  // 상태별 PieChart 데이터
  const pieData = {
    labels: Object.keys(statusCounts).map(status => {
      const count = statusCounts[status as keyof typeof statusCounts];
      const percentage = getPercentage(count);
      const translatedStatus = status === 'IN_PROGRESS' ? td('inProgress') :
                               status === 'DELAYED' ? td('delayed') :
                               status === 'CLOSED' ? td('closed') : status;
      return `${translatedStatus} ${percentage}%`;
    }),
    datasets: [{
      data: Object.values(statusCounts),
      backgroundColor: [
        '#38bdf8', // IN_PROGRESS - sky-400
        '#fb923c', // DELAYED - orange-400
        '#34d399', // CLOSED - emerald-400
      ],
      hoverBackgroundColor: [
        '#7dd3fc', // sky-300
        '#fdba74', // orange-300
        '#6ee7b7', // emerald-300
      ],
      borderWidth: 0,
      spacing: 2,
    }],
  };

  const pieOptions = {
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(9, 9, 11, 0.95)',
        titleColor: '#e4e4e7',
        bodyColor: '#fff',
        borderColor: 'rgba(63, 63, 70, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        bodyFont: { size: 12 },
        callbacks: {
          label: function(context: any) {
            const status = Object.keys(statusCounts)[context.dataIndex];
            const count = context.parsed;
            const percentage = getPercentage(count);
            const translatedStatus = status === 'IN_PROGRESS' ? td('inProgress') :
                                     status === 'DELAYED' ? td('delayed') :
                                     status === 'CLOSED' ? td('closed') : status;
            return `${translatedStatus}: ${count}${td('items')} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '65%',
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 0
    },
    hover: {
      mode: 'nearest' as const,
      intersect: true
    },
    animation: {
      animateRotate: true,
      animateScale: false,
    }
  };

  const barData = chartTab === 'score' ? {
    labels: sortedGroup.map(g => g.name),
    datasets: [{
      label: '누적 Score 합계',
      data: sortedGroup.map(g => {
        const score = g.accumulatedScore !== undefined ? g.accumulatedScore : g.score;
        return score || 0; // undefined/null인 경우 0으로 처리
      }),
      backgroundColor: sortedGroup.map(g => {
        // 🎯 모든 그룹 타입에서 활성 필터와 일치하는 Bar 강조
        const isActive = (
          (groupTab === 'manager' && activeManagerFilter && g.name === activeManagerFilter) ||
          (groupTab === 'company' && activeCompanyFilter && g.name === activeCompanyFilter) ||
          (groupTab === 'customer' && filteredFilters.customerGroups.includes(g.name)) // ✅ 선택된 모든 고객사 강조
        );
        return isActive ? '#fbbf24' : '#60a5fa';
      }),
      hoverBackgroundColor: sortedGroup.map(g => {
        const isActive = (
          (groupTab === 'manager' && activeManagerFilter && g.name === activeManagerFilter) ||
          (groupTab === 'company' && activeCompanyFilter && g.name === activeCompanyFilter) ||
          (groupTab === 'customer' && filteredFilters.customerGroups.includes(g.name))
        );
        return isActive ? '#fcd34d' : '#93c5fd';
      }),
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 8,
      borderSkipped: false,
    }],
  } : {
    labels: sortedGroup.map(g => g.name),
    datasets: [{
      label: 'SentimentScore 합계',
      data: sortedGroup.map(g => g.sentimentScore !== undefined ? g.sentimentScore : 0),
      backgroundColor: sortedGroup.map(g => {
        const isActive = (
          (groupTab === 'manager' && activeManagerFilter && g.name === activeManagerFilter) ||
          (groupTab === 'company' && activeCompanyFilter && g.name === activeCompanyFilter) ||
          (groupTab === 'customer' && filteredFilters.customerGroups.includes(g.name))
        );
        return isActive ? '#fbbf24' : '#a78bfa';
      }),
      hoverBackgroundColor: sortedGroup.map(g => {
        const isActive = (
          (groupTab === 'manager' && activeManagerFilter && g.name === activeManagerFilter) ||
          (groupTab === 'company' && activeCompanyFilter && g.name === activeCompanyFilter) ||
          (groupTab === 'customer' && filteredFilters.customerGroups.includes(g.name))
        );
        return isActive ? '#fcd34d' : '#c4b5fd';
      }),
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 8,
      borderSkipped: false,
    }],
  };

  const barOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(9, 9, 11, 0.95)',
        titleColor: '#e4e4e7',
        bodyColor: '#fff',
        borderColor: 'rgba(63, 63, 70, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        bodyFont: { size: 12 },
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value.toFixed(1)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#a1a1aa',
          maxRotation: 45,
          minRotation: 0,
          font: { size: 11 }
        },
        grid: { color: 'rgba(39, 39, 42, 0.5)', drawBorder: false },
        border: { display: false }
      },
      y: {
        ticks: {
          color: '#a1a1aa',
          font: { size: 11 }
        },
        grid: { color: 'rgba(39, 39, 42, 0.5)', drawBorder: false },
        border: { display: false }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    elements: {
      bar: {
        borderWidth: 0
      }
    },
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 5,
        right: 5
      }
    },
    hover: {
      mode: 'nearest' as const,
      intersect: true
    }
  };

  // 라인 차트 데이터 (그룹별 다중 Line 구성)
  const lineData = useMemo(() => {
    if (!monthlyTrendData || monthlyTrendData.length === 0) {
      return { labels: [], datasets: [] };
    }

    // 🎯 개선된 월별 라벨 추출 (YYYY-MM 형식) - 국제 표준 형식으로 통일
    const labels = monthlyTrendData.map(item => {
      // YYYY-MM 형식으로 통일 (기간 필터와 동일한 형식)
      const year = item.year || '';
      const month = String(item.monthKey || '').padStart(2, '0');
      return `${year}-${month}`;
    });
    
    // 모든 그룹 이름 수집 (모든 월에서 나타나는 그룹들)
    const allGroups = new Set<string>();
    monthlyTrendData.forEach(monthData => {
      if (monthData.groups && Array.isArray(monthData.groups)) {
        monthData.groups.forEach((group: any) => allGroups.add(group.name));
      }
    });

    // 색상 팔레트 (최대 10개 그룹용)
    const colorPalette = [
      '#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa',
      '#fb923c', '#22d3ee', '#a3e635', '#f472b6', '#818cf8'
    ];

    // 그룹별 데이터셋 생성
    const datasets = Array.from(allGroups).map((groupName, index) => {
      const color = colorPalette[index % colorPalette.length];
      
      // 각 월별로 해당 그룹의 데이터 추출
      const groupData = monthlyTrendData.map(monthData => {
        if (!monthData.groups || !Array.isArray(monthData.groups)) return 0;
        
        const groupInfo = monthData.groups.find((g: any) => g.name === groupName);
        if (!groupInfo) return 0;
        
        return chartTab === 'score' 
          ? Number(groupInfo.score) || 0
          : Number(groupInfo.sentimentScore) || 0;
      });

      return {
        label: String(groupName),
        data: groupData,
        borderColor: color,
        backgroundColor: `${color}18`,
        tension: 0.4,
        pointBackgroundColor: color,
        pointBorderColor: '#09090b',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: color,
        pointHoverBorderWidth: 2,
        fill: true,
        borderWidth: 2.5,
      };
    });

    return { labels, datasets };
  }, [monthlyTrendData, chartTab]);

  const lineOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(9, 9, 11, 0.95)',
        titleColor: '#e4e4e7',
        bodyColor: '#fff',
        borderColor: 'rgba(63, 63, 70, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        bodyFont: { size: 12 },
        position: 'nearest' as const,
        xAlign: 'left' as const,
        yAlign: 'center' as const,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            const datasetLabel = context.dataset.label;
            return `${datasetLabel} : ${value.toFixed(1)}`;
          },
          title: function(tooltipItems: any[]) {
            return tooltipItems[0]?.label || '';
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#a1a1aa',
          font: { size: 11 }
        },
        grid: { color: 'rgba(39, 39, 42, 0.5)', drawBorder: false },
        border: { display: false }
      },
      y: {
        ticks: {
          color: '#a1a1aa',
          font: { size: 11 }
        },
        grid: { color: 'rgba(39, 39, 42, 0.5)', drawBorder: false },
        border: { display: false },
        beginAtZero: true
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    elements: {
      line: {
        borderWidth: 2.5
      },
      point: {
        hoverBorderWidth: 2
      }
    },
    hover: {
      mode: 'nearest' as const,
      intersect: true
    }
  };

  // 데이터 가공 함수 (개선된 필터링 로직)
  const processDashboardData = (cars: any[], customers: any[], weeklyReport: any) => {
    // 1. 모든 CAR 데이터에 동적 상태 추가
    const carsWithStatus = cars.map((car, index) => {
      try {
        const status = calculateCarStatus(car);
        return {
          ...car,
          status
        };
      } catch (error) {
        console.error(`CAR ${index} 처리 에러:`, error, car);
        return {
          ...car,
          status: 'IN_PROGRESS'
        };
      }
    });

    // 🎯 필터링된 CAR 데이터 생성
    const filteredCarsWithStatus = carsWithStatus.filter(car => {
      // 🎯 기간 필터 적용 (가장 중요)
      if (filteredFilters.startMonth || filteredFilters.endMonth) {
        const issueDate = car.issueDate;
        if (issueDate) {
          const carDate = typeof issueDate === 'string' 
            ? new Date(parseInt(issueDate))
            : new Date(issueDate);
            
          if (!isNaN(carDate.getTime())) {
            const carYearMonth = `${carDate.getFullYear()}-${String(carDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (filteredFilters.startMonth && carYearMonth < filteredFilters.startMonth) {
              return false;
            }
            if (filteredFilters.endMonth && carYearMonth > filteredFilters.endMonth) {
              return false;
            }
          }
        }
      }

      // 법인 필터 적용
      if (filteredFilters.corp !== td('all') && car.corporation !== filteredFilters.corp) {
        return false;
      }

      // 고객사 필터 적용 (다중 선택)
      if (filteredFilters.customerGroups.length > 0) {
        const customerContacts = car.carCustomerContacts || car.customerContacts || [];
        const hasMatchingCustomer = customerContacts.some((cc: any) => {
          const group = cc.CustomerContact?.group || cc.customerContact?.group || cc.group;
          return group && filteredFilters.customerGroups.includes(group);
        });
        if (!hasMatchingCustomer) {
          return false;
        }
      }

      // 부서 필터 적용
      if (filteredFilters.dept !== td('all')) {
        const customerContacts = car.carCustomerContacts || car.customerContacts || [];
        const hasMatchingDept = customerContacts.some((cc: any) => {
          const dept = cc.CustomerContact?.department || cc.customerContact?.department || cc.department;
          return dept === filteredFilters.dept;
        });
        if (!hasMatchingDept) {
          return false;
        }
      }

      // 담당자 필터 적용 (부분 검색 및 복수 검색어 지원)
      if (filteredFilters.manager && filteredFilters.manager.trim()) {
        const searchTerms = filteredFilters.manager.split(',').map(term => term.trim().toLowerCase()).filter(Boolean);
        const customerContacts = car.carCustomerContacts || car.customerContacts || [];
        
        const hasMatchingManager = searchTerms.some(searchTerm => {
          // 1. 고객 담당자 검색
          const hasCustomerMatch = customerContacts.some((cc: any) => {
            const managerName = cc.CustomerContact?.name || cc.customerContact?.name || cc.name;
            return managerName && managerName.toLowerCase().includes(searchTerm);
          });
          
          // 2. 내부 담당자 검색
          const internalContact = car.internalContact || '';
          const hasInternalMatch = internalContact.toLowerCase().includes(searchTerm);
          
          return hasCustomerMatch || hasInternalMatch;
        });
        
        if (!hasMatchingManager) {
          return false;
        }
      }

      // 상태 필터 적용
      if (filteredFilters.status !== td('all') && car.status !== filteredFilters.status) {
        return false;
      }

      return true;
    });

    // 2. 고유 상태 목록 추출
    // 상태는 하드코딩된 값 사용 (번역 키 오류 방지)
    const finalStatuses = ['IN_PROGRESS', 'DELAYED', 'CLOSED'];
    setStatuses(finalStatuses);

    // KPI 계산 (필터링된 데이터 기준)
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const kpi = {
      total: filteredCarsWithStatus.length,
      inProgress: filteredCarsWithStatus.filter(car => car.status === 'IN_PROGRESS').length,
      delayed: filteredCarsWithStatus.filter(car => car.status === 'DELAYED').length, 
      closed: filteredCarsWithStatus.filter(car => car.status === 'CLOSED').length,
      dueSoon: filteredCarsWithStatus.filter(car => {
        if (!car.dueDate) return false;
        
        // Unix timestamp 처리
        let dueDate;
        if (typeof car.dueDate === 'string') {
          dueDate = new Date(parseInt(car.dueDate));
        } else {
          dueDate = new Date(car.dueDate);
        }
        
        if (isNaN(dueDate.getTime())) return false; // 유효하지 않은 날짜 제외
        return dueDate <= threeDaysLater && dueDate >= now;
      }).length
    };

    // 법인별 집계 (필터링된 데이터 기준)
    const corporationStats: { [key: string]: any } = {};
    filteredCarsWithStatus.forEach(car => {
      const corp = car.corporation || 'Unknown';
      if (!corporationStats[corp]) {
        corporationStats[corp] = { name: corp, total: 0, score: 0, sentimentScore: 0, eventCount: 0 };
      }
      corporationStats[corp].total++;
      corporationStats[corp].eventCount++;
      corporationStats[corp].score += car.calculatedScore || 0;
      corporationStats[corp].sentimentScore += (car.internalScore || 0) + (car.customerScore || 0);
    });
    const corporations = Object.values(corporationStats);

    // 고객사별 집계 (필터링된 데이터 기준)
    const customerStats: { [key: string]: any } = {};
    
    filteredCarsWithStatus.forEach(car => {
      let customerGroup = 'Unknown';
      
      // CAR의 customerContacts 또는 carCustomerContacts 배열에서 고객사 정보 추출
      const customerContacts = car.customerContacts || car.carCustomerContacts || [];
      
      if (Array.isArray(customerContacts) && customerContacts.length > 0) {
        // 첫 번째 customerContact의 정보 사용
        const firstContact = customerContacts[0];
        if (firstContact && firstContact.customerContact) {
          // customerContact 객체에서 group 추출
          customerGroup = firstContact.customerContact.group || 'Unknown';
        } else if (firstContact && firstContact.group) {
          // 직접 group 필드가 있는 경우
          customerGroup = firstContact.group;
        }
      }
      
      if (!customerStats[customerGroup]) {
        customerStats[customerGroup] = { 
          name: customerGroup, 
          total: 0, 
          score: 0, 
          sentimentScore: 0, 
          eventCount: 0 
        };
      }
      customerStats[customerGroup].total++;
      customerStats[customerGroup].eventCount++;
      customerStats[customerGroup].score += car.calculatedScore || 0;
      customerStats[customerGroup].sentimentScore += (car.internalScore || 0) + (car.customerScore || 0);
    });
    
    const customersData = Object.values(customerStats);

    // 담당자별 집계 (필터링된 데이터 기준)
    const managerStats: { [key: string]: any } = {};
    filteredCarsWithStatus.forEach(car => {
      const customerContacts = car.customerContacts || car.carCustomerContacts || [];
      
      if (Array.isArray(customerContacts) && customerContacts.length > 0) {
        customerContacts.forEach((contact: any) => {
          let managerName = null;
          
          if (contact && contact.customerContact && contact.customerContact.name) {
            // customerContact 객체에서 name 추출
            managerName = contact.customerContact.name;
          } else if (contact && contact.name) {
            // 직접 name 필드가 있는 경우
            managerName = contact.name;
          }
          
          if (managerName) {
            if (!managerStats[managerName]) {
              managerStats[managerName] = { name: managerName, total: 0, score: 0, sentimentScore: 0, eventCount: 0 };
            }
            managerStats[managerName].total++;
            managerStats[managerName].eventCount++;
            managerStats[managerName].score += car.calculatedScore || 0;
            managerStats[managerName].sentimentScore += (car.internalScore || 0) + (car.customerScore || 0);
          }
        });
      }
    });
    const managersData = Object.values(managerStats);

    // Worst Score/Delay 계산 (필터링된 데이터 기준)
    
    const worstScore = [...filteredCarsWithStatus]
      .filter(car => car.status === 'CLOSED') // status가 CLOSED인 항목만 필터링
      .filter(car => (car.calculatedScore !== undefined && car.calculatedScore !== null) || (car.score !== undefined && car.score !== null))
      .sort((a, b) => (a.calculatedScore || a.score || 0) - (b.calculatedScore || b.score || 0))
      .slice(0, 5)
      .map(car => {
        // customerContacts에서 고객사, 부서, 고객 담당자 정보 추출
        let customerGroup = 'Unknown';
        let customerDepartment = 'Unknown';
        let customerManager = 'Unknown';
        
        const customerContacts = car.customerContacts || car.carCustomerContacts || [];
        if (Array.isArray(customerContacts) && customerContacts.length > 0) {
          const firstContact = customerContacts[0];
          if (firstContact && firstContact.customerContact) {
            customerGroup = firstContact.customerContact.group || 'Unknown';
            customerDepartment = firstContact.customerContact.department || 'Unknown';
          } else if (firstContact) {
            customerGroup = firstContact.group || 'Unknown';
            customerDepartment = firstContact.department || 'Unknown';
          }
          
          // 모든 고객 담당자 수집 (복수 처리)
          const managers = customerContacts
            .map(contact => {
              if (contact && contact.customerContact && contact.customerContact.name) {
                return contact.customerContact.name;
              } else if (contact && contact.name) {
                return contact.name;
              }
              return null;
            })
            .filter(name => name !== null && name.trim() !== '');
          
          customerManager = managers.length > 0 ? managers.join(', ') : 'Unknown';
        }
        

        
        // 내부 담당자 정보 추출
        let internalManager = 'Unknown';
        if (car.internalContact && car.internalContact.trim() !== '') {
          internalManager = car.internalContact;
        } else if (car.creator && car.creator.name) {
          internalManager = car.creator.name;
        }
        

        
        // issueDate 포맷팅 (Unix timestamp → 날짜)
        let formattedDate = 'Unknown';
        if (car.issueDate) {
          try {
            const dateValue = typeof car.issueDate === 'string' 
              ? parseInt(car.issueDate) 
              : car.issueDate;
            const date = new Date(dateValue);
            
            if (!isNaN(date.getTime())) {
              formattedDate = date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }).replace(/\. /g, '-').replace('.', '');
            }
          } catch (error) {
            console.warn('날짜 포맷팅 실패:', car.issueDate);
          }
        }
        
        return {
          id: car.id,
          date: formattedDate,
          customer: customerGroup,
          dept: customerDepartment,
          customerManager: customerManager,
          internalManager: internalManager,
          score: car.calculatedScore || car.score || 0,
          originalCar: car // 원본 데이터 보관
        };
      });



    const worstDelay = filteredCarsWithStatus
      .filter(car => car.dueDate && car.status !== 'CLOSED')
      .map(car => {
        // Unix timestamp 처리
        let due, issue;
        
        if (typeof car.dueDate === 'string') {
          due = new Date(parseInt(car.dueDate));
        } else {
          due = new Date(car.dueDate);
        }
        
        if (typeof car.issueDate === 'string') {
          issue = new Date(parseInt(car.issueDate));
        } else {
          issue = new Date(car.issueDate);
        }
        
        // 날짜 유효성 검사
        if (isNaN(due.getTime()) || isNaN(issue.getTime())) {
          return null;
        }
        
        const delay = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...car,
          delay
        };
      })
      .filter(car => car !== null && car.delay > 0)
      .sort((a, b) => b.delay - a.delay)
      .slice(0, 5)
      .map(car => {
        // 날짜 포맷팅 함수
        const formatDate = (dateValue: any) => {
          let date;
          if (typeof dateValue === 'string') {
            date = new Date(parseInt(dateValue));
          } else {
            date = new Date(dateValue);
          }
          
          if (isNaN(date.getTime())) {
            return 'Invalid Date';
          }
          
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        // customerContacts에서 고객사, 부서, 고객 담당자 정보 추출 (Score Worst 5와 동일한 로직)
        let customerGroup = 'Unknown';
        let customerDepartment = 'Unknown';
        let customerManager = 'Unknown';
        
        const customerContacts = car.customerContacts || car.carCustomerContacts || [];
        if (Array.isArray(customerContacts) && customerContacts.length > 0) {
          const firstContact = customerContacts[0];
          if (firstContact && firstContact.customerContact) {
            customerGroup = firstContact.customerContact.group || 'Unknown';
            customerDepartment = firstContact.customerContact.department || 'Unknown';
          } else if (firstContact) {
            customerGroup = firstContact.group || 'Unknown';
            customerDepartment = firstContact.department || 'Unknown';
          }
          
          // 모든 고객 담당자 수집 (복수 처리)
          const managers = customerContacts
            .map(contact => {
              if (contact && contact.customerContact && contact.customerContact.name) {
                return contact.customerContact.name;
              } else if (contact && contact.name) {
                return contact.name;
              }
              return null;
            })
            .filter(name => name !== null && name.trim() !== '');
          
          customerManager = managers.length > 0 ? managers.join(', ') : 'Unknown';
        }

        // 내부 담당자 정보 추출
        let internalManager = 'Unknown';
        if (car.internalContact && car.internalContact.trim() !== '') {
          internalManager = car.internalContact;
        } else if (car.creator && car.creator.name) {
          internalManager = car.creator.name;
        }

        // 완료일 정보 추출
        let completionDate = '-';
        if (car.completionDate) {
          completionDate = formatDate(car.completionDate);
        }

        return {
          id: car.id,
          date: formatDate(car.issueDate),
          customer: customerGroup,
          dept: customerDepartment,
          customerManager: customerManager,
          internalManager: internalManager,
          due: formatDate(car.dueDate),
          completion: completionDate,
          delay: car.delay,
          originalCar: car // 원본 데이터 보관
        };
      });

    // 전체 CAR 목록 생성 (필터링된 데이터 기준)
    const allCarList = filteredCarsWithStatus.map(car => {
      // 날짜 포맷팅 함수
      const formatDate = (dateValue: any) => {
        if (!dateValue) return '-';
        let date;
        if (typeof dateValue === 'string') {
          date = new Date(parseInt(dateValue));
        } else {
          date = new Date(dateValue);
        }
        
        if (isNaN(date.getTime())) {
          return '-';
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // customerContacts에서 고객사, 부서, 고객 담당자 정보 추출
      let customerGroup = 'Unknown';
      let customerDepartment = 'Unknown';
      let customerManager = 'Unknown';
      
      const customerContacts = car.customerContacts || car.carCustomerContacts || [];
      if (Array.isArray(customerContacts) && customerContacts.length > 0) {
        const firstContact = customerContacts[0];
        if (firstContact && firstContact.customerContact) {
          customerGroup = firstContact.customerContact.group || 'Unknown';
          customerDepartment = firstContact.customerContact.department || 'Unknown';
        } else if (firstContact) {
          customerGroup = firstContact.group || 'Unknown';
          customerDepartment = firstContact.department || 'Unknown';
        }
        
        // 모든 고객 담당자 수집 (복수 처리)
        const managers = customerContacts
          .map(contact => {
            if (contact && contact.customerContact && contact.customerContact.name) {
              return contact.customerContact.name;
            } else if (contact && contact.name) {
              return contact.name;
            }
            return null;
          })
          .filter(name => name !== null && name.trim() !== '');
        
        customerManager = managers.length > 0 ? managers.join(', ') : 'Unknown';
      }

      // 내부 담당자 정보 추출
      let internalManager = 'Unknown';
      if (car.internalContact && car.internalContact.trim() !== '') {
        internalManager = car.internalContact;
      } else if (car.creator && car.creator.name) {
        internalManager = car.creator.name;
      }

      return {
        id: car.id,
        date: formatDate(car.issueDate),
        customer: customerGroup,
        dept: customerDepartment,
        customerManager: customerManager,
        internalManager: internalManager,
        due: formatDate(car.dueDate),
        completion: formatDate(car.completionDate),
        score: car.calculatedScore || car.score || 0,
        originalCar: car // 원본 데이터 보관
      };
    });

    return {
      kpi,
      corporations,
      customers: customersData,
      customerContacts: customers.slice(0, 6).map(c => ({ 
        name: c.name, 
        customer: c.company || c.group,
        total: Math.floor(Math.random() * 20), 
        score: Math.floor(Math.random() * 50), 
        sentimentScore: Math.floor(Math.random() * 60) 
      })),
      managers: managersData,
      carList: carsWithStatus.slice(0, 20),
      worstScore,
      worstDelay,
      allCarList
    };
  };

  // 필터 핸들러
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleCompanyChange = (selectedCompany: string) => {
    setFilters(prev => ({ ...prev, corp: selectedCompany }));
  };

  const handleCustomerGroupsChange = (selectedGroups: string[]) => {
    setFilters(prev => ({ ...prev, customerGroups: selectedGroups }));
  };

  const handleDepartmentChange = (selectedDepartment: string) => {
    setFilters(prev => ({ ...prev, dept: selectedDepartment }));
  };

  const handleStatusChange = (selectedStatus: string) => {
    setFilters(prev => ({ ...prev, status: selectedStatus }));
  };

  const handleSearch = useCallback(() => {
    setFilteredFilters(filters);
    
    // 토스트 메시지 표시
    let message = td('filterApplied');
    if (filters.manager.trim()) {
      const searchTerms = filters.manager.split(',').map(s => s.trim()).filter(Boolean);
      const termCount = searchTerms.length;
      message = `필터 적용됨 (담당자 검색: ${termCount}개 검색어)`;
    }
    setToast(message);
    setTimeout(() => setToast(null), 1500);
  }, [filters]);

  const handleReset = useCallback(() => {
    // 🎯 기간 필터 초기화 로직 개선
    let resetStartMonth = '';
    let resetEndMonth = '';
    
    if (dataDateRange) {
      // 데이터 범위가 있으면 해당 범위 사용
      resetStartMonth = dataDateRange.firstMonth;
      resetEndMonth = dataDateRange.lastMonth;
    } else {
      // 데이터 범위가 없으면 최근 6개월 기본값 사용
      const defaultRange = getDefaultDateRange();
      resetStartMonth = defaultRange.startMonth;
      resetEndMonth = defaultRange.endMonth;
    }
    
    const reset = {
          corp: td('all'),
    customerGroups: [] as string[],
    dept: td('all'),
    status: td('all'),
      startMonth: resetStartMonth,
      endMonth: resetEndMonth,
      manager: ''
    };
    setFilters(reset);
    setFilteredFilters(reset);
    
    // 토스트 메시지 표시
    setToast(td('filterReset'));
    setTimeout(() => setToast(null), 1500);
  }, [dataDateRange]);
  
  // 🔽 테이블 정렬 핸들러
  const handleSort = (column: string) => {
    const newDirection = toggleSortDirection(
      allCarListSort.column === column ? allCarListSort.direction : null
    );
    
    setAllCarListSort({
      column,
      direction: newDirection
    });
    
    // 정렬 후 첫 페이지로 이동
    allCarListPagination.handlePageChange(1);
  };

  // 📊 차트 클릭 핸들러 함수들
  const handlePieChartClick = (event: any, elements: any) => {
    if (elements.length > 0) {
      const elementIndex = elements[0].index;
      const statusKeys = Object.keys(statusCounts);
      const clickedStatus = statusKeys[elementIndex];
      
      // 상태 필터 토글
      const newStatus = filteredFilters.status === clickedStatus ? td('all') : clickedStatus;
      const newFilters = { ...filters, status: newStatus };
      setFilters(newFilters);
      setFilteredFilters(newFilters);
      
      // 토스트 메시지 표시
      setToast(td('statusFilter', { status: newStatus === td('all') ? td('removed') : newStatus }));
      setTimeout(() => setToast(null), 1500);
    }
  };

  const handleBarChartClick = (event: any, elements: any) => {
    if (elements.length > 0) {
      const elementIndex = elements[0].index;
      const clickedGroup = sortedGroup[elementIndex];
      
      if (clickedGroup && clickedGroup.name) {
        let updatedFilters = { ...filters };
        
        // 🎯 모든 그룹 타입에 대한 로딩 시작
        setChartSyncLoading(true);
        
        if (groupTab === 'company') {
          // 법인 필터 토글
          const newCorp = filteredFilters.corp === clickedGroup.name ? td('all') : clickedGroup.name;
          updatedFilters = { ...filters, corp: newCorp };
          setFilters(updatedFilters);
          setFilteredFilters(updatedFilters);
          
          // 🎯 법인 필터 상태 업데이트
          setActiveCompanyFilter(newCorp === '전체' ? '' : newCorp);
          
          setToast(`법인 필터: ${newCorp === '전체' ? '해제' : newCorp} - 데이터 동기화 중...`);
          setTimeout(() => setToast(null), 3000);
        } else if (groupTab === 'customer') {
          // 고객사 필터 토글 (다중 선택)
          const newCustomerGroups = filteredFilters.customerGroups.includes(clickedGroup.name)
            ? filteredFilters.customerGroups.filter(g => g !== clickedGroup.name)
            : [...filteredFilters.customerGroups, clickedGroup.name];
          updatedFilters = { ...filters, customerGroups: newCustomerGroups };
          setFilters(updatedFilters);
          setFilteredFilters(updatedFilters);
          
          const action = newCustomerGroups.includes(clickedGroup.name) ? '추가' : '제거';
          setToast(`고객사 필터 ${action}: ${clickedGroup.name} - 데이터 동기화 중...`);
          setTimeout(() => setToast(null), 3000);
        } else if (groupTab === 'manager') {
          // 담당자 필터 토글
          const newManager = filteredFilters.manager === clickedGroup.name ? '' : clickedGroup.name;
          updatedFilters = { ...filters, manager: newManager };
          setFilters(updatedFilters);
          setFilteredFilters(updatedFilters);
          
          // 🎯 담당자 필터 상태 업데이트
          setActiveManagerFilter(newManager);
          
          setToast(`담당자 필터: ${newManager === '' ? '해제' : newManager} - 데이터 동기화 중...`);
          setTimeout(() => setToast(null), 3000);
        }
        
        // 필터 변경 후 즉시 모든 데이터 다시 로드 (새로운 필터 직접 전달)
        setTimeout(async () => {
          try {
            await Promise.all([
              loadAccumulatedScores(updatedFilters),
              loadMonthlyTrendData(updatedFilters),
              loadCustomerAccumulatedScores(updatedFilters) // 🎯 고객사 카드 데이터도 동기화
            ]);
            
            setChartSyncLoading(false);
            const groupName = groupTab === 'company' ? '법인' : groupTab === 'customer' ? '고객사' : '담당자';
            setToast(`${groupName} 데이터 동기화 완료!`);
            setTimeout(() => setToast(null), 1500);
          } catch (error) {
            setChartSyncLoading(false);
            setToast('데이터 동기화 실패');
            setTimeout(() => setToast(null), 1500);
          }
        }, 50);
      }
    }
  };

  const handleLineChartClick = (event: any, elements: any) => {
    if (elements.length > 0) {
      const elementIndex = elements[0].datasetIndex;
      const datasets = lineData.datasets;
      
      if (datasets[elementIndex]) {
        const clickedGroupName = datasets[elementIndex].label;
        let updatedFilters = { ...filters };
        
        // 🎯 모든 그룹 타입에 대한 로딩 시작
        setChartSyncLoading(true);
        
        if (groupTab === 'company') {
          // 법인 필터 토글
          const newCorp = filteredFilters.corp === clickedGroupName ? td('all') : clickedGroupName;
          updatedFilters = { ...filters, corp: newCorp };
          setFilters(updatedFilters);
          setFilteredFilters(updatedFilters);
          
          // 🎯 법인 필터 상태 업데이트
          setActiveCompanyFilter(newCorp === '전체' ? '' : newCorp);
          
          setToast(`법인 필터: ${newCorp === '전체' ? '해제' : newCorp} - 데이터 동기화 중...`);
          setTimeout(() => setToast(null), 3000);
        } else if (groupTab === 'customer') {
          // 고객사 필터 토글 (다중 선택)
          const newCustomerGroups = filteredFilters.customerGroups.includes(clickedGroupName)
            ? filteredFilters.customerGroups.filter(g => g !== clickedGroupName)
            : [...filteredFilters.customerGroups, clickedGroupName];
          updatedFilters = { ...filters, customerGroups: newCustomerGroups };
          setFilters(updatedFilters);
          setFilteredFilters(updatedFilters);
          
          const action = newCustomerGroups.includes(clickedGroupName) ? '추가' : '제거';
          setToast(`고객사 필터 ${action}: ${clickedGroupName} - 데이터 동기화 중...`);
          setTimeout(() => setToast(null), 3000);
        } else if (groupTab === 'manager') {
          // 담당자 필터 토글
          const newManager = filteredFilters.manager === clickedGroupName ? '' : clickedGroupName;
          updatedFilters = { ...filters, manager: newManager };
          setFilters(updatedFilters);
          setFilteredFilters(updatedFilters);
          
          // 🎯 담당자 필터 상태 업데이트
          setActiveManagerFilter(newManager);
          
          setToast(`담당자 필터: ${newManager === '' ? '해제' : clickedGroupName} - 데이터 동기화 중...`);
          setTimeout(() => setToast(null), 3000);
        }
        
        // 필터 변경 후 즉시 차트 데이터 다시 로드 (새로운 필터 직접 전달)
        setTimeout(async () => {
          try {
            await Promise.all([
              loadAccumulatedScores(updatedFilters),
              loadMonthlyTrendData(updatedFilters),
              loadCustomerAccumulatedScores(updatedFilters) // 🎯 고객사 카드 데이터도 동기화
            ]);
            
            setChartSyncLoading(false);
            const groupName = groupTab === 'company' ? '법인' : groupTab === 'customer' ? '고객사' : '담당자';
            setToast(`${groupName} 데이터 동기화 완료!`);
            setTimeout(() => setToast(null), 1500);
          } catch (error) {
            setChartSyncLoading(false);
            setToast('데이터 동기화 실패');
            setTimeout(() => setToast(null), 1500);
          }
        }, 50);
      }
    }
  };

  // 고객사 카드 클릭 핸들러
  const handleCompanyCardClick = async (company: any) => {
    if (!weeklyReport?.data?.[company.name]) {
      setToast(td('noWeeklyReport'));
      setTimeout(() => setToast(null), 1500);
      return;
    }

    setModalLoading(true);
    setModalOpen(true);
    setModalError(null);
    
    try {
      const reportData = weeklyReport.data[company.name];
      setModalData({ 
        customer: company.name,
        ...reportData,
        updatedAt: weeklyReport.updatedAt 
      });
    } catch (err: any) {
      setModalError(err.message || '데이터 로드 실패');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast(td('copied'));
    setTimeout(() => setToast(null), 1500);
  };

  // CAR 상세 정보 모달 핸들러
  const handleCarRowClick = async (carData: any, originalCarId?: number) => {
    setCarDetailModalOpen(true);
    setCarDetailLoading(true);
    
    try {
      // 만약 원본 CAR ID가 있다면 서버에서 상세 정보를 가져옴
      if (originalCarId) {
        const response = await fetch(`/api/car/${originalCarId}`, {
          headers: getAuthHeaders()
        });
        
        if (response.ok) {
          const fullCarData = await response.json();
          

          
          const finalData = {
            ...carData,
            description: fullCarData.description,
            status: fullCarData.status,
            // 추가 서버 데이터 병합
            ...fullCarData
          };
          
          setCarDetailData(finalData);
        } else {
          // 서버 요청 실패시 기본 데이터 사용
          setCarDetailData(carData);
        }
      } else {
        // ID가 없으면 기본 데이터만 사용
        setCarDetailData(carData);
      }
    } catch (error) {
      console.error('CAR 상세 정보 로드 실패:', error);
      setCarDetailData(carData);
    } finally {
      setCarDetailLoading(false);
    }
  };

  // ESC 키 핸들러
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { 
      if (e.key === 'Escape') {
        setModalOpen(false);
        setCarDetailModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);



  // 상단 고객사 카드 데이터 (상위 6개, 우선순위: event수 → 누적점수 → 알파벳순)
  // 🎯 BarChart와 동일한 누적 Score 로직 적용
  const customerCardsData = useMemo(() => {
    return [...data.customers]
      .map(c => {
        // BarChart와 동일한 누적 Score 찾기
        const accumulatedScoreData = customerAccumulatedScores.find((item: any) => item.name === c.name);
        const accumulatedScore = accumulatedScoreData ? accumulatedScoreData.accumulatedScore : (c.score || 0);
        
        return {
          ...c,
          accumulatedScore // BarChart 누적 Score 사용
        };
      })
      .sort((a, b) => b.total - a.total || b.accumulatedScore - a.accumulatedScore || a.name.localeCompare(b.name, 'ko-KR'))
      .slice(0, 6);
  }, [data.customers, customerAccumulatedScores]);

  // 주간 보고서가 있는 고객사 목록
  const reportCustomers = weeklyReport?.data ? Object.keys(weeklyReport.data) : [];

  // 쉼표를 줄바꿈으로 변환하는 함수
  const formatNameWithLineBreaks = (names: string) => {
    if (!names || names === 'Unknown') return names;
    return names.split(', ').map((name, index) => (
      <span key={index}>
        {name}
        {index < names.split(', ').length - 1 && <br />}
      </span>
    ));
  };



  // 로딩/에러 상태  
  if (loading) return <div className="min-h-screen bg-zinc-900 text-white p-8 text-center">{td('dashboardLoading')}</div>;
  
  // 권한 체크: 로그인 되지 않은 경우
  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-zinc-900 text-white p-8">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">{td('accessDenied')}</div>
          <div className="text-zinc-400 mb-4">{td('loginRequired')}</div>
          <button 
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
          >
            {td('goToLogin')}
          </button>
        </div>
      </div>
    );
  }
  
  // 에러 상태 체크
  if (error && !data) return (
    <div className="min-h-screen bg-zinc-900 text-white p-8">
      <div className="text-center">
        <div className="text-red-400 text-lg mb-2">{td('errorOccurred')}</div>
        <div className="text-zinc-400">{error}</div>
      </div>
    </div>
  );
  
  // 사용자 정보 로딩 중
  if (!user) return <div className="min-h-screen bg-zinc-900 text-white p-8 text-center">{td('userInfoLoading')}</div>;

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-4 md:p-8">
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded  z-50">
          {toast}
        </div>
      )}

      {/* 전략 제언 모달 */}
      <StrategyModal 
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={modalData}
        loading={modalLoading}
        error={modalError}
        onCopy={handleCopy}
      />

      {/* CAR 상세 정보 모달 */}
      <CarDetailModal
        open={carDetailModalOpen}
        onClose={() => setCarDetailModalOpen(false)}
        data={carDetailData}
        loading={carDetailLoading}
      />

      {/* 필터 영역 */}
      <div className="bg-[#111113] border border-zinc-800/60 rounded-lg px-3 py-2 mb-4 flex flex-row items-center gap-1">
                 {/* 회사 단일 선택 드롭다운 */}
         <div className="min-w-[150px]">
           <SingleSelectDropdown
             label={td('corporationFilter')}
             options={data.corporations.map((corp: any) => corp.name)}
             selectedValue={filters.corp}
             onSelectionChange={handleCompanyChange}
             placeholder={td('all')}
           />
         </div>
        
        {/* 고객사 그룹 복수 선택 드롭다운 */}
        <div className="min-w-[150px]">
          <MultiSelectDropdown
            label={td('customerFilter')}
            options={customerGroups}
            selectedValues={filters.customerGroups}
            onSelectionChange={handleCustomerGroupsChange}
            placeholder={td('all')}
          />
        </div>
        
        {/* 부서 단일 선택 드롭다운 */}
        <div className="min-w-[150px]">
          <SingleSelectDropdown
            label={td('departmentFilter')}
            options={departments}
            selectedValue={filters.dept}
            onSelectionChange={handleDepartmentChange}
            placeholder={td('all')}
          />
        </div>
        {/* 상태 단일 선택 드롭다운 */}
        <div className="min-w-[150px]">
          <SingleSelectDropdown
            label={td('status')}
            options={statuses}
            selectedValue={filters.status}
            onSelectionChange={handleStatusChange}
            placeholder={td('all')}
          />
        </div>
        <CustomMonthPicker
          label={td('startMonth')}
          value={filters.startMonth}
          onChange={(value) => handleFilterChange('startMonth', value)}
          td={td}
        />
        <CustomMonthPicker
          label={td('endMonth')}
          value={filters.endMonth}
          onChange={(value) => handleFilterChange('endMonth', value)}
          td={td}
        />
        <div className="flex flex-col items-start min-w-[140px] max-w-[800px] flex-1">
          <span className="text-xs text-zinc-400 mb-0.5">{td('managerSearch')}</span>
          <input
            placeholder={td('managerSearchPlaceholder')}
            className="bg-zinc-900 border border-zinc-700 rounded-lg h-10 px-3 text-[13px] text-zinc-100 w-full focus:outline-none focus:border-[#111167]"
            value={filters.manager}
            onChange={e => handleFilterChange('manager', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          />
        </div>
        <button 
          className="bg-[#111167] hover:bg-[#1a1a80] rounded-lg px-4 h-10 flex items-center justify-center mt-5 text-white text-[13px] font-medium transition-colors" 
          onClick={handleSearch}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          {td('search')}
        </button>
        <button 
          className="ml-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg px-4 h-10 flex items-center justify-center mt-5 text-zinc-300 text-[13px] font-medium transition-colors" 
          onClick={handleReset}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {td('reset')}
        </button>
        {/* 필터 적용 상태 표시 */}
        <div className="ml-3 flex items-center mt-5 text-xs text-zinc-400">
          {JSON.stringify(filters) !== JSON.stringify(filteredFilters) && (
            <span className="bg-orange-600 text-white px-2 py-1 rounded mr-2">
              {td('filterNotApplied')}
            </span>
          )}
                      {filteredFilters.corp !== td('all') && (
              <span className="bg-[#111167] text-white px-2 py-1 rounded mr-1">
                {td('company')}: {filteredFilters.corp}
              </span>
            )}
                      {filteredFilters.customerGroups.length > 0 && !filteredFilters.customerGroups.includes(td('all')) && (
              <span className="bg-green-600 text-white px-2 py-1 rounded mr-1">
                {td('customerCount', { count: filteredFilters.customerGroups.length })}
              </span>
            )}
                      {filteredFilters.dept !== td('all') && (
              <span className="bg-purple-600 text-white px-2 py-1 rounded mr-1">
                {td('department')}: {filteredFilters.dept}
              </span>
            )}
                      {filteredFilters.status !== td('all') && (
              <span className="bg-red-600 text-white px-2 py-1 rounded mr-1">
                {td('status')}: {filteredFilters.status}
              </span>
            )}
                      {(filteredFilters.startMonth || filteredFilters.endMonth) && (
              <span className="bg-yellow-600 text-white px-2 py-1 rounded mr-1">
                {td('period')}: {filteredFilters.startMonth || td('startDate')} ~ {filteredFilters.endMonth || td('endDate')}
              </span>
            )}
                      {filteredFilters.manager.trim() && (
              <span className="bg-indigo-600 text-white px-2 py-1 rounded mr-1">
                {td('managerSearch')}: {filteredFilters.manager.slice(0, 20)}{filteredFilters.manager.length > 20 ? '...' : ''}
              </span>
            )}
        </div>
      </div>

      {/* 현황 카드 + 고객사 카드 */}
      <div className="flex flex-row gap-2 mb-4 w-full items-center">
        {/* 현황 카드 */}
        <div className="flex flex-row bg-zinc-900 border border-zinc-800/60 rounded-lg px-15 py-5 gap-6  h-full items-center">
          {[
            { label: td('totalCAR'), value: data.kpi.total },
            { label: td('inProgress'), value: data.kpi.inProgress },
            { label: td('delayed'), value: data.kpi.delayed },
            { label: td('closed'), value: data.kpi.closed },
            { label: td('dueSoon'), value: data.kpi.dueSoon }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center min-w-[80px]">
              <div className="text-xs text-zinc-300 font-medium mb-0.5">{item.label}</div>
              <div className="text-xl font-bold text-white">{item.value}</div>
            </div>
          ))}
        </div>

        {/* 고객사 카드 */}
        <div className="flex flex-row gap-2 flex-1">
          {customerCardsData.map((c: any, i: number) => {
            const hasReport = reportCustomers.includes(c.name);
            return (
              <div
                key={i}
                className={`bg-zinc-900 border border-zinc-800/60 rounded-lg px-3 py-2 flex-1 min-w-[100px] flex flex-col items-center justify-center  relative ${hasReport ? 'cursor-pointer hover:bg-[#111113]' : ''}`}
                onClick={() => {
                  if (hasReport) handleCompanyCardClick(c);
                }}
              >
                {hasReport && (
                  <span className="absolute left-2 top-2 w-2 h-2 rounded-full bg-[#111167]" />
                )}
                <div className="font-bold text-white text-xs mb-0.5 text-center">{c.name}</div>
                <div className="text-xs text-zinc-300 mb-0.5 text-center">{td('inProgress')}: {c.total}</div>
                <div className="text-xs text-zinc-300 mb-0.5 text-center">{td('pending')}: 0</div>
                <div className="text-xs text-[#9999cc] font-semibold text-center">
                  {td('accumulatedScore')}: {(c.accumulatedScore || 0).toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 차트 탭 */}
      <div className="flex flex-row gap-2 mb-2">
        {/* 그룹 토글 */}
        <div className="flex bg-zinc-900/50 rounded-lg p-0.5 gap-0.5">
          {[
            { key: 'company', label: td('corporationTab') },
            { key: 'customer', label: td('customerTab') },
            { key: 'manager', label: td('managerTab') }
          ].map(tab => (
            <button
              key={tab.key}
              className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${groupTab === tab.key ? 'bg-[#111167] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              onClick={() => setGroupTab(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 차트 토글 */}
        <div className="flex bg-zinc-900/50 rounded-lg p-0.5 gap-0.5">
          {[
            { key: 'score', label: td('scoreTab') },
            { key: 'sentiment', label: td('sentimentTab') }
          ].map(tab => (
            <button
              key={tab.key}
              className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${chartTab === tab.key ? 'bg-[#111167] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              onClick={() => setChartTab(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {/* 상태별 PieChart */}
        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-5 flex flex-col w-full md:w-1/2">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">{td('statusDistribution')}</h3>
          <div className="flex items-center justify-center flex-1 gap-6">
            {/* 차트 영역 */}
            <div className="flex-shrink-0 relative" style={{ width: '160px', height: '160px', cursor: 'pointer' }}>
              <Doughnut data={pieData} options={{...pieOptions, onClick: handlePieChartClick}} />
              {/* 도넛 중앙 총 건수 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-zinc-100">{Object.values(statusCounts).reduce((a, b) => a + b, 0)}</span>
                <span className="text-[10px] text-zinc-500">{td('totalItems')}</span>
              </div>
            </div>
            {/* 범례 영역 */}
            <div className="flex flex-col justify-center gap-3">
              {Object.keys(statusCounts).map((status, index) => {
                const count = statusCounts[status as keyof typeof statusCounts];
                const percentage = getPercentage(count);
                const colors = ['#38bdf8', '#fb923c', '#34d399'];
                const translatedStatus = status === 'IN_PROGRESS' ? td('inProgress') :
                                         status === 'DELAYED' ? td('delayed') :
                                         status === 'CLOSED' ? td('closed') : status;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: colors[index] }}
                    ></div>
                    <div className="flex flex-col">
                      <span className="text-zinc-400 text-[11px]">{translatedStatus}</span>
                      <span className="text-zinc-100 text-sm font-semibold">{count} <span className="text-zinc-500 text-[11px] font-normal">({percentage}%)</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 바 차트 */}
        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-5 flex flex-col items-center w-full md:w-1/2 relative">
          <div className="flex items-center gap-2 mb-4 w-full">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {td('comparisonBy', {
                type: groupTab === 'company' ? td('corporationTab') : groupTab === 'customer' ? td('customerTab') : td('managerTab'),
                metric: chartTab === 'score' ? td('scoreTab') : td('sentimentTab')
              })}
            </h3>
            {/* 🎯 모든 그룹 타입에 대한 로딩 표시 */}
            {chartSyncLoading && (
              <span className="text-xs text-yellow-400 flex items-center gap-1 ml-2">
                <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                {td('syncing')}
              </span>
            )}
            {/* 🎯 모든 그룹 타입에 대한 활성 필터 표시 */}
            {!chartSyncLoading && (
              <>
                {groupTab === 'manager' && activeManagerFilter && (
                  <span className="text-xs text-yellow-400 ml-2">
                    {activeManagerFilter}
                  </span>
                )}
                {groupTab === 'company' && activeCompanyFilter && (
                  <span className="text-xs text-yellow-400 ml-2">
                    {activeCompanyFilter}
                  </span>
                )}
                {groupTab === 'customer' && filteredFilters.customerGroups.length > 0 && (
                  <span className="text-xs text-yellow-400 ml-2">
                    {td('selectedCustomers', { count: filteredFilters.customerGroups.length })}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="w-full h-52" style={{ cursor: 'pointer' }}>
            <Bar data={barData} options={{...barOptions, onClick: handleBarChartClick}} />
          </div>
          
          {/* 🎯 로딩 오버레이 - 모든 그룹 타입에 적용 */}
          {chartSyncLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-white text-sm flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {td('synchronizing', { 
              type: groupTab === 'company' ? td('corporationTab') : groupTab === 'customer' ? td('customerTab') : td('managerTab')
            })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 라인 차트 */}
      <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            {td('monthlyTrendBy', {
              type: groupTab === 'company' ? td('corporationTab') : groupTab === 'customer' ? td('customerTab') : td('managerTab'),
              metric: chartTab === 'score' ? td('accumulatedScore') : td('sentimentTab')
            })}
          </h3>
          {monthlyTrendLoading && (
            <span className="text-xs text-[#9999cc] flex items-center gap-1 ml-2">
              <div className="w-3 h-3 border-2 border-[#111167] border-t-transparent rounded-full animate-spin"></div>
              {td('loading')}
            </span>
          )}
          {!monthlyTrendLoading && monthlyTrendData.length === 0 && (
            <span className="text-xs text-orange-400 ml-2">{td('noData')}</span>
          )}
        </div>
        <div className="w-full h-64" style={{ cursor: monthlyTrendData.length > 0 ? 'pointer' : 'default' }}>
          {monthlyTrendData.length > 0 ? (
            <Line data={lineData} options={{...lineOptions, onClick: handleLineChartClick}} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
              {monthlyTrendLoading ? td('loadingMonthlyTrend') : td('noData')}
            </div>
          )}
        </div>
      </div>

      {/* 테이블 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Worst Score Top5 */}
        <div className="bg-[#111113] rounded-lg border border-zinc-800/60  overflow-hidden">
          <div className="bg-zinc-900 px-6 py-4 border-l-4 border-red-500/60">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-zinc-100">{td('scoreWorst5')}</h3>
            </div>
            <p className="text-zinc-400 text-sm mt-1">{td('scoreWorst5Description')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800/60">
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('date')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('customer')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('department')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('subject')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('customerContact')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('internalContact')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('score')}</th>
                </tr>
              </thead>
              <tbody>
                {data.worstScore.map((item: any, i: number) => (
                  <tr 
                    key={i} 
                    className={`border-b border-zinc-800/30 hover:bg-zinc-800 cursor-pointer transition-all duration-200 ${i % 2 === 0 ? 'bg-zinc-900/80' : 'bg-[#111113]'}`}
                    onClick={() => handleCarRowClick(item, item.id)}
                  >
                    <td className="py-3 px-2 text-center text-zinc-300">{item.date}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">{item.customer}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">{item.dept}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">
                      <span className="inline-block px-2 py-1 bg-[#111167]/15 text-[#9999cc] rounded-full text-xs">
                        {item.originalCar?.mainCategory || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center text-zinc-300">{formatNameWithLineBreaks(item.customerManager)}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">{formatNameWithLineBreaks(item.internalManager)}</td>
                    <td className="py-3 px-2 text-center">
                      <span className="inline-block px-2 py-1 bg-red-500/15 text-red-300 rounded-full font-semibold">
                        {Number(item.score).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 지연 Worst5 */}
        <div className="bg-[#111113] rounded-lg border border-zinc-800/60  overflow-hidden">
          <div className="bg-zinc-900 px-6 py-4 border-l-4 border-orange-500/60">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-zinc-100">{td('delayWorst5')}</h3>
            </div>
            <p className="text-zinc-400 text-sm mt-1">{td('delayWorst5Description')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800/60">
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('date')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('customer')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('department')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('subject')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('customerContact')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('internalContact')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('dueDate')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('completionDate')}</th>
                  <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('delayDays')}</th>
                </tr>
              </thead>
              <tbody>
                {data.worstDelay.map((item: any, i: number) => (
                  <tr 
                    key={i} 
                    className={`border-b border-zinc-800/30 hover:bg-zinc-800 cursor-pointer transition-all duration-200 ${i % 2 === 0 ? 'bg-zinc-900/80' : 'bg-[#111113]'}`}
                    onClick={() => handleCarRowClick(item, item.id)}
                  >
                    <td className="py-3 px-2 text-center text-zinc-300">{item.date}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">{item.customer}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">{item.dept}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">
                      <span className="inline-block px-2 py-1 bg-[#111167]/15 text-[#9999cc] rounded-full text-xs">
                        {item.originalCar?.mainCategory || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center text-zinc-300">{formatNameWithLineBreaks(item.customerManager)}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">{formatNameWithLineBreaks(item.internalManager)}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">{item.due}</td>
                    <td className="py-3 px-2 text-center text-zinc-300">{item.completion}</td>
                    <td className="py-3 px-2 text-center">
                      <span className="inline-block px-2 py-1 bg-orange-500/15 text-orange-300 rounded-full font-semibold">
                        {item.delay}{td('days')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 전체 CAR 목록 */}
      <div className="bg-[#111113] rounded-lg border border-zinc-800/60  overflow-hidden">
        <div className="bg-zinc-900 px-6 py-4 border-l-4 border-[#111167]/60">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-zinc-100">{td('allCarList')}</h3>
          </div>
          <p className="text-zinc-400 text-sm mt-1">{td('allCarListDescription')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800/60">
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold cursor-pointer hover:bg-zinc-800 transition-colors select-none" onClick={() => handleSort('date')}>
                  <div className="flex items-center justify-center gap-1">
                    {td('date')}
                    <SortIcon direction={allCarListSort.column === 'date' ? allCarListSort.direction : null} />
                  </div>
                </th>
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold cursor-pointer hover:bg-zinc-800 transition-colors select-none" onClick={() => handleSort('customer')}>
                  <div className="flex items-center justify-center gap-1">
                    {td('customer')}
                    <SortIcon direction={allCarListSort.column === 'customer' ? allCarListSort.direction : null} />
                  </div>
                </th>
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold cursor-pointer hover:bg-zinc-800 transition-colors select-none" onClick={() => handleSort('dept')}>
                  <div className="flex items-center justify-center gap-1">
                    {td('department')}
                    <SortIcon direction={allCarListSort.column === 'dept' ? allCarListSort.direction : null} />
                  </div>
                </th>
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('subject')}</th>
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('customerContact')}</th>
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('internalContact')}</th>
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('dueDate')}</th>
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold">{td('deadlineDate')}</th>
                <th className="text-center py-3 px-2 text-zinc-300 font-semibold cursor-pointer hover:bg-zinc-800 transition-colors select-none" onClick={() => handleSort('score')}>
                  <div className="flex items-center justify-center gap-1">
                    {td('score')}
                    <SortIcon direction={allCarListSort.column === 'score' ? allCarListSort.direction : null} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {allCarListPagination.currentItems.map((item: any, i: number) => (
                <tr 
                  key={i} 
                  className={`border-b border-zinc-800/30 hover:bg-zinc-800 cursor-pointer transition-all duration-200 ${i % 2 === 0 ? 'bg-zinc-900/80' : 'bg-[#111113]'}`}
                  onClick={() => handleCarRowClick(item, item.id)}
                >
                  <td className="py-3 px-2 text-center text-zinc-300">{item.date}</td>
                  <td className="py-3 px-2 text-center text-zinc-300">{item.customer}</td>
                  <td className="py-3 px-2 text-center text-zinc-300">{item.dept}</td>
                  <td className="py-3 px-2 text-center text-zinc-300">
                    <span className="inline-block px-2 py-1 bg-[#111167]/15 text-[#9999cc] rounded-full text-xs">
                      {item.originalCar?.mainCategory || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center text-zinc-300">{formatNameWithLineBreaks(item.customerManager)}</td>
                  <td className="py-3 px-2 text-center text-zinc-300">{formatNameWithLineBreaks(item.internalManager)}</td>
                  <td className="py-3 px-2 text-center text-zinc-300">{item.due}</td>
                  <td className="py-3 px-2 text-center text-zinc-300">{item.completion}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`inline-block px-2 py-1 rounded-full font-semibold ${
                      Number(item.score) >= 8 ? 'bg-green-500/15 text-green-300' :
                      Number(item.score) >= 6 ? 'bg-yellow-500/15 text-yellow-300' :
                      'bg-red-500/15 text-red-300'
                    }`}>
                      {Number(item.score).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
              {allCarListPagination.currentItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="text-zinc-400">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-8v2m0 0V4m0 3h2m-2 0H8" />
                      </svg>
                      <div className="text-lg font-medium">{td('noDataAvailable')}</div>
                      <div className="text-sm mt-1">{td('changeFilterConditions')}</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* 페이지네이션 추가 */}
        <div className="mt-4 px-6 pb-6">
          <Pagination
            currentPage={allCarListPagination.currentPage}
            totalItems={allCarListPagination.totalItems}
            itemsPerPage={15}
            onPageChange={allCarListPagination.handlePageChange}
            className="text-white"
          />
        </div>
      </div>
    </div>
  );
} 