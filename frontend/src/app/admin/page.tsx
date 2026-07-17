"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getCurrentUser, getAuthHeaders } from "@/utils/jwt";

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

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();
  const t = useTranslations('admin.main');

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    // ADMIN 권한 체크
    if (!currentUser || currentUser.role !== 'ADMIN') {
      // 인증되지 않은 경우 로그인 페이지로, 권한 없는 경우 CAR 페이지로
      if (!currentUser) {
        router.push('/login');
      } else {
        router.push('/car');
      }
      return;
    }

    loadUsers();
  }, [router]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/users', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to load users: ${response.status}`);
      }

      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      console.error('사용자 목록 로드 오류:', err);
      setError(err.message || t('deleteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: number) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    if (!confirm(t('deleteConfirm', { name: targetUser.name }))) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('deleteFailed'));
      }

      alert(t('deleteSuccess'));
      loadUsers(); // 목록 새로고침
    } catch (err: any) {
      console.error('사용자 삭제 오류:', err);
      alert(`${t('deleteError')}: ${err.message}`);
    }
  };

  const syncErpUsers = async () => {
    if (!confirm(t('erp.syncConfirm'))) return;
    setSyncing(true);
    try {
      const response = await fetch('/api/auth/erp-sync', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error(t('erp.syncFailed'));
      const result = await response.json();
      alert(result.errors
        ? t('erp.syncCompleteWithErrors', { created: result.created, updated: result.updated, skipped: result.skipped, errors: result.errors.length })
        : t('erp.syncComplete', { created: result.created, updated: result.updated, skipped: result.skipped })
      );
      loadUsers();
    } catch (err: any) {
      alert(t('erp.syncError', { message: err.message }));
    } finally {
      setSyncing(false);
    }
  };

  const filteredUsers = roleFilter === 'ALL' ? users : users.filter(u => u.role === roleFilter);

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
    return styles[role] || 'bg-zinc-500/10 text-zinc-400';
  };

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
        <div className="text-center">
          <div className="text-red-400 text-xl">{t('accessDenied')}</div>
          <div className="text-zinc-400 mt-2">{t('adminRequired')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 lg:p-8">
      <div className="max-w-full mx-auto px-2 lg:px-4">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-lg font-semibold text-zinc-100">{t('title')}</h1>
          <p className="text-zinc-400 mt-2 text-[13px]">{t('description')}</p>
        </div>

        {/* 빠른 액세스 메뉴 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link
            href="/admin/user/new"
            className="bg-[#111113] border border-zinc-800/60 rounded-lg p-5 hover:border-zinc-700 transition-colors"
          >
            <h3 className="text-[13px] font-semibold text-zinc-100 mb-2">{t('addUser.title')}</h3>
            <p className="text-zinc-400 text-[13px]">{t('addUser.description')}</p>
          </Link>

          <Link
            href="/admin/report"
            className="bg-[#111113] border border-zinc-800/60 rounded-lg p-5 hover:border-zinc-700 transition-colors"
          >
            <h3 className="text-[13px] font-semibold text-zinc-100 mb-2">{t('reportManagement.title')}</h3>
            <p className="text-zinc-400 text-[13px]">{t('reportManagement.description')}</p>
          </Link>

          <Link
            href="/admin/ai"
            className="bg-[#111113] border border-zinc-800/60 rounded-lg p-5 hover:border-zinc-700 transition-colors"
          >
            <h3 className="text-[13px] font-semibold text-zinc-100 mb-2">{t('aiAnalysis.title')}</h3>
            <p className="text-zinc-400 text-[13px]">{t('aiAnalysis.description')}</p>
          </Link>
        </div>

        {/* 사용자 관리 섹션 */}
        <div className="bg-[#111113] border border-zinc-800/60 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-zinc-100">{t('userManagement')}</h2>
              <span className="text-[12px] text-zinc-500">({filteredUsers.length}/{users.length})</span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[13px] text-zinc-100 focus:outline-none focus:border-[#111167]"
              >
                <option value="ALL">{t('all')}</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MANAGER">MANAGER</option>
                <option value="STAFF">STAFF</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
              <button
                onClick={syncErpUsers}
                disabled={syncing}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-600 text-zinc-300 rounded-lg text-[13px] font-medium transition-colors"
              >
                {syncing ? t('erp.syncing') : t('erp.syncButton')}
              </button>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <div className="text-red-400 flex items-center text-[13px]">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {error}
              </div>
            </div>
          )}

          {/* 사용자 목록 */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.id')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.loginId')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.name')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.department')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.email')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.role')}</th>
                  <th className="px-4 py-3 text-center text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.weeklyReport')}</th>
                  <th className="px-4 py-3 text-left text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.createdAt')}</th>
                  <th className="px-4 py-3 text-center text-[12px] text-zinc-500 font-medium uppercase tracking-wider">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="text-zinc-400">
                        <div className="w-8 h-8 border-2 border-[#111167] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <div className="text-[13px]">{t('table.loading')}</div>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="text-zinc-400">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                        <div className="text-[13px] font-medium">{t('table.noUsers')}</div>
                        <div className="text-[13px] mt-1">{t('table.addNewUser')}</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((userItem) => (
                    <tr key={userItem.id} className="hover:bg-zinc-800/40 border-b border-zinc-800/40 text-[13px] last:border-b-0 transition-colors">
                      <td className="px-4 py-3 text-zinc-100 font-mono">#{userItem.id}</td>
                      <td className="px-4 py-3 text-zinc-100 font-medium">{userItem.loginId}</td>
                      <td className="px-4 py-3 text-zinc-100 font-medium">{userItem.name}</td>
                      <td className="px-4 py-3 text-zinc-300">{userItem.department || '-'}</td>
                      <td className="px-4 py-3 text-zinc-300">{userItem.email || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[12px] font-medium px-2 py-0.5 rounded ${getRoleBadge(userItem.role)}`}>
                          {userItem.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[12px] ${
                          userItem.weeklyReportEmail ? 'text-emerald-400' : 'text-zinc-500'
                        }`}>
                          {userItem.weeklyReportEmail ? t('table.receive') : t('table.notReceive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 text-[13px]">{formatDate(userItem.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Link
                            href={`/admin/user/${userItem.id}`}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[13px] font-medium px-3 py-1 transition-colors"
                          >
                            {t('table.detail')}
                          </Link>
                          <Link
                            href={`/admin/user/${userItem.id}/edit`}
                            className="bg-[#111167] hover:bg-[#1a1a80] text-white rounded-lg text-[13px] font-medium px-3 py-1 transition-colors"
                          >
                            {t('table.edit')}
                          </Link>
                          <button
                            onClick={() => deleteUser(userItem.id)}
                            className="bg-red-600 hover:bg-red-500 text-white rounded-lg text-[13px] font-medium px-3 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={userItem.id === user.id}
                          >
                            {t('table.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
