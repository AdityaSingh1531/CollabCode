import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(req: Request): Promise<Response> {
  try {
    const { command } = await req.json();

    if (!command || !command.trim()) {
      return NextResponse.json({ stdout: '', stderr: '' });
    }

    // Run the command in the project root directory
    const projectRoot = process.cwd();

    return new Promise<Response>((resolve) => {
      // Execute command with a timeout of 10 seconds
      exec(command, { cwd: projectRoot, timeout: 10000 }, (error, stdout, stderr) => {
        resolve(
          NextResponse.json({
            stdout: stdout || '',
            stderr: stderr || (error ? error.message : ''),
            exitCode: error ? error.code : 0,
          })
        );
      });
    });

  } catch (err: any) {
    console.error('[/api/terminal] Error:', err);
    return NextResponse.json(
      { error: 'Failed to run command' },
      { status: 500 }
    );
  }
}
