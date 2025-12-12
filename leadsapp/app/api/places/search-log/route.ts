import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const logPath = path.join(process.cwd(), 'GOOGLE_PLACES_SEARCH_LOG.md');
    const content = await fs.readFile(logPath, 'utf8');
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Log file not found' },
      { status: 404 }
    );
  }
}
