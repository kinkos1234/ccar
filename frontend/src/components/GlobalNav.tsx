"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from 'next-intl';
import { getCurrentUser, isAuthenticated, clearAuthData } from "@/utils/jwt";
import { apiFetch } from "@/utils/api";
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';

type User = {
  id: number;
  name: string;
  role: string;
  department?: string;
};

type NavMenu = {
  translationKey: string;
  href: string;
  roles: string[];
};

export default function GlobalNav() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const ta = useTranslations('auth');

  const NAV_MENUS: NavMenu[] = [
    { translationKey: "cars", href: "/car", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { translationKey: "dashboard", href: "/dashboard", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { translationKey: "riskDashboard", href: "/dashboard/risk", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { translationKey: "admin", href: "/admin", roles: ["ADMIN"] },
  ];

  const checkUserAuth = () => {
    try {
      if (isAuthenticated()) {
        const currentUser = getCurrentUser();
        setUser(currentUser);
      } else {
        setUser(null);
        clearAuthData();
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      clearAuthData();
    }
  };

  useEffect(() => {
    setMounted(true);
    checkUserAuth();
  }, []);

  useEffect(() => {
    if (mounted) checkUserAuth();
  }, [pathname, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(checkUserAuth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mounted]);

  if (pathname === '/login') return null;

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      clearAuthData();
      setUser(null);
      router.push("/login");
    }
  };

  const handleMenuClick = (menu: NavMenu, e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      alert(ta('loginRequired'));
      router.push('/login');
      return;
    }
    if (!menu.roles.includes(user.role)) {
      e.preventDefault();
      alert(ta('accessDenied') || 'Access denied');
      return;
    }
  };

  return (
    <nav className="w-full bg-[#111113] border-b border-zinc-800/60 text-zinc-100 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link href="/car" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Image src="/logo-white.png" alt="COMAD" width={28} height={28} className="opacity-90" />
          <span className="font-semibold text-[15px] tracking-tight text-zinc-100">
            COMAD <span className="font-normal text-zinc-500">CAR</span>
          </span>
        </Link>

        {/* Navigation */}
        {user && (
          <div className="flex items-center gap-1">
            {NAV_MENUS.filter(menu => menu.roles.includes(user.role)).map(menu => (
              <Link
                key={menu.href}
                href={menu.href}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                  pathname === menu.href || (menu.href !== '/car' && pathname?.startsWith(menu.href))
                    ? 'bg-[#111167] text-white'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                }`}
                onClick={(e) => handleMenuClick(menu, e)}
              >
                {t(menu.translationKey)}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user && <NotificationBell />}
        <LanguageSwitcher />

        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[13px] font-medium text-zinc-200">{user.name}</div>
              <div className="text-[11px] text-zinc-500">{user.department || user.role}</div>
            </div>
            {user.role === "ADMIN" && (
              <span className="px-2 py-0.5 bg-[#111167]/20 text-[#8888cc] border border-[#111167]/30 rounded text-[11px] font-medium">
                ADMIN
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-[13px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-md transition-colors"
            >
              {ta('logout')}
            </button>
          </div>
        ) : (
          mounted && (
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-1.5 bg-[#111167] hover:bg-[#1a1a80] text-white rounded-md text-[13px] font-medium transition-colors"
            >
              {ta('login')}
            </button>
          )
        )}
      </div>
    </nav>
  );
}
