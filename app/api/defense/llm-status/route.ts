import { NextResponse } from 'next/server';

const DEFENSE_SERVICE_URL = process.env.DEFENSE_SERVICE_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${DEFENSE_SERVICE_URL}/llm-status`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return NextResponse.json(
        { usingRealLLM: false, reason: `Defense service returned ${res.status}` },
        { status: 200 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { usingRealLLM: false, reason: 'Defense service unreachable' },
      { status: 200 }
    );
  }
}
