import { NextResponse } from 'next/server';

// Map frontend language dropdown tokens → Cloud Run executor language keys
const LANGUAGE_MAP: Record<string, string> = {
  python:     'python',
  javascript: 'javascript',
  js:         'javascript',
  cpp:        'cpp',
  'c++':      'cpp',
};

export async function POST(req: Request) {
  try {
    const { code, language = 'python' } = await req.json();

    const cloudRunUrl = process.env.CLOUD_RUN_URL;
    if (!cloudRunUrl) {
      return NextResponse.json(
        { error: 'CLOUD_RUN_URL is not configured. Please run the deploy script and update your .env file.' },
        { status: 500 }
      );
    }

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'No code provided.' }, { status: 400 });
    }

    // Normalize the language token from the frontend dropdown
    const normalizedLanguage = LANGUAGE_MAP[language.toLowerCase()] ?? 'python';

    // Server-side timeout: 8s gives the Cloud Run container's 3s subprocess
    // kill plenty of room plus cold-start overhead, while still failing fast.
    const controller = new AbortController();
    const serverTimeout = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await fetch(`${cloudRunUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: normalizedLanguage }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(serverTimeout);
    }

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Cloud Run executor returned an error: ${errText}` },
        { status: response.status }
      );
    }

    // Pass the executor's JSON response directly to the frontend
    const result = await response.json();
    return NextResponse.json(result);

  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out — the execution took too long to respond.' },
        { status: 504 }
      );
    }
    console.error('[/api/execute] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error during execution.' },
      { status: 500 }
    );
  }
}
