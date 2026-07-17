import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './src/i18n';

export default createMiddleware({
  // 지원하는 언어 목록
  locales,
  
  // 기본 언어
  defaultLocale,
  
  // URL에 언어 prefix 추가하지 않음
  localePrefix: 'never',
  
  // 언어 감지 방식: 쿠키 우선
  localeDetection: true,
  
  // 대체 링크 비활성화
  alternateLinks: false
});

export const config = {
  // 미들웨어가 적용될 경로 패턴
  matcher: [
    // 모든 경로에 적용하되 다음은 제외:
    // - api 경로
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - 이미지 파일들
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}; 