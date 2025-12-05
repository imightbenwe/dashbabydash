import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'PersonaAI API is running',
    routes: ['/api/analyze', '/api/leads', '/api/emails/generate']
  });
}
