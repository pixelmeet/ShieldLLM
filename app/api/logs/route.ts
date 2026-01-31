import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Turn from '@/models/Turn';
import Alert from '@/models/Alert'; // Added import for Alert
import { requireAuth } from '@/lib/auth';

export async function GET() {
    try {
        await requireAuth();
        await dbConnect();

        const logs = await Turn.find({})
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('sessionId');

        return NextResponse.json(logs);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '';
        if (msg === 'Unauthorized' || msg === 'Forbidden') {
            return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 });
        }
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
