import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Session from '@/models/Session';
import Policy from '@/models/Policy';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const user = await requireAuth();
        await dbConnect();

        const body = await req.json();

        const VALID_MODEL_TYPES = ['openai', 'huggingface', 'huggingface_phi3', 'simulated', 'gpt_class', 'open_source'] as const;
        const modelType = VALID_MODEL_TYPES.includes(body.modelType) ? body.modelType : 'openai';

        // Get default policy to initialize intent graph constraints if needed
        // or just use hardcoded defaults for MVP
        const policy = await Policy.findOne({});

        const newSession = await Session.create({
            userId: user.userId,
            toolType: body.toolType,
            modelType,
            defenseMode: body.defenseMode || policy?.defenseModeDefault || 'active',
            intentGraph: {
                goal: body.toolType, // e.g., code_review
                allowed: ["read_code", "explain_vuln", "suggest_fix"], // Simplified default
                forbidden: ["override_policy", "reveal_system", "approve_without_review"],
                history: []
            }
        });

        return NextResponse.json(newSession);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '';
        console.log('[sessions] POST error:', msg);
        console.error('[sessions] Full error:', error);
        if (msg === 'Unauthorized' || msg === 'Forbidden') {
            return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 });
        }
        return NextResponse.json({ error: 'Failed to create session', detail: msg }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const user = await requireAuth();
        await dbConnect();

        const sessions = await Session.find({ userId: user.userId }).sort({ createdAt: -1 }).limit(20);
        return NextResponse.json(sessions);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '';
        console.log('[sessions] GET error:', msg);
        console.error('[sessions] Full error:', error);
        if (msg === 'Unauthorized' || msg === 'Forbidden') {
            return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 });
        }
        return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }
}
