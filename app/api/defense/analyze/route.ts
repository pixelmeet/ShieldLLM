import { NextResponse } from 'next/server';
import { callDefenseService } from '@/lib/defenseClient';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = await callDefenseService('/analyze', body);
        return NextResponse.json(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[defense/analyze] Error:', msg);
        return NextResponse.json(
            { error: 'Defense analysis failed', detail: msg },
            { status: 502 }
        );
    }
}
