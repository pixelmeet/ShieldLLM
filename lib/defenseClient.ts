
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
            throw new Error(`Defense service error: ${res.statusText}`);
        }

        return await res.json();
    } catch (error) {
        console.error("Defense Service Call Failed:", error);
        // Fallback or rethrow
        throw error;
    }
}
