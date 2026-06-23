import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, SESSION_COOKIE } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const profile = await resolveSession(token);
  if (!profile) {
    return NextResponse.json({ error: 'Session expired or invalid.' }, { status: 401 });
  }

  return NextResponse.json({ user: profile });
}
