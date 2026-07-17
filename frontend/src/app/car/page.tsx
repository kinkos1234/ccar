"use client";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useTranslations } from 'next-intl';
import { apiFetch } from "@/utils/api";
import { useRouter, useSearchParams } from "next/navigation";
import { addStatusToCars } from "@/utils/carStatus";
import { sortTableData, toggleSortDirection, type TableSortConfig } from "@/utils/sort";
import { isAuthenticated } from "@/utils/jwt";
import Pagination, { usePagination } from "@/components/Pagination";
import SortIcon from "@/components/SortIcon";
import CarDetailModal from "@/components/CarDetailModal";
import CarEditModal from "@/components/CarEditModal";
import RiskIndicator from "@/components/RiskIndicator";

// CustomMonthPicker 컴포넌트 정의
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const parseValue = (val: string) => {
    if (!val || !val.includes('-')) {
      return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    }
    const [yearStr, monthStr] = val.split('-');
    return {
      year: parseInt(yearStr) || new Date().getFullYear(),
      month: parseInt(monthStr) || new Date().getMonth() + 1
    };
  };

  useEffect(() => {
    const { year, month } = parseValue(value);
    setSelectedYear(year);
    setSelectedMonth(month);
  }, [value]);

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
    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    const newValue = `${newYear}-${newMonth.toString().padStart(2, '0')}`;
    onChange(newValue);
    setIsOpen(false);
  };

  const displayValue = value ?
    `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}` :
    td('selectMonth');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col" ref={dropdownRef}>
      <label className="text-[13px] font-medium text-zinc-300 mb-1">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="h-9 px-2 text-[13px] w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#111167] text-left flex items-center justify-between"
        >
          <span>{displayValue}</span>
          <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#111113] border border-zinc-800/60 rounded-lg z-10 max-h-64 overflow-auto">
            <div className="p-3">
              <div className="text-[12px] text-zinc-500 mb-2">{td('year')}</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {years.map(year => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    className={`px-2 py-1 text-[12px] rounded-lg ${
                      selectedYear === year
                        ? 'bg-[#111167] text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>

              <div className="text-[12px] text-zinc-500 mb-2">{td('month')}</div>
              <div className="grid grid-cols-4 gap-1">
                {months.map(month => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleYearMonthSelect(selectedYear, month)}
                    className={`px-2 py-1 text-[12px] rounded-lg ${
                      selectedMonth === month && parseValue(value).year === selectedYear
                        ? 'bg-[#111167] text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                  }}
                  className="w-full px-2 py-1 text-[12px] bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-lg"
                >
                  {td('clear')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  eventType: "ONE_TIME" | "CONTINUOUS";
  status?: string;
  issueDate: string;
  importance: number;
  completionDate?: string;
  dueDate?: string;
  score?: number;
  internalContact?: string;
  riskMitigation?: boolean;
  riskLevel?: string;
  riskDescription?: string;
  mainCategory?: string;
};

type User = {
  id: number;
  name: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
};

export default function CarListPage() {
  const t = useTranslations('car');
  const tc = useTranslations('common');
  const tr = useTranslations('risk'); // Risk 전용 번역 함수
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false); // 클라이언트 렌더링 여부
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || ""); // 검색 입력 상태

  // URL search params에서 필터 초기값 복원
  const [filters, setFilters] = useState(() => ({
    corporation: searchParams.get('corp') || t('all'),
    customerGroup: searchParams.get('customerGroup') || t('all'),
    eventType: searchParams.get('eventType') || t('all'),
    status: searchParams.get('status') || 'all',
    startMonth: searchParams.get('startMonth') || "",
    endMonth: searchParams.get('endMonth') || "",
    search: searchParams.get('search') || "",
    risk: searchParams.get('risk') || 'all',
    riskLevel: searchParams.get('riskLevel') || 'all'
  }));

  // 필터 변경 시 URL search params 동기화
  const syncFiltersToUrl = useCallback((newFilters: typeof filters) => {
    const params = new URLSearchParams();
    if (newFilters.corporation !== t('all')) params.set('corp', newFilters.corporation);
    if (newFilters.customerGroup !== t('all')) params.set('customerGroup', newFilters.customerGroup);
    if (newFilters.eventType !== t('all')) params.set('eventType', newFilters.eventType);
    if (newFilters.status !== 'all') params.set('status', newFilters.status);
    if (newFilters.startMonth) params.set('startMonth', newFilters.startMonth);
    if (newFilters.endMonth) params.set('endMonth', newFilters.endMonth);
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.risk !== 'all') params.set('risk', newFilters.risk);
    if (newFilters.riskLevel !== 'all') params.set('riskLevel', newFilters.riskLevel);
    const qs = params.toString();
    router.replace(qs ? `/car?${qs}` : '/car', { scroll: false });
  }, [t, router]);

  // setFilters를 래핑하여 URL 동기화 포함
  const updateFilters = useCallback((updater: ((prev: typeof filters) => typeof filters) | typeof filters) => {
    setFilters(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // router.replace는 렌더링 중 호출 불가 → queueMicrotask로 지연
      queueMicrotask(() => syncFiltersToUrl(next));
      return next;
    });
  }, [syncFiltersToUrl]);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 모달 상태
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 편집 모달 상태
  const [editCarId, setEditCarId] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- 전체 데이터 조회 (페이징 제거) ---
  const [, setTotal] = useState(0);

  // 1. filterOptions 상태 추가
  const [filterOptions, setFilterOptions] = useState({
    corporations: [],
    customers: [],
    departments: [],
    mainCategories: [],
    eventTypes: [],
  });

  // 2. 마운트 시 전체 옵션 fetch (1회만)
  useEffect(() => {
    apiFetch('/api/car/filters')
      .then(setFilterOptions)
      .catch(() => setFilterOptions({ corporations: [], customers: [], departments: [], mainCategories: [], eventTypes: [] }));
  }, []);

  // status 값 매핑 (향후 확장을 위해 유지)
  // const statusMap: Record<string, string> = {
  //   [t('all')]: "",
  //   "IN_PROGRESS": "in_progress",
  //   "CLOSED": "closed",
  //   // 필요시 DELAYED 등 추가
  // };
  // const statusParam = (filters.status in statusMap) ? statusMap[filters.status] : "";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // 로그인 상태 확인
      if (!isAuthenticated()) {
        setError(t('loginRequired'));
        setLoading(false);
        return;
      }

      try {
        // 백엔드 API 파라미터 구성
        const params = new URLSearchParams();
        if (filters.corporation !== t('all')) params.append("corp", filters.corporation);
        if (filters.customerGroup !== t('all')) params.append("customerGroup", filters.customerGroup);
        if (filters.startMonth) params.append("issueDateStart", filters.startMonth + "-01");
        if (filters.endMonth) {
          // endMonth의 마지막 날을 계산
          const [year, month] = filters.endMonth.split('-').map(Number);
          const lastDay = new Date(year, month, 0).getDate();
          params.append("issueDateEnd", filters.endMonth + `-${lastDay.toString().padStart(2, '0')}`);
        }
        if (filters.search) params.append("search", filters.search);
        // Risk 필터 매개변수 추가 (2025-10-01)
        if (filters.risk !== 'all') params.append("risk", filters.risk);
        if (filters.riskLevel !== 'all') params.append("riskLevel", filters.riskLevel);
        params.append("page", "1");
        params.append("limit", "1000"); // 전체 데이터 요청

        const result = await apiFetch(`/api/car?${params}`);
        setCars(result.items || []);
        setTotal(result.total || 0);

        // 필터 옵션은 별도로 가져오기
        const filterResult = await apiFetch("/api/car/filters");
        setFilterOptions(filterResult);
      } catch (err: unknown) {
        setError((err as Error).message || t('dataLoadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters.corporation, filters.customerGroup, filters.startMonth, filters.endMonth, filters.search, filters.status, filters.eventType, filters.risk, filters.riskLevel, refreshKey, t]);

  // 서버에서 받은 cars에 통합된 상태 계산 함수로 status 추가 후 필터링
  const filteredCars = useMemo(() => {
    // 1. cars에 통합된 상태 계산 함수로 status 추가 (백엔드와 동일한 로직)
    const carsWithStatus = addStatusToCars(cars);

    // 2. 프론트에서 status, eventType 필터링
    return carsWithStatus.filter(car => {
      // status 필터
      if (filters.status !== 'all' && car.status !== filters.status) {
        return false;
      }
      // eventType 필터
      if (filters.eventType !== t('all') && car.eventType !== filters.eventType) {
        return false;
      }
      return true;
    });
  }, [cars, filters.status, filters.eventType, t]);

  // 테이블 정렬 상태 (기본: issue date 최신순)
  const [carsSort, setCarsSort] = useState<TableSortConfig>({
    column: 'issueDate',
    direction: 'desc'
  });

  // 정렬된 CAR 목록 생성
  const sortedFilteredCars = useMemo(() => {
    return sortTableData(filteredCars, carsSort.column, carsSort.direction);
  }, [filteredCars, carsSort]);

  // 페이지네이션 상태 추가 (정렬된 데이터 사용)
  const carsPagination = usePagination(sortedFilteredCars, 15);

  // 클라이언트 렌더링 확인 및 사용자 정보 로드
  useEffect(() => {
    setIsClient(true); // 클라이언트에서만 true로 설정
    try {
      const userStr = sessionStorage.getItem("user");
      if (userStr) setUser(JSON.parse(userStr));
    } catch {}
  }, []);

  // searchInput과 filters.search 동기화
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // 3. 드롭다운 옵션 생성 (cars/carsWithStatus 사용 X)
  const corporationOptions = [t('all'), ...((filterOptions.corporations || []))];
  const customerGroupOptions = [
    t('all'),
    ...((filterOptions.customers || []))
  ];
  const eventTypeOptions = [t('all'), ...((filterOptions.eventTypes || []))];
  // 향후 사용을 위해 유지:
  // const departmentOptions = [t('all'), ...((filterOptions.departments || []))];
  // const mainCategoryOptions = [t('all'), ...((filterOptions.mainCategories || []));

  // 삭제 핸들러
  const handleDelete = async (id: number) => {
    if (!confirm(t('deleteConfirm'))) return;
    setDeletingId(id);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`/api/car/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (!res.ok) throw new Error(t('deleteFailed'));
      setCars(prev => prev.filter(car => car.id !== id));
    } catch (e: unknown) {
      alert((e as Error).message || t('deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  // 모달 핸들러
  const handleCarDetail = (carId: number) => {
    setSelectedCarId(carId);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCarId(null);
  };

  const handleCarDeleted = () => {
    // 모달에서 삭제 후 목록 새로고침
    setCars(prev => prev.filter(car => car.id !== selectedCarId));
  };

  // searchInput 상태는 상단에서 이미 선언됨

  // BigInt를 포함한 날짜 타입을 안전하게 포맷팅하는 함수
  function formatDate(dateValue: string | number | bigint | Date | null | undefined): string {
    if (!dateValue) return '-';

    // BigInt인 경우 Number로 변환
    if (typeof dateValue === 'bigint') {
      dateValue = Number(dateValue);
    }

    // 문자열 숫자인 경우 Number로 변환
    if (typeof dateValue === 'string' && /^\d+$/.test(dateValue)) {
      dateValue = Number(dateValue);
    }

    // 이미 YYYY-MM-DD 형태 문자열인 경우 그대로 사용
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
      return dateValue.slice(0, 10);
    }

    // 숫자(timestamp)인 경우 Date 객체로 변환
    const date = new Date(dateValue);

    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) return '-';

    return date.toISOString().slice(0, 10);
  }

  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    updateFilters(f => ({ ...f, search: trimmedSearch }));

    // 토스트 메시지 표시
    if (trimmedSearch) {
      const searchTerms = trimmedSearch.split(',').map(s => s.trim()).filter(Boolean);
      const termCount = searchTerms.length;
      setToast(`담당자 검색 적용됨 (${termCount}개 검색어)`);
    } else {
      setToast('검색어가 지워졌습니다');
    }
    setTimeout(() => setToast(null), 1500);
  };

  const handleReset = () => {
    // 모든 필터 초기화
    const resetFilters = {
      corporation: t('all'),
      customerGroup: t('all'),
      eventType: t('all'),
      status: 'all',
      startMonth: "",
      endMonth: "",
      search: "",
      // Risk 필터 초기화 (2025-10-01)
      risk: 'all',
      riskLevel: 'all'
    };
    updateFilters(resetFilters);
    setSearchInput("");

    // 정렬 상태도 초기화
    setCarsSort({
      column: '',
      direction: null
    });

    // 첫 페이지로 이동
    carsPagination.handlePageChange(1);

    // 토스트 메시지 표시
    setToast('모든 필터가 초기화되었습니다');
    setTimeout(() => setToast(null), 1500);
  };

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  // 테이블 정렬 핸들러
  const handleSort = (column: string) => {
    const newDirection = toggleSortDirection(
      carsSort.column === column ? carsSort.direction : null
    );

    setCarsSort({
      column,
      direction: newDirection
    });

    // 정렬 후 첫 페이지로 이동
    carsPagination.handlePageChange(1);
  };

  // 클라이언트 렌더링이 완료되지 않았으면 로딩 상태
  if (!isClient) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-zinc-400 text-[14px]">{t('loading')}</div>
        </div>
      </div>
    );
  }

  // 권한 체크: 클라이언트에서만 체크
  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">접근 권한 없음</div>
          <div className="text-zinc-400 text-[14px] mb-4">{t('loginRequired')}</div>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-zinc-400 text-[14px]">{t('loading')}</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="text-center">
        <div className="text-red-400 text-lg mb-2">오류 발생</div>
        <div className="text-zinc-400 text-[14px]">{error}</div>
      </div>
    </div>
  );

  if (filterOptions.corporations.length === 0 && filterOptions.customers.length === 0 && filterOptions.eventTypes.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">설정 오류</div>
          <div className="text-zinc-400 text-[14px]">필터 옵션을 불러올 수 없습니다. 관리자에게 문의하세요.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
      {/* 토스트 메시지 */}
      {toast && (
        <div className="fixed top-4 right-4 bg-[#111167] text-white px-4 py-2 rounded-lg z-50 transition-all text-[13px]">
          {toast}
        </div>
      )}

      <div className="max-w-full mx-auto px-2 lg:px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-zinc-100">{t('list')}</h1>
          {/* 우측 버튼 2개: 고객 정보 관리, 신규 등록 */}
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium transition-colors border border-zinc-800/60"
              onClick={() => router.push("/car/customer")}
            >
              {t('customerManagement')}
            </button>
            <button
              className="px-3 py-1.5 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
              onClick={() => router.push("/car/new")}
            >
              {t('new')}
            </button>
          </div>
        </div>
        {/* 필터 영역 */}
        <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-4 lg:p-5 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-zinc-300 mb-1">{t('corporation')}</label>
              <select className="h-9 px-2 text-[13px] w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#111167]" value={filters.corporation} onChange={e => updateFilters(f => ({ ...f, corporation: e.target.value }))}>
                {corporationOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-zinc-300 mb-1">{t('customerGroup')}</label>
              <select className="h-9 px-2 text-[13px] w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#111167]" value={filters.customerGroup} onChange={e => updateFilters(f => ({ ...f, customerGroup: e.target.value }))}>
                {customerGroupOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-zinc-300 mb-1">{t('eventType')}</label>
              <select className="h-9 px-2 text-[13px] w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#111167]" value={filters.eventType} onChange={e => updateFilters(f => ({ ...f, eventType: e.target.value }))}>
                {eventTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-zinc-300 mb-1">{t('statusLabel')}</label>
              <select className="h-9 px-2 text-[13px] w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#111167]" value={filters.status} onChange={e => updateFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="all">{t('all')}</option>
                <option value="CLOSED">{t('status.CLOSED')}</option>
                <option value="IN_PROGRESS">{t('status.IN_PROGRESS')}</option>
                <option value="DELAYED">{t('status.DELAYED')}</option>
              </select>
            </div>
            {/* Risk 필터 추가 (2025-10-01) */}
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-zinc-300 mb-1">{tr('filter.label')}</label>
              <select className="h-9 px-2 text-[13px] w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#111167]" value={filters.risk} onChange={e => updateFilters(f => ({ ...f, risk: e.target.value }))}>
                <option value="all">{tr('filter.all')}</option>
                <option value="true">{tr('filter.withRisk')}</option>
                <option value="false">{tr('filter.noRisk')}</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-zinc-300 mb-1">{tr('filter.byLevel')}</label>
              <select className="h-9 px-2 text-[13px] w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#111167]" value={filters.riskLevel} onChange={e => updateFilters(f => ({ ...f, riskLevel: e.target.value }))}>
                <option value="all">{t('all')}</option>
                <option value="LOW">{tr('level.low')}</option>
                <option value="MEDIUM">{tr('level.medium')}</option>
                <option value="HIGH">{tr('level.high')}</option>
                <option value="CRITICAL">{tr('level.critical')}</option>
              </select>
            </div>
            <CustomMonthPicker
              label={t('from')}
              value={filters.startMonth}
              onChange={(value) => updateFilters(f => ({ ...f, startMonth: value }))}
              td={t}
            />
            <CustomMonthPicker
              label={t('to')}
              value={filters.endMonth}
              onChange={(value) => updateFilters(f => ({ ...f, endMonth: value }))}
              td={t}
            />
            <div className="flex flex-col col-span-2">
              <label className="text-[13px] font-medium text-zinc-300 mb-1">{t('search')}</label>
              <div className="flex">
                <input
                  type="text"
                  className="h-9 px-2 text-[13px] flex-1 min-w-0 rounded-l-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167]"
                  placeholder={t('searchPlaceholder')}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchInputKeyDown}
                />
                <button
                  className="px-3 h-9 bg-[#111167] hover:bg-[#1a1a80] text-white border-l-0 transition-colors flex-shrink-0 flex items-center justify-center"
                  onClick={handleSearch}
                  aria-label={t('search')}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="11" cy="11" r="7" strokeWidth="2"/>
                    <path strokeWidth="2" d="M21 21l-4.35-4.35"/>
                  </svg>
                </button>
                <button
                  className="px-3 h-9 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-r-lg border-l border-zinc-700 transition-colors flex-shrink-0 flex items-center justify-center"
                  onClick={handleReset}
                  aria-label={t('reset')}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 필터 적용 상태 표시 */}
          <div className="mt-3 flex items-center text-[12px] text-zinc-500 flex-wrap gap-1">
            {filters.corporation !== t('all') && (
              <span className="bg-[#111167]/20 text-[#7b7bff] px-2 py-0.5 rounded">
                {t('corporation')}: {filters.corporation}
              </span>
            )}
            {filters.customerGroup !== t('all') && (
              <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                {t('customerGroup')}: {filters.customerGroup}
              </span>
            )}
            {filters.eventType !== t('all') && (
              <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded">
                {t('eventType')}: {filters.eventType}
              </span>
            )}
            {filters.status !== 'all' && (
              <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded">
                {t('statusLabel')}: {t(`status.${filters.status}`)}
              </span>
            )}
            {/* Risk 필터 상태 표시 (2025-10-01) */}
            {filters.risk !== 'all' && (
              <span className="bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded">
                {tr('filter.label')}: {filters.risk === 'true' ? tr('filter.withRisk') : tr('filter.noRisk')}
              </span>
            )}
            {filters.riskLevel !== 'all' && (
              <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded">
                {tr('filter.byLevel')}: {tr(`level.${filters.riskLevel.toLowerCase()}`)}
              </span>
            )}
            {(filters.startMonth || filters.endMonth) && (
              <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">
                {t('dateRange')}: {filters.startMonth || t('from')} ~ {filters.endMonth || t('to')}
              </span>
            )}
            {filters.search.trim() && (
              <span className="bg-[#111167]/20 text-[#7b7bff] px-2 py-0.5 rounded">
                {t('search')}: {filters.search.slice(0, 20)}{filters.search.length > 20 ? '...' : ''}
              </span>
            )}
            {(carsSort.column && carsSort.direction) && (
              <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded">
                {tc('sort')}: {carsSort.column} {carsSort.direction === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </div>
        </div>
        {/* 테이블 영역 */}
        <div className="bg-[#111113] border border-zinc-800/60 rounded-lg overflow-hidden">
          {/* 검색 결과 요약 */}
          <div className="px-4 py-2.5 bg-zinc-900/50 border-b border-zinc-800/60 flex items-center justify-between">
            <div className="text-[13px] text-zinc-400">
              {t('all')} <span className="font-semibold text-zinc-100">{sortedFilteredCars.length}</span>{t('items')}
              {filters.search.trim() && (
                <>
                  {' '}| {t('search')}: <span className="font-semibold text-[#7b7bff]">{filters.search}</span>
                </>
              )}
            </div>
            <div className="text-[12px] text-zinc-500">
              {carsPagination.currentPage}/{carsPagination.totalPages} {tc('pageOf')}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[1600px]">
            <thead>
              <tr className="bg-zinc-900/50 border-b border-zinc-800/40">
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[100px] cursor-pointer hover:bg-zinc-800/40 transition-colors select-none" onClick={() => handleSort('issueDate')}>
                  <div className="flex items-center justify-center gap-1">
                    {t('issueDate')}
                    <SortIcon direction={carsSort.column === 'issueDate' ? carsSort.direction : null} />
                  </div>
                </th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[80px] cursor-pointer hover:bg-zinc-800/40 transition-colors select-none" onClick={() => handleSort('corporation')}>
                  <div className="flex items-center justify-center gap-1">
                    {t('corporation')}
                    <SortIcon direction={carsSort.column === 'corporation' ? carsSort.direction : null} />
                  </div>
                </th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[120px] cursor-pointer hover:bg-zinc-800/40 transition-colors select-none" onClick={() => handleSort('eventType')}>
                  <div className="flex items-center justify-center gap-1">
                    {t('eventType')}
                    <SortIcon direction={carsSort.column === 'eventType' ? carsSort.direction : null} />
                  </div>
                </th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[120px] cursor-pointer hover:bg-zinc-800/40 transition-colors select-none" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center gap-1">
                    {t('statusLabel')}
                    <SortIcon direction={carsSort.column === 'status' ? carsSort.direction : null} />
                  </div>
                </th>
                {/* Risk 컬럼 추가 (2025-10-01) */}
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[80px]">{t('risk')}</th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[150px]">{t('customerGroup')}</th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[120px]">{t('department')}</th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[130px]">{t('mainCategory')}</th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[140px]">{t('customerContact')}</th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[140px]">{t('internalContact')}</th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[100px] cursor-pointer hover:bg-zinc-800/40 transition-colors select-none" onClick={() => handleSort('dueDate')}>
                  <div className="flex items-center justify-center gap-1">
                    {t('dueDate')}
                    <SortIcon direction={carsSort.column === 'dueDate' ? carsSort.direction : null} />
                  </div>
                </th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[100px] cursor-pointer hover:bg-zinc-800/40 transition-colors select-none" onClick={() => handleSort('completionDate')}>
                  <div className="flex items-center justify-center gap-1">
                    {t('completionDate')}
                    <SortIcon direction={carsSort.column === 'completionDate' ? carsSort.direction : null} />
                  </div>
                </th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[80px] cursor-pointer hover:bg-zinc-800/40 transition-colors select-none" onClick={() => handleSort('score')}>
                  <div className="flex items-center justify-center gap-1">
                    {t('finalScore')}
                    <SortIcon direction={carsSort.column === 'score' ? carsSort.direction : null} />
                  </div>
                </th>
                <th className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider px-2 py-2 text-center min-w-[200px]">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {carsPagination.currentItems.map(car => (
                                 <tr key={car.id} className="hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/40 last:border-b-0">
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{formatDate(car.issueDate)}</td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{car.corporation}</td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{car.eventType}</td>
                   <td className="px-2 py-2 text-center">
                     <span className={`text-[12px] font-medium px-2 py-0.5 rounded ${
                       car.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-400' :
                       car.status === 'IN_PROGRESS' ? 'bg-yellow-500/10 text-yellow-400' :
                       car.status === 'DELAYED' ? 'bg-red-500/10 text-red-400' :
                       'bg-zinc-800 text-zinc-400'
                     }`}>
                       {car.status ? t(`status.${car.status}`) : '-'}
                     </span>
                   </td>
                   {/* Risk 인디케이터 셀 추가 (2025-10-01) */}
                   <td className="px-2 py-2 text-center">
                     <div className="flex justify-center">
                       <RiskIndicator
                         riskMitigation={car.riskMitigation || false}
                         riskLevel={car.riskLevel}
                       />
                     </div>
                   </td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map((cc: CustomerContact) => cc.group).filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i).join(', ') : '-'}</td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map((cc: CustomerContact) => cc.department).filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i).join(', ') : '-'}</td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">
                     <span className="inline-block px-2 py-0.5 bg-[#111167]/20 text-[#7b7bff] rounded text-[12px] font-medium">
                       {car.mainCategory || '-'}
                     </span>
                   </td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{car.customerContacts && car.customerContacts.length > 0 ? car.customerContacts.map((cc: CustomerContact) => (<span key={cc.id}>{cc.name}<br /></span>)) : '-'}</td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{car.internalContact ? car.internalContact.split(',').map((c: string, i: number) => <span key={i}>{c.trim()}<br /></span>) : '-'}</td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{formatDate(car.dueDate)}</td>
                   <td className="px-2 py-2 text-center text-[13px] text-zinc-100">{formatDate(car.completionDate)}</td>
                   <td className="px-2 py-2 text-center">
                     <span className="font-semibold text-[#7b7bff] text-[13px]">
                       {car.score !== undefined && car.score !== null ? Number(car.score).toFixed(1) : '-'}
                     </span>
                   </td>
                   <td className="px-2 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[12px] font-medium transition-colors border border-zinc-800/60"
                        onClick={() => handleCarDetail(car.id)}
                      >
                        {t('view')}
                      </button>
                      <button
                        className="px-2 py-1 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[12px] font-medium transition-colors"
                        onClick={() => router.push(`/car/${car.id}/edit`)}
                      >
                        {t('edit')}
                      </button>
                      <button
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={deletingId === car.id}
                        onClick={() => handleDelete(car.id)}
                      >
                        {deletingId === car.id ? t('loading') : t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {carsPagination.currentItems.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center py-12">
                    <div className="text-zinc-500">
                      <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-8v2m0 0V4m0 3h2m-2 0H8" />
                      </svg>
                      <div className="text-[14px] font-medium text-zinc-400">{t('noData')}</div>
                      <div className="text-[13px] mt-1 text-zinc-500">{tc('searchGuide')}</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* 페이지네이션 추가 */}
        <div className="mt-4">
          <Pagination
            currentPage={carsPagination.currentPage}
            totalItems={carsPagination.totalItems}
            itemsPerPage={15}
            onPageChange={carsPagination.handlePageChange}
            className="text-zinc-100"
          />
        </div>
      </div>

      {/* CAR 상세 모달 */}
      <CarDetailModal
        carId={selectedCarId}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onCarDeleted={handleCarDeleted}
        onEdit={(id) => {
          setIsModalOpen(false);
          setSelectedCarId(null);
          setEditCarId(id);
          setIsEditModalOpen(true);
        }}
      />

      {/* CAR 편집 모달 */}
      <CarEditModal
        carId={editCarId}
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditCarId(null); }}
        onSaved={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
