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

export default function UserDetailPage() {
  const t = useTranslations('admin.user');
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    } catch (err: any) {
      console.error('사용자 로드 오류:', err);
      setError(err.message || t('messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async () => {
    if (!user) return;

    if (!confirm(t('messages.deleteConfirm', { name: user.name }))) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('messages.updateError'));
      }

      alert(t('messages.deleteSuccess'));
      router.push('/admin');
    } catch (err: any) {
      console.error('사용자 삭제 오류:', err);
      alert(t('messages.deleteError', { error: err.message }));
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

  const getRoleDescription = (role: string) => {
    const descriptions = {
      ADMIN: t('roles.adminDesc'),
      MANAGER: t('roles.managerDesc'),
      STAFF: t('roles.staffDesc')
    };
    return descriptions[role as keyof typeof descriptions] || t('roles.staffDesc');
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

  if (error) {
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
            <h1 className="text-lg font-semibold text-zinc-100">{t('title')}</h1>
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {t('backButton')}
            </Link>
            <h1 className="text-lg font-semibold text-zinc-100">{t('title')}</h1>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/admin/user/${user.id}/edit`}
              className="bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {t('editButton')}
            </Link>
            {currentUser.id !== user.id && (
              <button
                onClick={deleteUser}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[13px] font-medium px-4 py-2 transition-colors border border-red-900/40"
              >
                {t('deleteButton')}
              </button>
            )}
          </div>
        </div>

        {/* 사용자 정보 카드 */}
        <div className="bg-[#111113] border border-zinc-800/60 rounded-lg overflow-hidden">
          {/* 헤더 섹션 */}
          <div className="bg-zinc-900 px-8 py-6 border-b border-zinc-800/60">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#111167] rounded-lg flex items-center justify-center text-xl font-semibold text-white">
                {user.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-zinc-100">{user.name}</h2>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-medium ${getRoleBadge(user.role)}`}>
                    {t(`roles.${user.role}`)}
                  </span>
                  <span className="text-[12px] text-zinc-500">#{user.id}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 정보 섹션 */}
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 기본 정보 */}
              <div className="space-y-4">
                <h3 className="text-[14px] font-semibold text-zinc-100 border-b border-zinc-800/60 pb-2">{t('sections.basicInfo')}</h3>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.userId')}</label>
                  <div className="text-[14px] text-zinc-100 font-mono bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-700">#{user.id}</div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.loginId')}</label>
                  <div className="text-[14px] text-zinc-100 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-700">{user.loginId}</div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.name')}</label>
                  <div className="text-[14px] text-zinc-100 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-700">{user.name}</div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.department')}</label>
                  <div className="text-[14px] text-zinc-100 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-700">{user.department || '-'}</div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.email')}</label>
                  <div className="text-[14px] text-zinc-100 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-700">{user.email || '-'}</div>
                </div>
              </div>

              {/* 권한 정보 */}
              <div className="space-y-4">
                <h3 className="text-[14px] font-semibold text-zinc-100 border-b border-zinc-800/60 pb-2">{t('sections.permissionInfo')}</h3>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.role')}</label>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[12px] font-medium ${getRoleBadge(user.role)}`}>
                      {t(`roles.${user.role}`)}
                    </span>
                  </div>
                  <div className="text-[12px] text-zinc-500 mt-2">{getRoleDescription(user.role)}</div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.accessibleFeatures')}</label>
                  <div className="space-y-1 text-[12px]">
                    <div className="text-emerald-400">{t('accessFeatures.carManagement')}</div>
                    <div className="text-emerald-400">{t('accessFeatures.dashboard')}</div>
                    {(['ADMIN', 'MANAGER'].includes(user.role)) && (
                      <div className="text-emerald-400">{t('accessFeatures.reportManagement')}</div>
                    )}
                    {user.role === 'ADMIN' && (
                      <>
                        <div className="text-emerald-400">{t('accessFeatures.aiAnalysis')}</div>
                        <div className="text-emerald-400">{t('accessFeatures.userManagement')}</div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.weeklyReportEmail')}</label>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[12px] font-medium ${user.weeklyReportEmail ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {user.weeklyReportEmail ? t('weeklyReportStatus.enabled') : t('weeklyReportStatus.disabled')}
                    </span>
                  </div>
                  <div className="text-[12px] text-zinc-500 mt-1">
                    {user.weeklyReportEmail ? t('weeklyReportStatus.enabledDesc') : t('weeklyReportStatus.disabledDesc')}
                  </div>
                </div>
              </div>
            </div>

            {/* 날짜 정보 */}
            <div className="pt-6 border-t border-zinc-800/60">
              <h3 className="text-[14px] font-semibold text-zinc-100 mb-4">{t('sections.activityInfo')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.createdAt')}</label>
                  <div className="text-[14px] text-zinc-100 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-700">{formatDate(user.createdAt)}</div>
                </div>
                <div>
                  <label className="text-[12px] text-zinc-500 block mb-1">{t('fields.updatedAt')}</label>
                  <div className="text-[14px] text-zinc-100 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-700">{formatDate(user.updatedAt)}</div>
                </div>
              </div>
            </div>

            {/* 경고 메시지 */}
            {currentUser.id === user.id && (
              <div className="bg-yellow-500/10 border border-yellow-900/40 rounded-lg p-3">
                <div className="text-yellow-400 font-medium text-[13px]">{t('messages.currentUserWarning')}</div>
                <div className="text-zinc-400 text-[12px] mt-1">{t('messages.currentUserDesc')}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}