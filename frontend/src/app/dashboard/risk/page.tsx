"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/utils/api";
import { isAuthenticated } from "@/utils/jwt";
import { useRouter } from "next/navigation";
import { addStatusToCars, type CarStatus } from "@/utils/carStatus";
import CarDetailModal from "@/components/CarDetailModal";

type Car = {
  id: number;
  corporation: string;
  eventType: string;
  issueDate: string | number | bigint;
  dueDate?: string | number | bigint;
  completionDate?: string | number | bigint;
  riskMitigation: boolean;
  riskLevel?: string;
  mainCategory?: string;
  internalContact?: string;
  customerContacts?: { id: number; name: string; group: string; department: string }[];
  status: CarStatus;
};

// 카테고리 목록 (이미지 기준)
const CATEGORIES = ['Purchasing', 'Quality', 'Engineering', 'Developing'];
const CORPORATIONS = ['CMKR', 'CMMPL', 'CMVN', 'CMSJ', 'CMMX', 'CMCZ'];

export default function RiskDashboardPage() {
  const t = useTranslations('risk.dashboard');
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const data = await apiFetch('/api/car?limit=1000');
        const allCars = data.items || [];
        
        // Risk가 체크된 항목만 필터링하고 상태 추가
        const riskCars = allCars.filter((car: { riskMitigation?: boolean }) => car.riskMitigation);
        const carsWithStatus = addStatusToCars(riskCars) as Car[];
        
        setCars(carsWithStatus);
      } catch (error) {
        console.error('데이터 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // 법인별 카테고리별 통계 계산
  const corpStats = useMemo(() => {
    return CATEGORIES.map(category => {
      const categoryData = CORPORATIONS.map(corp => {
        const corpCars = cars.filter(c => c.corporation === corp);
        
        // 고객사 부서(customerContacts[].department) 기준으로 매칭
        const categoryCars = corpCars.filter(car => {
          if (!car.customerContacts || car.customerContacts.length === 0) {
            return false;
          }
          
          // 고객사 연락처 중 하나라도 해당 부서(department)가 있으면 포함
          return car.customerContacts.some(cc => {
            const dept = (cc.department || '').trim();
            
            // 정확한 일치 (대소문자 구분)
            if (dept === category) return true;
            
            // 대소문자 무시
            if (dept.toLowerCase() === category.toLowerCase()) return true;
            
            // 부분 일치 (예: "Purchasing, Production")
            if (dept.includes(category)) return true;
            
            return false;
          });
        });
        
        return {
          total: categoryCars.length,
          closed: categoryCars.filter(c => c.status === 'CLOSED').length,
          inProgress: categoryCars.filter(c => c.status === 'IN_PROGRESS').length,
          delayed: categoryCars.filter(c => c.status === 'DELAYED').length,
        };
      });
      
      return { category, data: categoryData };
    });
  }, [cars]);

  // 법인별 CAR 그룹화 (간트차트용)
  const carsByCorpList = useMemo(() => {
    const groups = cars.reduce((acc, car) => {
      if (!acc[car.corporation]) acc[car.corporation] = [];
      acc[car.corporation].push(car);
      return acc;
    }, {} as Record<string, Car[]>);

    return CORPORATIONS.map(corp => ({
      corp,
      cars: groups[corp] || []
    })).filter(g => g.cars.length > 0);
  }, [cars]);

  // 간트차트용 날짜 범위 계산 (오늘 기준 ±6개월)
  const dateRange = useMemo(() => {
    const today = new Date();
    const minDate = new Date(today);
    const maxDate = new Date(today);
    
    // 오늘 기준 -6개월
    minDate.setMonth(minDate.getMonth() - 6);
    minDate.setDate(1); // 월 초
    
    // 오늘 기준 +6개월
    maxDate.setMonth(maxDate.getMonth() + 6);
    maxDate.setDate(1); // 월 초
    
    return { minDate, maxDate };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-zinc-400">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-zinc-100">{t('title')}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t('subtitle')}</p>
        </div>

        {/* 상단 스코어보드 영역 */}
        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-4 mb-8">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-zinc-700">
                <th className="px-3 py-2 text-left text-zinc-400 font-semibold w-32"></th>
                {CORPORATIONS.map(corp => (
                  <th key={corp} colSpan={4} className="px-2 py-2 text-center text-zinc-100 font-bold bg-zinc-800 border-l border-zinc-700" style={{ fontSize: '18px' }}>
                    {corp}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-zinc-700">
                <th className="px-3 py-2 text-left text-zinc-400 font-medium"></th>
                {CORPORATIONS.map(corp => (
                  <React.Fragment key={`${corp}-header`}>
                    <th className="px-2 py-2 text-center text-zinc-400 font-medium bg-zinc-800/50 border-l border-zinc-700">{t('total')}</th>
                    <th className="px-2 py-2 text-center text-zinc-400 font-medium bg-zinc-800/50">{t('closed')}</th>
                    <th className="px-2 py-2 text-center text-zinc-400 font-medium bg-zinc-800/50">{t('inProgress')}</th>
                    <th className="px-2 py-2 text-center text-zinc-400 font-medium bg-zinc-800/50">{t('delayed')}</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {corpStats.map((categoryRow, catIdx) => (
                <tr key={categoryRow.category} className={`${catIdx % 2 === 0 ? 'bg-zinc-900/50' : 'bg-zinc-800/30'} border-b border-zinc-800 last:border-b-0`}>
                  <td className="px-3 py-3 text-left text-zinc-200 font-semibold">{categoryRow.category}</td>
                  {categoryRow.data.map((stats, corpIdx) => (
                    <React.Fragment key={`${CORPORATIONS[corpIdx]}-${categoryRow.category}`}>
                      <td className="px-2 py-3 text-center text-white font-bold border-l border-zinc-700">{stats.total}</td>
                      <td className="px-2 py-3 text-center text-emerald-400 font-bold">{stats.closed}</td>
                      <td className="px-2 py-3 text-center text-yellow-400 font-bold">{stats.inProgress}</td>
                      <td className="px-2 py-3 text-center text-red-400 font-bold">{stats.delayed}</td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 간트차트 영역 */}
        {carsByCorpList.length > 0 ? (
          carsByCorpList.map(({ corp, cars: corpCars }) => (
            <CorporationGantt
              key={corp}
              corp={corp}
              cars={corpCars}
              minDate={dateRange.minDate}
              maxDate={dateRange.maxDate}
              onRowClick={setSelectedCarId}
              t={t}
            />
          ))
        ) : (
          <div className="text-center py-12 text-zinc-500">
            {t('noEvents')}
          </div>
        )}
      </div>

      {/* CAR 상세 모달 */}
      {selectedCarId && (
        <CarDetailModal
          carId={selectedCarId}
          isOpen={true}
          onClose={() => setSelectedCarId(null)}
        />
      )}
    </div>
  );
}

// 법인별 간트차트 컴포넌트
function CorporationGantt({ corp, cars, minDate, maxDate, onRowClick, t }: {
  corp: string;
  cars: Car[];
  minDate: Date;
  maxDate: Date;
  onRowClick: (carId: number) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  // 월 헤더 생성 (오늘 기준 ±6개월 = 13개월)
  const months = useMemo(() => {
    const result = [];
    const current = new Date(minDate);
    
    // minDate부터 maxDate까지 월 생성
    while (current < maxDate) {
      result.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }
    
    return result;
  }, [minDate, maxDate]);

  return (
    <div className="bg-[#111113] rounded-lg border border-zinc-800/60 mb-6 overflow-hidden">
      {/* 법인 헤더 */}
      <div 
        className="bg-zinc-800 px-4 py-3 border-b border-zinc-700 flex items-center justify-between cursor-pointer hover:bg-zinc-750 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">●</span>
          <h3 className="text-lg font-bold text-zinc-100">{corp}</h3>
          <span className="text-sm text-zinc-400">
            ({t('corpStats', { count: cars.length, completionRate: Math.round((cars.filter(c => c.status === 'CLOSED').length / cars.length) * 100), delayRate: Math.round((cars.filter(c => c.status === 'DELAYED').length / cars.length) * 100) })})
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* 간트차트 내용 */}
      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-zinc-700 bg-zinc-800">
                <th className="px-2 py-2 text-left text-zinc-300 font-semibold sticky left-0 bg-zinc-800 z-10 border-r border-zinc-700" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                  {t('category')}
                </th>
                <th className="px-2 py-2 text-left text-zinc-300 font-semibold sticky left-[180px] bg-zinc-800 z-10 border-r border-zinc-700" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                  {t('internalContact')}
                </th>
                <th className="px-2 py-2 text-center text-zinc-300 font-semibold sticky left-[330px] bg-zinc-800 z-10 border-r border-zinc-700" style={{ width: '70px', minWidth: '70px', maxWidth: '70px' }}>
                  {t('progress')}
                </th>
                {months.map(month => (
                  <th key={month} className="px-2 py-2 text-center text-zinc-400 font-medium border-l border-zinc-700" style={{ minWidth: '64px' }}>
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cars.map((car, idx) => (
                <GanttRow 
                  key={car.id} 
                  car={car} 
                  minDate={minDate} 
                  maxDate={maxDate}
                  months={months}
                  isEven={idx % 2 === 0}
                  onRowClick={() => onRowClick(car.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 간트차트 행 컴포넌트
function GanttRow({ car, minDate, maxDate, months, isEven, onRowClick }: { 
  car: Car; 
  minDate: Date; 
  maxDate: Date;
  months: string[];
  isEven: boolean;
  onRowClick: () => void;
}) {
  if (!car.issueDate || !car.dueDate) {
    return null;
  }

  // 날짜 변환 (숫자 timestamp 처리)
  const parseDate = (date: string | number | bigint): Date => {
    if (typeof date === 'string') {
      // 숫자 문자열인 경우 (예: '1759276800000')
      const num = Number(date);
      if (!isNaN(num) && num > 0) {
        return new Date(num);
      }
      // ISO 문자열인 경우
      return new Date(date);
    } else if (typeof date === 'number' || typeof date === 'bigint') {
      return new Date(Number(date));
    }
    return new Date(date);
  };

  const startDate = parseDate(car.issueDate);
  const endDate = parseDate(car.completionDate || car.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 유효한 날짜인지 확인
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return null;
  }

  // 진행률 계산
  let progress = "0%";
  let progressColor = "text-red-400";
  let barBgColor = "bg-red-500";
  let fillColor = "";
  let fillPercentage = 0;

  if (car.status === "CLOSED") {
    progress = "100%";
    progressColor = "text-emerald-400";
    barBgColor = "bg-emerald-500";
    fillPercentage = 100;
    fillColor = "bg-emerald-500";
  } else if (car.status === "IN_PROGRESS") {
    progress = "50%";
    progressColor = "text-yellow-400";
    barBgColor = "bg-zinc-700";
    fillColor = "bg-yellow-500";
    
    // 오늘까지의 진행률 계산
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsedDuration = Math.min(today.getTime(), endDate.getTime()) - startDate.getTime();
    fillPercentage = Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));
  } else if (car.status === "DELAYED") {
    progress = "0%";
    progressColor = "text-red-400";
    barBgColor = "bg-red-500";
    fillPercentage = 0;
    fillColor = "bg-red-500";
  }

  // 간트바 위치 계산 (전체 범위 대비)
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  const startOffset = Math.max(0, (startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  const duration = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const leftPercent = (startOffset / totalDays) * 100;
  const widthPercent = (duration / totalDays) * 100;

  const rowBgClass = isEven ? 'bg-zinc-900/50' : 'bg-zinc-800/30';

  return (
    <tr 
      className={`${rowBgClass} border-b border-zinc-800 hover:bg-zinc-700/70 transition-colors cursor-pointer`}
      onClick={onRowClick}
    >
          {/* 카테고리 (mainCategory) */}
          <td className={`px-2 py-2 text-left text-zinc-200 font-medium sticky left-0 ${rowBgClass} z-10 border-r border-zinc-700 truncate`} style={{ width: '180px', maxWidth: '180px' }}>
            <div className="truncate">{car.mainCategory || '-'}</div>
          </td>
      
      {/* 내부 담당자 */}
      <td className={`px-2 py-2 text-left text-zinc-300 sticky left-[180px] ${rowBgClass} z-10 border-r border-zinc-700 truncate`} style={{ width: '150px', maxWidth: '150px' }}>
        <div className="truncate">{car.internalContact || '-'}</div>
      </td>
      
      {/* 진행률 */}
      <td className={`px-2 py-2 text-center font-bold ${progressColor} sticky left-[330px] ${rowBgClass} z-10 border-r border-zinc-700`} style={{ width: '70px', maxWidth: '70px' }}>
        {progress}
      </td>
      
      {/* 간트바 영역 */}
      <td colSpan={months.length} className="relative px-2 py-3">
        <div className="relative h-8 flex items-center" style={{ minWidth: `${months.length * 64}px` }}>
          {/* 간트바 */}
          <div 
            className={`absolute h-5 rounded ${barBgColor} overflow-hidden`}
            style={{
              left: `${leftPercent}%`,
              width: `${Math.max(widthPercent, 0.5)}%`
            }}
          >
            {/* 진행 채우기 */}
            {(car.status === "CLOSED" || (car.status === "IN_PROGRESS" && fillPercentage > 0)) && (
              <div 
                className={`absolute inset-y-0 left-0 ${fillColor}`}
                style={{ width: `${fillPercentage}%` }}
              ></div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
