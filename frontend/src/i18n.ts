// 지원하는 언어 목록
export const locales = ['ko', 'en', 'zh', 'vi', 'hi', 'es-mx'] as const;
export type Locale = typeof locales[number];

// 기본 언어
export const defaultLocale: Locale = 'ko';

// 언어별 표시명
export const languageNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  vi: 'Tiếng Việt',
  hi: 'हिन्dी',
  'es-mx': 'Español (México)'
};

// 언어 유효성 검사
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

// 브라우저에서 쿠키로부터 언어 읽기
export function getLocaleFromCookie(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  
  const cookies = document.cookie.split(';');
  const localeCookie = cookies.find(cookie => cookie.trim().startsWith('NEXT_LOCALE='));
  
  if (localeCookie) {
    const locale = localeCookie.split('=')[1];
    return isValidLocale(locale) ? locale : defaultLocale;
  }
  
  return defaultLocale;
}

// next-intl 설정
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // 서버에서 쿠키를 직접 읽어서 locale 결정
  let finalLocale: Locale = defaultLocale;
  
  // 서버 환경에서만 실행
  if (typeof window === 'undefined') {
    try {
      // Node.js 환경에서 쿠키 읽기
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const localeCookie = cookieStore.get('NEXT_LOCALE');
      
      if (localeCookie?.value && isValidLocale(localeCookie.value)) {
        finalLocale = localeCookie.value as Locale;
      }
    } catch (error) {
      console.log('쿠키 읽기 실패:', error);
    }
  }

  try {
    return {
      messages: (await import(`./locales/${finalLocale}/common.json`)).default,
      timeZone: getTimezoneByLocale(finalLocale),
      now: new Date(),
      locale: finalLocale
    };
  } catch (error) {
    // 번역 파일을 불러올 수 없는 경우 기본 언어로 폴백
    console.error(`Failed to load locale ${finalLocale}, falling back to ${defaultLocale}:`, error);
    return {
      messages: (await import(`./locales/${defaultLocale}/common.json`)).default,
      timeZone: getTimezoneByLocale(defaultLocale),
      now: new Date(),
      locale: defaultLocale
    };
  }
});

// 언어별 기본 시간대 설정
function getTimezoneByLocale(locale: Locale): string {
  const timezones: Record<Locale, string> = {
    ko: 'Asia/Seoul',
    en: 'America/New_York',  // 기본값으로 미국 동부시간
    zh: 'Asia/Shanghai',
    vi: 'Asia/Ho_Chi_Minh',
    hi: 'Asia/Kolkata',
    'es-mx': 'America/Mexico_City'
  };
  
  return timezones[locale] || 'Asia/Seoul';
}

// 언어별 방향 설정 (향후 아랍어 등 RTL 언어 지원시 사용)
export function getTextDirection(): 'ltr' | 'rtl' {
  // 현재는 모든 언어가 LTR
  return 'ltr';
}

// 언어별 숫자 포맷 설정
export function getNumberFormat(locale: Locale): Intl.NumberFormatOptions {
  const formats: Record<Locale, Intl.NumberFormatOptions> = {
    ko: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
    en: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
    zh: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
    vi: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
    hi: { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 },
    'es-mx': { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }
  };
  
  return formats[locale] || formats.ko;
} 