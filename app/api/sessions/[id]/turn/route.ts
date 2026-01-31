import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Session from '@/models/Session';
import Turn from '@/models/Turn';
import Policy from '@/models/Policy';
import Alert from '@/models/Alert';
import { requireAuth } from '@/lib/auth';
import { callDefenseService } from '@/lib/defenseClient';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth();
        const { id: sessionId } = await params;
        const { userText } = await req.json();

        await dbConnect();

        // 1. Fetch Context
        const session = await Session.findById(sessionId);
        if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

        const policy = await Policy.findOne({}); // Singleton policy for MVP
        const policyPayload = policy
            ? { ...policy.toObject(), divergenceThresholds: policy.divergenceThresholds ?? { low: 10, medium: 30, high: 60, critical: 85 } }
            : {
                divergenceThresholds: { low: 10, medium: 30, high: 60, critical: 85 },
                defenseModeDefault: 'active',
            };

        // 2. Call Defense Service
        const defenseResponse = await callDefenseService('/analyze', {
            userText,
            intentGraph: session.intentGraph ?? { goal: session.toolType, allowed: [], forbidden: [], history: [] },
            defenseMode: session.defenseMode,
            policy: policyPayload,
        });

        // 3. Update Session State (Intent Graph & Trust Score)
        session.intentGraph = defenseResponse.updatedGraph;

        // Simple trust score decay logic
        if (defenseResponse.scores.total > 20) {
            session.trustScore = Math.max(0, session.trustScore - (defenseResponse.scores.total / 5));
        }
        await session.save();

        // 4. Create Turn Record
        const turn = await Turn.create({
            sessionId: session._id,
            userText,
            primaryOutput: defenseResponse.primaryOutput,
            shadowOutput: defenseResponse.shadowOutput,
            scores: defenseResponse.scores,
            riskLevel: defenseResponse.riskLevel,
            action: defenseResponse.action,
            sanitizedText: defenseResponse.sanitizedText,
            latencyMs: Math.floor(Math.random() * 200) + 300 // Fake latency for MVP
        });

        // 5. Create Alert if High Risk
        if (['high', 'critical'].includes(defenseResponse.riskLevel)) {
            await Alert.create({
                sessionId: session._id,
                turnId: turn._id,
                riskLevel: defenseResponse.riskLevel,
                title: `Risk detected: ${defenseResponse.action}`
            });
        }

        return NextResponse.json({
            turn,
            defense: defenseResponse
        });

    } catch (error: unknown) {
        console.error(error);
        const message = error instanceof Error ? error.message : '';
        if (message === 'Unauthorized' || message === 'Forbidden') {
            return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 });
        }
        return NextResponse.json({ error: 'Turn processing failed' }, { status: 500 });
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth();
        const { id: sessionId } = await params;
        await dbConnect();

        const turns = await Turn.find({ sessionId }).sort({ createdAt: 1 });
        return NextResponse.json(turns);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch turns' }, { status: 500 });
    }
}
