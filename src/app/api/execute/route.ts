import { NextResponse } from 'next/server';

/**
 * Proxy to the dedicated code execution service (collabcode-executor).
 * The executor holds the JDoodle credentials — the frontend never needs them.
 */

// Map frontend language tokens → executor's expected keys
const LANGUAGE_ALIASES: Record<string, string> = {
  python:     'python3',
  python3:    'python3',
  javascript: 'nodejs',
  nodejs:     'nodejs',
  js:         'nodejs',
  cpp:        'cpp17',
  cpp17:      'cpp17',
  'c++':      'cpp17',
  java:       'java',
};

export async function POST(req: Request) {
  try {
    const { code, language = 'python3', stdin = '' } = await req.json();

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'No code provided.' }, { status: 400 });
    }

    const executorUrl = process.env.CLOUD_RUN_URL;
    if (!executorUrl) {
      return NextResponse.json(
        { error: 'Execution service URL is not configured (CLOUD_RUN_URL).' },
        { status: 500 }
      );
    }

    const normalizedLanguage = LANGUAGE_ALIASES[language.toLowerCase()] ?? 'python3';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let response: Response;
    try {
      response = await fetch(`${executorUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: normalizedLanguage, stdin }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Executor error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    // Executor already returns { stdout, stderr, exit_code, status, time, memory }
    const result = await response.json();
    return NextResponse.json(result);

  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Execution timed out — the code took too long to run.' },
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
