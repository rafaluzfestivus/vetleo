import { NextResponse } from 'next/server';

const COOKIE_NAME = 'leo_auth';

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    // Fail closed: no password configured yet means nobody gets in, not everybody.
    return new NextResponse('Painel não configurado (DASHBOARD_PASSWORD ausente nas variáveis de ambiente).', {
      status: 503,
    });
  }

  const expected = await sha256Hex(password);
  const cookie = request.cookies.get(COOKIE_NAME)?.value;

  if (cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
