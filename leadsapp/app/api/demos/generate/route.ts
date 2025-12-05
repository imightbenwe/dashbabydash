import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { html, clientName } = await request.json();

    if (!html || !clientName) {
      return NextResponse.json(
        { error: 'HTML content and client name are required' },
        { status: 400 }
      );
    }

    // Sanitize client name for folder/file naming
    const safeName = clientName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Create directory path (go up from leadsapp to root, then to demos)
    const projectRoot = join(process.cwd(), '..');
    const demoDir = join(projectRoot, 'demos', safeName);
    
    console.log(`📁 Creating demo directory: ${demoDir}`);
    console.log(`📍 Current working directory: ${process.cwd()}`);
    console.log(`📍 Project root: ${projectRoot}`);
    
    // Create the directory
    await mkdir(demoDir, { recursive: true });

    // Write HTML file
    const htmlFilePath = join(demoDir, 'index.html');
    await writeFile(htmlFilePath, html, 'utf-8');

    const publicUrl = `https://dashbabydash.com/demos/${safeName}/`;
    const localUrl = `/demos/${safeName}/`;

    console.log(`✅ Demo created successfully`);
    console.log(`📄 File written to: ${htmlFilePath}`);
    console.log(`🌐 Public URL: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      localPath: localUrl,
      localUrl: `http://localhost:3000${localUrl}`,
      filePath: htmlFilePath,
    });
  } catch (error) {
    console.error('❌ Demo generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate demo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
