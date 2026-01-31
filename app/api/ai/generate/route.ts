import { NextResponse } from 'next/server';

function getSizeFromAspect(aspectRatio: string | undefined, fallbackWidth: number, fallbackHeight: number) {
  if (!aspectRatio || aspectRatio === 'Default') return { width: fallbackWidth, height: fallbackHeight };
  if (aspectRatio === '16:9') return { width: 1280, height: 720 };
  if (aspectRatio === '1:1') return { width: 1024, height: 1024 };
  if (aspectRatio === '9:16') return { width: 720, height: 1280 };
  if (aspectRatio === '4:5') return { width: 1024, height: 1280 };
  return { width: fallbackWidth, height: fallbackHeight };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, style, aspectRatio, model: modelFromBody } = body ?? {};

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const baseUrl = process.env.POLLINATIONS_BASE_URL || 'https://image.pollinations.ai';
    const defaultModel = process.env.POLLINATIONS_MODEL || 'flux';
    const defaultWidth = Number(process.env.POLLINATIONS_DEFAULT_WIDTH || '1024');
    const defaultHeight = Number(process.env.POLLINATIONS_DEFAULT_HEIGHT || '1024');

    const { width, height } = getSizeFromAspect(aspectRatio, defaultWidth, defaultHeight);
    const model = typeof modelFromBody === 'string' && modelFromBody.length > 0 ? modelFromBody : defaultModel;

    const builtPrompt = style && style !== 'Default' ? `${prompt}, ${style}` : prompt;
    const url = `${baseUrl}/prompt/${encodeURIComponent(builtPrompt)}?width=${width}&height=${height}&model=${encodeURIComponent(model)}`;

    return NextResponse.json({ image: url, success: true });
  } catch {
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}