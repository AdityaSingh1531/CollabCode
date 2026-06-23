import { NextRequest, NextResponse } from 'next/server';
import { destroySession, buildClearCookie, SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await destroySession(token);
  }
  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', buildClearCookie());
  return res;
}
