"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from 'next-intl';
import { apiFetch } from "@/utils/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations('auth');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      sessionStorage.setItem("token", res.token);
      if (res.user) sessionStorage.setItem("user", JSON.stringify(res.user));
      router.push("/car");
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError(t('loginFailure'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[360px] space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Image
            src="/logo-white.png"
            alt="COMAD"
            width={48}
            height={48}
            className="mx-auto mb-4 opacity-80"
          />
          <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">{t('systemTitle')}</h2>
          <p className="text-zinc-500 text-[13px] mt-1">{t('systemDescription')}</p>
        </div>

        {/* Form */}
        <div className="bg-[#111113] rounded-lg border border-zinc-800/60 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                {t('loginId')}
              </label>
              <input
                id="email"
                type="text"
                required
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[14px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                placeholder={t('loginIdPlaceholder')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[13px] font-medium text-zinc-400 mb-1.5">
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                required
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-[14px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#111167] transition-colors"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3">
                <div className="text-red-400/90 text-[13px]">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111167] hover:bg-[#1a1a80] disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium py-2.5 px-4 rounded-lg text-[14px] transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('loggingIn')}
                </div>
              ) : (
                t('login')
              )}
            </button>
          </form>
        </div>

        <div className="text-center">
          <p className="text-zinc-600 text-[12px]">{t('systemContactNotice')}</p>
        </div>
      </div>
    </div>
  );
}
