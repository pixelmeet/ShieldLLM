import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@backend/lib/db';
import Alert from '@backend/models/Alert';
import Session from '@backend/models/Session'; // Ensure model is registered
import Turn from '@backend/models/Turn';       // Ensure model is registered
import { requireAuth } from '@backend/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== 'moderator' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    // Force register models in Mongoose schema list
    const registeredSession = Session;
    const registeredTurn = Turn;

    const alerts = await Alert.find({})
      .populate('sessionId')
      .populate('turnId')
      .sort({ createdAt: -1 });

    return NextResponse.json(alerts);
  } catch (error: any) {
    console.error('[alerts/GET] error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

