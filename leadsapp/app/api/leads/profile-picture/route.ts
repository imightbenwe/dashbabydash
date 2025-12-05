import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const { leadId, imageUrl } = await request.json();

    if (!leadId || !imageUrl) {
      return NextResponse.json(
        { error: 'Lead ID and image URL are required' },
        { status: 400 }
      );
    }

    console.log(`📸 Downloading profile picture from: ${imageUrl}`);

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download image' },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Resize to 200x200 and convert to JPEG
    console.log('🔄 Resizing image to 200x200px...');
    const resizedBuffer = await sharp(imageBuffer)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Upload to Supabase Storage
    const fileName = `${leadId}-${Date.now()}.jpg`;
    const filePath = `profile-pictures/${fileName}`;

    console.log(`📤 Uploading to Supabase Storage: ${filePath}`);
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('leads')
      .upload(filePath, resizedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image to storage' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('leads')
      .getPublicUrl(filePath);

    console.log(`✅ Profile picture uploaded: ${publicUrl}`);

    // Update lead record
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ profile_picture: publicUrl })
      .eq('id', leadId);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update lead record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profilePictureUrl: publicUrl,
    });

  } catch (error) {
    console.error('❌ Profile picture upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process image' },
      { status: 500 }
    );
  }
}
