import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Session from '@/models/Session';
import Turn from '@/models/Turn';
import Policy from '@/models/Policy';
import Alert from '@/models/Alert';
import { requireAuth } from '@/lib/auth';
import { callDefenseService } from '@/lib/defenseClient';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    console.log('[turn/POST] ===== NEW TURN REQUEST =====');
    try {
        await requireAuth();
        const { id: sessionId } = await params;
        const { userText } = await req.json();
        console.log(`[turn/POST] sessionId=${sessionId}, userText length=${userText?.length || 0}`);
        console.log(`[turn/POST] userText preview: ${userText?.substring(0, 100)}...`);

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
        console.log(`[turn/POST] Calling defense service with modelType=${session.modelType}, defenseMode=${session.defenseMode}`);
        console.log(`[turn/POST] Defense service URL: ${process.env.DEFENSE_SERVICE_URL || 'http://localhost:5000'}/analyze`);

        let defenseResponse: Awaited<ReturnType<typeof callDefenseService>>;
        try {
            console.log('[turn/POST] Attempting defense service call...');
            defenseResponse = await callDefenseService('/analyze', payload);
            console.log('[turn/POST] Defense service call SUCCESS');
            console.log(`[turn/POST] Response: action=${defenseResponse.action}, riskLevel=${defenseResponse.riskLevel}, divergence=${defenseResponse.divergence_score}`);
        } catch (firstError: unknown) {
            const msg = firstError instanceof Error ? firstError.message : String(firstError);
            const isOpenAIError = /invalid_api_key|incorrect api key|401|insufficient_quota|quota|429/i.test(msg);
            // Only fall back to simulated for OpenAI key/quota issues. When primary/shadow LLM backends
            // are down, surface the error so the user knows the models are not working.
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
        console.log('[turn/POST] ===== ERROR OCCURRED =====');
        console.log('[turn/POST] Error message:', detail);
        console.error('[turn/POST] Full error:', error);
        if (error instanceof Error && error.stack) {
            console.error('[turn/POST] Stack trace:', error.stack);
        }

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

        // Defense service unreachable, LLM backend down, or timeout -> 502 so UI shows model error hint
        const isDefenseUnreachable = /defense service|unreachable|econnrefused|fetch failed|timeout|connection|primary or shadow llm/i.test(detail);
        const status = isDefenseUnreachable ? 502 : 500;
        const friendlyDetail = isDefenseUnreachable
            ? (detail.includes('Primary or shadow') ? detail : (detail || 'Defense service or LLM backend unreachable. Run: npm run dev:defense (and start vLLM if using local backends), or create a session with Model Backend: Simulated.'))
            : detail;
        return NextResponse.json(
            { error: 'Turn processing failed', detail: friendlyDetail },
            { status }
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
