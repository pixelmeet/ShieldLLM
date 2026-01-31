
const DEFENSE_SERVICE_URL = process.env.DEFENSE_SERVICE_URL || 'http://localhost:8000';

export async function callDefenseService(endpoint: string, data: any) {
    const url = `${DEFENSE_SERVICE_URL}${endpoint}`;
    console.log('[defenseClient] Calling:', url, 'modelType:', data?.modelType);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
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
            throw new Error(`Defense service error: ${detail}`);
        }

        return await res.json();
    } catch (error) {
        console.error('[defenseClient] Call failed:', error);
        const msg = error instanceof Error ? error.message : String(error);
        const isUnreachable = /fetch failed|ECONNREFUSED|ENOTFOUND|network|timeout/i.test(msg);
        if (isUnreachable) {
            throw new Error(
                `Defense service unreachable at ${DEFENSE_SERVICE_URL}. Is it running? (e.g. python defense_service/main.py)`
            );
        }
        throw error;
    }
}
