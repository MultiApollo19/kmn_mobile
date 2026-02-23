import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';

type RevalidateBody = {
  tag: string;
  secret: string;
};

export async function POST(request: NextRequest) {
  try {
    const { tag, secret } = await request.json() as RevalidateBody;

    // Validate the secret to prevent unauthorized revalidation
    const expectedSecret = process.env.REVALIDATION_TOKEN || process.env.NEXT_PUBLIC_REVALIDATION_TOKEN;
    
    if (secret !== expectedSecret) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (!tag) {
      return NextResponse.json({ message: 'Tag is required' }, { status: 400 });
    }

    // Trigger revalidation for the specific tag
    revalidateTag(tag, 'max');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    return NextResponse.json({ message: 'Error revalidating', error: err }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  void request;
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  );
}
