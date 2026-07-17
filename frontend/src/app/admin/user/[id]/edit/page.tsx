"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getAuthHeaders } from "@/utils/jwt";
import { useTranslations } from 'next-intl';

interface User {
  id: number;
  loginId: string;
  name: string;
  role: string;
  department: string;
  email: string | null;
  weeklyReportEmail: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EditUserPage() {
  const t = useTranslations('admin.user');
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    loginId: '',
    name: '',
    role: 'STAFF',
    department: '',
    email: '',
    weeklyReportEmail: false,
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  useEffect(() => {
    const curr = getCurrentUser();
    setCurrentUser(curr);

    // ADMIN 권한 체크
    if (!curr || curr.role !== 'ADMIN') {
      // 인증되지 않은 경우 로그인 페이지로, 권한 없는 경우 CAR 페이지로
      if (!curr) {
        router.push('/login');
      } else {
        router.push('/car');
      }
      return;
    }

    // ID가 숫자가 아닌 경우 Admin으로 리다이렉트
    if (Array.isArray(userId) || !/^\d+$/.test(userId as string)) {
      router.push('/admin');
      return;
    }

    loadUser();
  }, [userId, router]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/auth/users/${userId}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(t('messages.userNotFound'));
        }
        throw new Error(`Failed to load user: ${response.status}`);
      }

      const data = await response.json();
      setUser(data);
      setFormData({
        loginId: data.loginId,
        name: data.name,
        role: data.role,
        department: data.department || '',
        email: data.email || '',
        weeklyReportEmail: data.weeklyReportEmail || false,
        password: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      console.error('사용자 로드 오류:', err);
      setError(err.message || t('messages.loadError'));
    } finally {
      setLoading(false);
    }
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
    if (!formData.name.trim()) {
      setError(t('validation.nameRequired'));
      return false;
    }
    if (!['ADMIN', 'MANAGER', 'STAFF'].includes(formData.role)) {
      setError(t('validation.invalidRole'));
      return false;
    }

    // 비밀번호가 입력된 경우에만 확인
    if (formData.password.trim() !== '') {
      if (formData.password !== formData.confirmPassword) {
        setError(t('validation.passwordMismatch'));
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    setError(null);

    try {
      const updateData: any = {
        loginId: formData.loginId,
        name: formData.name,
        role: formData.role,
        department: formData.department,
        email: formData.email,
        weeklyReportEmail: formData.weeklyReportEmail
      };

      // 비밀번호가 입력된 경우에만 포함
      if (formData.password.trim() !== '') {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('messages.updateError'));
      }

      alert(t('messages.updateSuccess'));
      router.push(`/admin/user/${userId}`);
    } catch (err: any) {
      console.error('사용자 수정 오류:', err);
      setError(err.message || t('messages.updateError'));
    } finally {
      setSaving(false);
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

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      ADMIN: 'bg-red-500/10 text-red-400',
      MANAGER: 'bg-[#111167]/15 text-[#9999cc]',
      STAFF: 'bg-emerald-500/10 text-emerald-400',
      INACTIVE: 'bg-yellow-500/10 text-yellow-400'
    };
    return styles[role] || 'bg-zinc-800 text-zinc-400';
  };

  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="text-center">
          <div className="text-red-400 text-lg">{t('error.accessDenied')}</div>
          <div className="text-zinc-500 mt-2">{t('error.adminRequired')}</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-[13px] text-zinc-400">{t('messages.loading')}</div>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/admin"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {t('backButton')}
            </Link>
            <h1 className="text-lg font-semibold text-zinc-100">{t('editTitle')}</h1>
          </div>

          <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-6 text-center">
            <div className="text-red-400/90 text-[14px] mb-2">{t('error.title')}</div>
            <div className="text-zinc-400 text-[13px]">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="text-center">
          <div className="text-zinc-500 text-[13px]">{t('messages.userNotFound')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/admin/user/${userId}`}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
          >
            {t('backButton')}
          </Link>
          <h1 className="text-lg font-semibold text-zinc-100">{t('editTitle')}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 기존 정보 표시 */}
          <div className="lg:col-span-1">
            <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-6 sticky top-8">
              <h3 className="text-[14px] font-semibold text-zinc-100 mb-4">{t('sections.currentInfo')}</h3>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#111167] rounded-lg flex items-center justify-center text-[14px] font-semibold text-white">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-[14px] text-zinc-100 font-medium">{user.name}</div>
                    <div className="text-[12px] text-zinc-500">#{user.id}</div>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.loginId')}</label>
                  <div className="text-[13px] text-zinc-100 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-700">{user.loginId}</div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.currentRole')}</label>
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[12px] font-medium ${getRoleBadge(user.role)}`}>
                    {t(`roles.${user.role}`)}
                  </span>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.creationDate')}</label>
                  <div className="text-[12px] text-zinc-400">{formatDate(user.createdAt)}</div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.modificationDate')}</label>
                  <div className="text-[12px] text-zinc-400">{formatDate(user.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 수정 폼 */}
          <div className="lg:col-span-2">
            <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 에러 메시지 */}
                {error && (
                  <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-red-400/90 text-[13px]">
                    {error}
                  </div>
                )}

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

                {/* 비밀번호 섹션 */}
                <div className="border-t border-zinc-800/60 pt-5">
                  <h4 className="text-[14px] font-semibold text-zinc-100 mb-4">{t('sections.passwordChange')}</h4>
                  <div className="space-y-4">
                    {/* 새 비밀번호 */}
                    <div>
                      <label htmlFor="password" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                        {t('fields.newPassword')}
                      </label>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                        placeholder={t('placeholders.newPassword')}
                      />
                      <div className="mt-1 text-[12px] text-zinc-500">
                        {t('messages.passwordChangeNote')}
                      </div>
                    </div>

                    {/* 비밀번호 확인 */}
                    <div>
                      <label htmlFor="confirmPassword" className="text-[13px] font-medium text-zinc-400 mb-1.5 block">
                        {t('fields.newPasswordConfirm')}
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                        placeholder={t('placeholders.newPasswordConfirm')}
                      />
                    </div>
                  </div>
                </div>

                {/* 버튼 */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#111167] hover:bg-[#1a1a80] disabled:bg-zinc-700 text-white rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t('loadingStates.updating')}
                      </div>
                    ) : (
                      t('saveButton')
                    )}
                  </button>
                  <Link
                    href={`/admin/user/${userId}`}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors text-center"
                  >
                    {t('cancelButton')}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}