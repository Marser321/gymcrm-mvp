import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_OPEN_ROLE, OPEN_ROLE_COOKIE, getGymcrmDataMode } from '@/lib/gymcrm/open-session';

const shouldDefaultOpenRole = (request: NextRequest): boolean => {
  if (request.nextUrl.pathname.startsWith('/_next')) return false;
  if (request.nextUrl.pathname.startsWith('/api/auth')) return false;
  return !request.cookies.get(OPEN_ROLE_COOKIE)?.value;
};

const applyOpenRoleCookie = (request: NextRequest, response: NextResponse): NextResponse => {
  if (!shouldDefaultOpenRole(request)) return response;

  response.cookies.set({
    name: OPEN_ROLE_COOKIE,
    value: DEFAULT_OPEN_ROLE,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
};

export default function middleware(request: NextRequest) {
  const mode = getGymcrmDataMode();
  const pathname = request.nextUrl.pathname;

  if (mode === 'demo' && pathname.startsWith('/api/gymcrm/') && !pathname.startsWith('/api/gymcrm_open/')) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = pathname.replace('/api/gymcrm/', '/api/gymcrm_open/');
    return applyOpenRoleCookie(request, NextResponse.rewrite(nextUrl));
  }

  if (mode === 'demo' && pathname === '/api/gymcrm') {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = '/api/gymcrm_open';
    return applyOpenRoleCookie(request, NextResponse.rewrite(nextUrl));
  }

  return applyOpenRoleCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

