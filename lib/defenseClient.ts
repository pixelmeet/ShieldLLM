
const DEFENSE_SERVICE_URL = process.env.DEFENSE_SERVICE_URL || 'http://localhost:8000';

export async function callDefenseService(endpoint: string, data: any) {
    try {
        const res = await fetch(`${DEFENSE_SERVICE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            let detail = res.statusText;
            try {
                const errBody = await res.json();
                if (errBody?.detail) detail = String(errBody.detail);
            } catch {
                // ignore
            }
            throw new Error(`Defense service error: ${detail}`);
        }

        return await res.json();
    } catch (error) {
        console.error("Defense Service Call Failed:", error);
        // Fallback or rethrow
        throw error;
    }
}
