import { NextRequest, NextResponse } from 'next/server';
import {
  verifyUser,
  createUser,
  createSession,
  buildSessionCookie,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password, displayName, isRegister } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    // Sanitise
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3–20 characters: letters, numbers, underscores only.' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    let profile;

    if (isRegister) {
      // ── Registration flow ──
      const name = (displayName || cleanUsername).trim().slice(0, 40);
      profile = await createUser(cleanUsername, password, name);
      if (!profile) {
        return NextResponse.json({ error: 'Username is already taken.' }, { status: 409 });
      }
    } else {
      // ── Login flow ──
      profile = await verifyUser(cleanUsername, password);
      if (!profile) {
        return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
      }
    }

    // Create session token and set HttpOnly cookie
    const token = await createSession(profile.id);
    const res = NextResponse.json({ user: profile });
    res.headers.set('Set-Cookie', buildSessionCookie(token));
    return res;
  } catch (err) {
    console.error('[/api/auth/login] Error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
