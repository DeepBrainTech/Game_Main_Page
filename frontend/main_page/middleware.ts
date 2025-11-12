import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n-config';

export default createMiddleware({
  // 支持的语言列表
  locales,
  
  // 默认语言
  defaultLocale,
  
  // 总是显示语言前缀（如 /zh, /en）
  localePrefix: 'always'
});

export const config = {
  // 匹配所有路径，除了以下：
  // - api (API routes)
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  // - images (public images folder)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)']
};
