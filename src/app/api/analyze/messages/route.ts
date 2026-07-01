import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, SESSION_COOKIE } from '@/lib/auth';
import { pool, initDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const user = await resolveSession(sessionToken);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId') || '';

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required.' }, { status: 400 });
    }

    await initDb();
    const messagesQuery = `
      SELECT role, content, created_at 
      FROM chat_messages 
      WHERE chat_id = $1 
      ORDER BY created_at ASC;
    `;
    const res = await pool.query(messagesQuery, [chatId]);
    return NextResponse.json({ messages: res.rows });
  } catch (error) {
    console.error('[GET /api/analyze/messages] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve messages.' }, { status: 500 });
  }
}
