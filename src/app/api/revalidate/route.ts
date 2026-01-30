import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const { tag, secret } = await request.json();

    // Validate the secret to prevent unauthorized revalidation
    const expectedSecret = process.env.REVALIDATION_TOKEN || 'super-secret-revalidation-token';
    
    if (secret !== expectedSecret) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (!tag) {
      return NextResponse.json({ message: 'Tag is required' }, { status: 400 });
    }

    // Trigger revalidation for the specific tag
        // Trigger revalidation for the specific tag
    // @ts-expect-error - Next.js type definition mismatch in this env
    revalidateTag(tag);

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    return NextResponse.json({ message: 'Error revalidating', error: err }, { status: 500 });
  }
}

// Allow GET for easier testing via browser or simple webhooks
export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');
  const secret = request.nextUrl.searchParams.get('secret');

  const expectedSecret = process.env.REVALIDATION_TOKEN || 'super-secret-revalidation-token';

  if (secret !== expectedSecret) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  if (!tag) {
    return NextResponse.json({ message: 'Tag is required' }, { status: 400 });
  }

      // Trigger revalidation for the specific tag
    // @ts-expect-error - Next.js type definition mismatch in this env
    revalidateTag(tag);

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
