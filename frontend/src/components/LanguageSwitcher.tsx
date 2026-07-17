'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { locales, languageNames, type Locale } from '../i18n';

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const t = useTranslations('language');
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = async (newLocale: Locale) => {
    if (newLocale === locale) {
      setIsOpen(false);
      return;
    }

    try {
      const token = sessionStorage.getItem('token');
      if (token) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/profile/language`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ preferredLanguage: newLocale })
        }).catch(error => {
          console.error('Language save failed:', error);
        });
      }

      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

      startTransition(() => {
        window.location.reload();
      });

      setIsOpen(false);
    } catch (error) {
      console.error('Language change error:', error);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px]
          text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60
          transition-colors
          ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={t('change') || 'Change Language'}
      >
        <span className="font-medium">{languageNames[locale]}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-[#111113] border border-zinc-800 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
          {locales.map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              disabled={isPending}
              className={`
                w-full text-left px-3 py-2 text-[13px] transition-colors
                ${locale === lang
                  ? 'text-white bg-[#111167]/20'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                }
                ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center justify-between">
                <span>{languageNames[lang]}</span>
                {locale === lang && (
                  <svg className="w-3.5 h-3.5 text-[#8888cc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-md">
          <div className="w-3.5 h-3.5 border-2 border-[#111167] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
