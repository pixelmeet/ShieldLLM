import { NextResponse } from 'next/server';

const DEFENSE_SERVICE_URL = process.env.DEFENSE_SERVICE_URL || 'http://localhost:8000';
const LLM_STATUS_TIMEOUT_MS = 5_000;

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_STATUS_TIMEOUT_MS);
  try {
    const res = await fetch(`${DEFENSE_SERVICE_URL}/llm-status`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return NextResponse.json(
        { usingRealLLM: false, reason: `Defense service returned ${res.status}` },
        { status: 200 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isAbort = (e instanceof Error && e.name === 'AbortError') || /abort/i.test(msg);
    const reason = isAbort
      ? 'Defense service did not respond in time (is it running on port 8000?)'
      : 'Defense service unreachable (run: npm run dev:defense or npm run dev:all)';
    return NextResponse.json(
      { usingRealLLM: false, reason },
      { status: 200 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
