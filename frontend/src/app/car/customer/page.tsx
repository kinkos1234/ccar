"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from 'next-intl';
import { apiFetch } from "@/utils/api";
import { isAuthenticated } from "@/utils/jwt";
import CustomerDetailModal from "@/components/CustomerDetailModal";

type Customer = {
  id: number;
  group: string;
  company: string;
  department: string;
  name: string;
  phone: string;
  email?: string;
};

export default function CustomerListPage() {
  const t = useTranslations('customer');
  const tAuth = useTranslations('auth');
  const tCar = useTranslations('car');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const [groupFilter, setGroupFilter] = useState(() => searchParams.get('group') || "");
  const [departmentFilter, setDepartmentFilter] = useState(() => searchParams.get('dept') || "");
  const [searchName, setSearchName] = useState(() => searchParams.get('search') || "");
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const router = useRouter();

  // URL 필터 동기화
  const syncFiltersToUrl = useCallback((group: string, dept: string, search: string) => {
    const params = new URLSearchParams();
    if (group) params.set('group', group);
    if (dept) params.set('dept', dept);
    if (search) params.set('search', search);
    const qs = params.toString();
    router.replace(qs ? `/car/customer?${qs}` : '/car/customer', { scroll: false });
  }, [router]);

  // 모달 상태
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 권한 체크 수행
    const checkAuthAndLoadData = async () => {
      try {
        // 로그인 상태 확인
        if (!isAuthenticated()) {
          setError(tAuth('loginRequired'));
          setLoading(false);
          setIsAuthChecking(false);
          return;
        }

        setIsAuthChecking(false);

        const data = await apiFetch("/api/customer");
        const customerData = data.items || data || [];
        setAllCustomers(customerData);
        setCustomers(customerData);
      } catch (err) {
        setError((err as Error).message || t('dataLoadFailed'));
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadData();
  }, []);

  // 필터링 로직
  useEffect(() => {
    let filtered = allCustomers;

    if (groupFilter) {
      filtered = filtered.filter(c => c.group === groupFilter);
    }

    if (departmentFilter) {
      filtered = filtered.filter(c => c.department === departmentFilter);
    }

    if (searchName.trim()) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    setCustomers(filtered);
  }, [allCustomers, groupFilter, departmentFilter, searchName]);

  // 검색 실행
  const handleSearch = () => {
    let filtered = allCustomers;

    if (groupFilter) {
      filtered = filtered.filter(c => c.group === groupFilter);
    }

    if (departmentFilter) {
      filtered = filtered.filter(c => c.department === departmentFilter);
    }

    if (searchName.trim()) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    setCustomers(filtered);
    syncFiltersToUrl(groupFilter, departmentFilter, searchName.trim());
  };

  // 검색창 엔터키 처리
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setGroupFilter("");
    setDepartmentFilter("");
    setSearchName("");
    setCustomers(allCustomers);
    syncFiltersToUrl("", "", "");
  };

  // 고유 그룹/부서 목록 추출
  const uniqueGroups = Array.from(new Set(allCustomers.map(c => c.group).filter(Boolean)));
  const uniqueDepartments = Array.from(new Set(allCustomers.map(c => c.department).filter(Boolean)));

  // 모달 핸들러
  const handleCustomerDetail = (customerId: number) => {
    setSelectedCustomerId(customerId);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedCustomerId(null);
  };

  const handleCustomerDeleted = () => {
    // 모달에서 삭제 후 목록 새로고침
    setAllCustomers(prev => prev.filter(customer => customer.id !== selectedCustomerId));
    setCustomers(prev => prev.filter(customer => customer.id !== selectedCustomerId));
  };



  // 권한 체크 중이거나 로딩 중일 때
  if (isAuthChecking || loading) {
    return (
      <div className="p-8 bg-[#111113] min-h-screen text-white">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-zinc-400">
              {isAuthChecking ? t('checkingAuth') : t('loading')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // 권한 없음 에러는 상단 텍스트로 표시
    if (error === tAuth('loginRequired')) {
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

    // 다른 에러는 기존 원형 아이콘 형태로 표시
    return (
      <div className="p-8 bg-[#111113] min-h-screen text-white">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-400 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
            >
              {t('retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#111113] min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 섹션 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-zinc-100 mb-2">{t('title')}</h1>
              <p className="text-zinc-400">{t('list')}</p>
            </div>
            <button
              className="px-6 py-3 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-all duration-200 flex items-center gap-2"
              onClick={() => router.push("/car/customer/new")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('addNew')}
            </button>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">{t('totalCustomers')}</p>
                  <p className="text-2xl font-bold text-white">{allCustomers.length}</p>
                </div>
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">{t('totalCompanies')}</p>
                  <p className="text-2xl font-bold text-white">{uniqueGroups.length}</p>
                </div>
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">{t('searchResults')}</p>
                  <p className="text-2xl font-bold text-white">{customers.length}</p>
                </div>
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 필터 및 검색 영역 */}
        <div className="mb-6 bg-[#111113] border border-zinc-800/60 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-zinc-200">{t('searchAndFilter')}</h3>
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('reset')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 그룹 필터 */}
            <div>
              <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">{t('group')}</label>
              <select
                value={groupFilter}
                onChange={(e) => { setGroupFilter(e.target.value); syncFiltersToUrl(e.target.value, departmentFilter, searchName); }}
                className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg text-[13px] focus:outline-none focus:border-[#111167] transition-colors"
              >
                <option value="">{t('allGroups')}</option>
                {uniqueGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            {/* 부서 필터 */}
            <div>
              <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">{t('department')}</label>
              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); syncFiltersToUrl(groupFilter, e.target.value, searchName); }}
                className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg text-[13px] focus:outline-none focus:border-[#111167] transition-colors"
              >
                <option value="">{t('allDepartments')}</option>
                {uniqueDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* 이름 검색 */}
            <div className="md:col-span-2">
              <label className="block text-[13px] font-medium text-zinc-400 mb-1.5">{t('nameSearch')}</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  placeholder={t('nameSearchPlaceholder')}
                  className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-100 border border-zinc-700 rounded-lg text-[13px] focus:outline-none focus:border-[#111167] transition-colors pr-12"
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white hover:bg-[#111167] rounded-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 테이블 영역 */}
        <div className="bg-[#111113] border border-zinc-800/60 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] table-fixed">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800/40">
                  <th className="w-16 px-4 py-4 text-left text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t('tableHeaders.id')}</th>
                  <th className="w-32 px-4 py-4 text-left text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t('tableHeaders.group')}</th>
                  <th className="w-32 px-4 py-4 text-left text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t('tableHeaders.companyName')}</th>
                  <th className="w-24 px-4 py-4 text-left text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t('tableHeaders.department')}</th>
                  <th className="w-40 px-4 py-4 text-left text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t('tableHeaders.contact')}</th>
                  <th className="w-48 px-4 py-4 text-left text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t('tableHeaders.email')}</th>
                  <th className="w-32 px-4 py-4 text-center text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t('tableHeaders.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-zinc-800/40 border-b border-zinc-800/40 transition-colors"
                    data-testid={`customer-row-${customer.id}`}
                  >
                    <td className="w-16 px-4 py-4">
                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 text-[13px] font-bold">
                          {customer.id}
                        </div>
                      </div>
                    </td>
                    <td className="w-32 px-4 py-4">
                      <div className="text-[13px] font-medium text-zinc-100 break-words max-h-12 overflow-hidden leading-tight" title={customer.group}>
                        {customer.group}
                      </div>
                    </td>
                    <td className="w-32 px-4 py-4">
                      <div className="text-[13px] text-zinc-300 break-words max-h-12 overflow-hidden leading-tight" title={customer.company || customer.group || '-'}>
                        {customer.company || customer.group || '-'}
                      </div>
                    </td>
                    <td className="w-24 px-4 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-700 text-zinc-200 break-words">
                        {customer.department}
                      </span>
                    </td>
                    <td className="w-40 px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                          <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-zinc-100 truncate" title={customer.name}>
                            {customer.name}
                          </div>
                          <div className="text-xs text-zinc-500 truncate" title={customer.phone || t('noContact')}>
                            {customer.phone || t('noContact')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="w-48 px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                                                      <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-zinc-100 truncate" title={customer.email || t('noEmail')}>
                            {customer.email || t('noEmail')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="w-32 px-4 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          className="inline-flex items-center gap-1 px-3 py-2 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium transition-colors"
                                                  data-testid={`customer-detail-btn-${customer.id}`}
                          onClick={() => handleCustomerDetail(customer.id)}
                          title={t('viewDetails')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                                                     {t('viewDetails')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-zinc-500/20 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <p className="text-zinc-400 text-lg font-medium mb-2">{t('emptyState.title')}</p>
                        <p className="text-zinc-500 text-sm">{t('emptyState.description')}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 푸터 정보 */}
        {customers.length > 0 && (
          <div className="mt-4 flex justify-between items-center text-sm text-zinc-400">
            <p>{t('footer.showing', {count: customers.length})}</p>
            <p>{t('footer.totalShowing', {total: allCustomers.length, showing: customers.length})}</p>
          </div>
        )}
      </div>

      {/* Customer 상세 모달 */}
      <CustomerDetailModal
        customerId={selectedCustomerId}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onCustomerDeleted={handleCustomerDeleted}
      />
    </div>
  );
}