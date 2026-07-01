import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, SESSION_COOKIE } from '@/lib/auth';
import { pool, initDb } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET all chats for the logged in user & active cell
export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionToken) {
      return NextResponse.json({ chats: [] });
    }

    const user = await resolveSession(sessionToken);
    if (!user) {
      return NextResponse.json({ chats: [] });
    }

    const { searchParams } = new URL(req.url);
    const cellId = searchParams.get('cellId') || '';

    await initDb();
    const chatsQuery = `
      SELECT id, title, cell_id, created_at 
      FROM user_chats 
      WHERE user_id = $1 AND cell_id = $2 
      ORDER BY created_at DESC;
    `;
    const res = await pool.query(chatsQuery, [user.id, cellId]);
    return NextResponse.json({ chats: res.rows });
  } catch (error) {
    console.error('[GET /api/analyze/chats] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve chats.' }, { status: 500 });
  }
}

// POST create a new chat or save a message
export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const user = await resolveSession(sessionToken);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { chatId, cellId, title, message } = await req.json();

    await initDb();
    let targetChatId = chatId;

    if (!targetChatId) {
      targetChatId = randomUUID();
      const insertChatQuery = `
        INSERT INTO user_chats (id, user_id, title, cell_id)
        VALUES ($1, $2, $3, $4);
      `;
      await pool.query(insertChatQuery, [targetChatId, user.id, title || 'New Chat', cellId || '']);
    }

    if (message) {
      const messageId = randomUUID();
      const insertMessageQuery = `
        INSERT INTO chat_messages (id, chat_id, role, content)
        VALUES ($1, $2, $3, $4);
      `;
      await pool.query(insertMessageQuery, [messageId, targetChatId, message.role, message.content]);
    }

    return NextResponse.json({ chatId: targetChatId });
  } catch (error) {
    console.error('[POST /api/analyze/chats] Error:', error);
    return NextResponse.json({ error: 'Failed to save chat info.' }, { status: 500 });
  }
}
