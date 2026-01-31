import { fetch as undiciFetch, Agent } from 'undici';

const DEFENSE_SERVICE_URL = process.env.DEFENSE_SERVICE_URL || 'http://localhost:5000';
// LLM calls can take 60-120+ seconds; increase timeout beyond Node fetch default
const REQUEST_TIMEOUT_MS = 300_000; // 5 minutes

// Custom agent: short connect timeout (fail fast when service is down), long body timeout for LLM
const defenseAgent = new Agent({
    connect: { timeout: 10_000 }, // 10s – fail fast if defense service is not running
    headersTimeout: REQUEST_TIMEOUT_MS,
    bodyTimeout: REQUEST_TIMEOUT_MS,
});

export async function callDefenseService(endpoint: string, data: any) {
    const url = `${DEFENSE_SERVICE_URL}${endpoint}`;
    console.log('[defenseClient] Calling:', url, 'modelType:', data?.modelType);

    try {
        const res = await undiciFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            dispatcher: defenseAgent,
        });

        console.log('[defenseClient] Response status:', res.status, res.statusText);

        if (!res.ok) {
            let detail = res.statusText;
            try {
                const errBody = await res.json();
                if (errBody?.detail) detail = String(errBody.detail);
                console.log('[defenseClient] Error body:', errBody);
            } catch {
                // ignore
            }
            console.error('[defenseClient] Defense service error:', detail);
            // Map generic connection errors to a clear hint
            const detailLower = detail.toLowerCase();
            if (detailLower.includes('connection') || detailLower.includes('unreachable') || detailLower.includes('econnrefused')) {
                throw new Error(
                    `Primary or shadow LLM backend is not running. Start vLLM backends (see docs) or create a session with Model Backend: Simulated. (Defense service: ${detail})`
                );
            }
            throw new Error(`Defense service error: ${detail}`);
        }

        return await res.json();
    } catch (error) {
        console.error('[defenseClient] Call failed:', error);
        const msg = error instanceof Error ? error.message : String(error);
        const cause = error instanceof Error && 'cause' in error ? String((error as Error & { cause?: unknown }).cause) : '';
        const fullMsg = `${msg} ${cause}`.toLowerCase();
        const isUnreachable = /fetch failed|econnrefused|enotfound|network|timeout|headerstimeout|und_err_headers_timeout/i.test(fullMsg);
        if (isUnreachable) {
            const hint = /timeout|headerstimeout/i.test(fullMsg)
                ? `Request timed out after ~${REQUEST_TIMEOUT_MS / 1000}s. The defense service or LLM may be slow. Try "Simulated" mode for faster demo.`
                : `Defense service unreachable at ${DEFENSE_SERVICE_URL}. Is it running? (e.g. npm run dev:all)`;
            throw new Error(hint);
        }
        throw error;
    }
}
