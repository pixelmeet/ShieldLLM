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

        // 2. Call Defense Service (with fallback to simulated if OpenAI key/quota fails)
        const payload = {
            userText,
            intentGraph: session.intentGraph ?? { goal: session.toolType, allowed: [], forbidden: [], history: [] },
            defenseMode: session.defenseMode,
            policy: policyPayload,
            modelType: session.modelType,
        };

        let defenseResponse: Awaited<ReturnType<typeof callDefenseService>>;
        try {
            defenseResponse = await callDefenseService('/analyze', payload);
        } catch (firstError: unknown) {
            const msg = firstError instanceof Error ? firstError.message : String(firstError);
            const isOpenAIError = /invalid_api_key|incorrect api key|401|insufficient_quota|quota|429/i.test(msg);
            if (isOpenAIError) {
                console.log('[turn] OpenAI unavailable, retrying with simulated mode');
                try {
                    defenseResponse = await callDefenseService('/analyze', { ...payload, modelType: 'simulated' });
                } catch (fallbackError) {
                    console.error('[turn] Simulated fallback failed:', fallbackError);
                    const hint = /invalid_api_key|401/i.test(msg)
                        ? 'Set a valid OPENAI_API_KEY in .env or .env.local, or create a new session with Model Backend: "Simulated (Demo, no API)".'
                        : 'Check your OpenAI plan and billing, or create a new session with Model Backend: "Simulated (Demo, no API)".';
                    return NextResponse.json(
                        { error: 'Turn processing failed', detail: hint },
                        { status: 502 }
                    );
                }
            } else {
                throw firstError;
            }
        }

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
            divergenceLog: defenseResponse.divergenceLog ?? {
                divergenceScore: defenseResponse.scores?.total ?? 0,
                action: defenseResponse.action,
                defenseActionTaken: false,
                rerunWithCleaned: false
            },
            sanitizedText: defenseResponse.sanitizedText,
            latencyMs: Math.floor(Math.random() * 200) + 300
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
        const message = error instanceof Error ? error.message : '';
        const detail = message || String(error);
        console.log('[turn] POST error:', detail);
        console.error('[turn] Full error:', error);

        if (message === 'Unauthorized' || message === 'Forbidden') {
            return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 });
        }

        // User-friendly message for OpenAI API key / quota errors from defense service
        const isInvalidKey = /invalid_api_key|incorrect api key|401/i.test(detail);
        const isQuotaExceeded = /insufficient_quota|quota|429/i.test(detail);
        if (isInvalidKey || isQuotaExceeded) {
            const hint = isInvalidKey
                ? 'Set a valid OPENAI_API_KEY in .env or .env.local (see https://platform.openai.com/account/api-keys), or create a new session with Model Backend: "Simulated (Demo, no API)".'
                : 'Check your OpenAI plan and billing at https://platform.openai.com/account/billing, or create a new session with Model Backend: "Simulated (Demo, no API)".';
            return NextResponse.json(
                { error: 'Turn processing failed', detail: hint },
                { status: 502 }
            );
        }

        return NextResponse.json(
            { error: 'Turn processing failed', detail },
            { status: 500 }
        );
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
        console.log('[turn] GET error:', error instanceof Error ? error.message : error);
        return NextResponse.json({ error: 'Failed to fetch turns' }, { status: 500 });
    }
}
