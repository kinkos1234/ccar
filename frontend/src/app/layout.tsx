import type { Metadata } from "next";
import { getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import "./globals.css";
import GlobalNav from "@/components/GlobalNav";

export async function generateMetadata(): Promise<Metadata> {
  try {
    await getLocale();
    
    // 기본값 설정
    let title = 'COMAD CAR System';
    let description = 'Customer Account Review System for COMAD';
    
    try {
      const t = await getTranslations('meta');
      title = t('title');
      description = t('description');
    } catch {
      // 번역을 불러올 수 없는 경우 기본값 사용
      console.warn('Failed to load translations for metadata, using defaults');
    }
    
    return {
      title,
      description,
      icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon.svg',
        apple: '/favicon.svg',
      },
    };
  } catch {
    // 전체적으로 실패한 경우 기본값 반환
    return {
      title: 'COMAD CAR System',
      description: 'Customer Account Review System for COMAD',
      icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon.svg',
        apple: '/favicon.svg',
      },
    };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body className="bg-zinc-950 text-zinc-100 antialiased" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <GlobalNav />
          <main>{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
