import { NextResponse } from 'next/server';

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return '/';
  }
  return next;
}

export async function POST(request) {
  const formData = await request.formData();
  const password = formData.get('password');
  const next = safeNext(formData.get('next'));
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedPassword || password !== expectedPassword) {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', '1');
    url.searchParams.set('next', next);
    return NextResponse.redirect(url, { status: 303 });
  }

  const token = await sha256Hex(expectedPassword);
  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.cookies.set('leo_auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return response;
}
