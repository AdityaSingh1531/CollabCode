import { NextResponse } from 'next/server';

// Map frontend language dropdown tokens → JDoodle language keys & version indices
const LANGUAGE_MAP: Record<string, { language: string; versionIndex: string }> = {
  python:     { language: 'python3', versionIndex: '4' },
  python3:    { language: 'python3', versionIndex: '4' },
  javascript: { language: 'nodejs',  versionIndex: '4' },
  nodejs:     { language: 'nodejs',  versionIndex: '4' },
  js:         { language: 'nodejs',  versionIndex: '4' },
  cpp:        { language: 'cpp17',   versionIndex: '1' },
  cpp17:      { language: 'cpp17',   versionIndex: '1' },
  'c++':      { language: 'cpp17',   versionIndex: '1' },
  java:       { language: 'java',    versionIndex: '4' },
  sql:        { language: 'sql',     versionIndex: '4' },
  mysql:      { language: 'sql',     versionIndex: '4' },
};

const JDOODLE_API_URL = 'https://api.jdoodle.com/v1/execute';

export async function POST(req: Request) {
  try {
    const { code, language = 'python3', stdin = '' } = await req.json();

    const clientId     = process.env.JDOODLE_CLIENT_ID;
    const clientSecret = process.env.JDOODLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'JDoodle API credentials are not configured. Add JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET to your .env file.' },
        { status: 500 }
      );
    }

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'No code provided.' }, { status: 400 });
    }

    const langConfig = LANGUAGE_MAP[language.toLowerCase()] ?? LANGUAGE_MAP['python3'];

    const controller  = new AbortController();
    const serverTimeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    const fetchStart = performance.now();
    try {
      response = await fetch(JDOODLE_API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret,
          script:       code,
          stdin:        stdin || '',
          language:     langConfig.language,
          versionIndex: langConfig.versionIndex,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(serverTimeout);
    }
    const fetchEnd = performance.now();
    const fetchDurationSec = parseFloat(((fetchEnd - fetchStart) / 1000).toFixed(2));

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `JDoodle API returned an error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    // JDoodle response shape: { output, statusCode, memory, cpuTime }
    const stdout    = result.output ?? '';
    const exitCode  = result.statusCode ?? 200;
    const cpuTime   = result.cpuTime !== null && result.cpuTime !== undefined ? parseFloat(result.cpuTime) : fetchDurationSec;
    const memory    = result.memory    ?? null;

    // Heuristic: JDoodle mixes stdout + stderr into "output"
    const lowerOut  = stdout.toLowerCase();
    const hasError  = lowerOut.includes('error') || lowerOut.includes('exception') || lowerOut.includes('traceback');
    const status    = hasError ? 'Error' : 'Accepted';

    return NextResponse.json({
      stdout,
      stderr:   '',
      exit_code: exitCode,
      status,
      time:   cpuTime,
      memory,
    });

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
