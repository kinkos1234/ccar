"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthHeaders, getCurrentUser, isAuthenticated } from "@/utils/jwt";
import { useTranslations } from 'next-intl';

interface DxmeEmployee {
  empNo: string;
  empName: string;
  password: string | null;
  email: string | null;
  deptName: string | null;
  companyName: string | null;
}

export default function NewUserPage() {
  const t = useTranslations('admin.user');
  const [formData, setFormData] = useState({
    loginId: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'STAFF',
    department: '',
    email: '',
    weeklyReportEmail: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DxmeEmployee[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isPasswordFromEmp, setIsPasswordFromEmp] = useState(false); // 비밀번호가 emp_m에서 가져온 것인지
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    // ADMIN 권한 체크
    if (!user || user.role !== 'ADMIN') {
      // 인증되지 않은 경우 로그인 페이지로, 권한 없는 경우 CAR 페이지로
      if (!user) {
        router.push('/login');
      } else {
        router.push('/car');
      }
      return;
    }
  }, [router]);

  // DXME 직원 검색
  const searchEmployees = async (query: string) => {
    if (!query || query.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/auth/dxme/employees/search?query=${encodeURIComponent(query)}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(t('search.failed'));
      }

      const data = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (err: any) {
      console.error('직원 검색 오류:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 검색어 입력 디바운스
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchEmployees(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 직원 선택
  const selectEmployee = (employee: DxmeEmployee) => {
    const empPassword = employee.password || '';
    setFormData(prev => ({
      ...prev,
      loginId: employee.email || employee.empNo,
      name: employee.empName,
      password: empPassword,
      confirmPassword: empPassword,
      department: employee.deptName || '',
      email: employee.email || ''
    }));
    setIsPasswordFromEmp(!!employee.password); // 비밀번호가 있으면 true
    setSearchQuery('');
    setShowSearchResults(false);
    setSearchResults([]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    if (!formData.loginId.trim()) {
      setError(t('validation.loginIdRequired'));
      return false;
    }
    if (!formData.password.trim()) {
      setError(t('validation.passwordRequired'));
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('validation.passwordMismatch'));
      return false;
    }
    if (!formData.name.trim()) {
      setError(t('validation.nameRequired'));
      return false;
    }
    if (!['ADMIN', 'MANAGER', 'STAFF', 'INACTIVE'].includes(formData.role)) {
      setError(t('validation.invalidRole'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          loginId: formData.loginId,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          department: formData.department,
          email: formData.email,
          weeklyReportEmail: formData.weeklyReportEmail,
          isPasswordEncrypted: isPasswordFromEmp // emp_m에서 가져온 비밀번호는 이미 BCrypt로 암호화됨
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('messages.createError'));
      }

      alert(t('messages.createSuccess'));
      router.push('/admin');
    } catch (err: any) {
      console.error('사용자 생성 오류:', err);
      setError(err.message || t('messages.createError'));
    } finally {
      setLoading(false);
    }
  };

  // 권한 체크: ADMIN이 아닌 경우
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">{t('error.accessDeniedTitle')}</div>
          <div className="text-zinc-400 mb-4">
            {!currentUser ? t('error.loginRequired') : t('error.adminRequired')}
          </div>
          <button
            onClick={() => router.push(!currentUser ? '/login' : '/car')}
            className="bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
          >
            {!currentUser ? t('error.loginPageButton') : t('error.carPageButton')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
          >
            {t('backButton')}
          </Link>
          <h1 className="text-lg font-semibold text-zinc-100">{t('newTitle')}</h1>
        </div>

        {/* 폼 */}
        <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-red-400/90 text-[13px]">
                {error}
              </div>
            )}

            {/* 사용자 검색 */}
            <div className="bg-[#111167]/10 border border-[#111167]/30 rounded-lg p-4">
              <label className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                {t('search.title')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                  placeholder={t('search.placeholder')}
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="w-4 h-4 border-2 border-[#111167] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}

                {/* 검색 결과 */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[#111113] border border-zinc-800/60 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                    {searchResults.map((employee) => (
                      <button
                        key={employee.empNo}
                        type="button"
                        onClick={() => selectEmployee(employee)}
                        className="w-full px-4 py-3 text-left hover:bg-zinc-800/60 transition-colors border-b border-zinc-800/60 last:border-b-0"
                      >
                        <div className="text-[13px] text-zinc-100 font-medium">{employee.empName}</div>
                        <div className="text-[12px] text-zinc-500">{employee.email || employee.empNo}</div>
                        <div className="text-[11px] text-zinc-600">
                          {[employee.companyName, employee.deptName].filter(Boolean).join(' / ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showSearchResults && searchQuery && searchResults.length === 0 && !isSearching && (
                  <div className="absolute z-10 w-full mt-1 bg-[#111113] border border-zinc-800/60 rounded-lg shadow-2xl p-4">
                    <div className="text-zinc-500 text-[13px] text-center">{t('search.noResults')}</div>
                  </div>
                )}
              </div>
            </div>

            {/* 로그인 ID */}
            <div>
              <label htmlFor="loginId" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                {t('fields.loginId')} *
              </label>
              <input
                type="text"
                id="loginId"
                name="loginId"
                value={formData.loginId}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                placeholder={t('placeholders.loginId')}
                required
              />
            </div>

            {/* 이름 */}
            <div>
              <label htmlFor="name" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                {t('fields.name')} *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                placeholder={t('placeholders.name')}
                required
              />
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                {t('fields.password')} *
                {isPasswordFromEmp && (
                  <span className="ml-2 text-[11px] text-emerald-400">{t('autoFilled')}</span>
                )}
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={(e) => {
                  handleChange(e);
                  setIsPasswordFromEmp(false); // 수동 입력 시 플래그 해제
                }}
                className={`w-full px-3 py-2 bg-zinc-900 border rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${
                  isPasswordFromEmp ? 'border-emerald-600' : 'border-zinc-700'
                }`}
                placeholder={t('placeholders.password')}
                required
              />
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                {t('fields.confirmPassword')} *
                {isPasswordFromEmp && (
                  <span className="ml-2 text-[11px] text-emerald-400">{t('autoFilled')}</span>
                )}
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => {
                  handleChange(e);
                  setIsPasswordFromEmp(false); // 수동 입력 시 플래그 해제
                }}
                className={`w-full px-3 py-2 bg-zinc-900 border rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors ${
                  isPasswordFromEmp ? 'border-emerald-600' : 'border-zinc-700'
                }`}
                placeholder={t('placeholders.confirmPassword')}
                required
              />
            </div>

            {/* 역할 */}
            <div>
              <label htmlFor="role" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                {t('fields.role')} *
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                required
              >
                <option value="INACTIVE">{t('roles.inactiveOption')}</option>
                <option value="STAFF">{t('roles.staffOption')}</option>
                <option value="MANAGER">{t('roles.managerOption')}</option>
                <option value="ADMIN">{t('roles.adminOption')}</option>
              </select>
              <div className="mt-2 text-[12px] text-zinc-500 space-y-0.5">
                <div>{t('rolePermissions.staff')}</div>
                <div>{t('rolePermissions.manager')}</div>
                <div>{t('rolePermissions.admin')}</div>
              </div>
            </div>

            {/* 부서 */}
            <div>
              <label htmlFor="department" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                {t('fields.department')}
              </label>
              <input
                type="text"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                placeholder={t('placeholders.department')}
              />
            </div>

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                {t('fields.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                placeholder={t('placeholders.email')}
              />
            </div>

            {/* 주간 보고서 이메일 수신 */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="weeklyReportEmail"
                  checked={formData.weeklyReportEmail}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#111167] bg-zinc-900 border-zinc-700 rounded focus:ring-[#111167] focus:ring-2"
                />
                <div>
                  <div className="text-[13px] font-medium text-zinc-300">{t('weeklyReportStatus.checkboxLabel')}</div>
                  <div className="text-[12px] text-zinc-500">
                    {t('weeklyReportStatus.checkboxDesc')}
                  </div>
                </div>
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#111167] hover:bg-[#1a1a80] disabled:bg-zinc-700 text-white rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('loadingStates.creating')}
                  </div>
                ) : (
                  t('createButton')
                )}
              </button>
              <Link
                href="/admin"
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors text-center"
              >
                {t('cancelButton')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}