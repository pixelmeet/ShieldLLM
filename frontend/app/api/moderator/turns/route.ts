import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@backend/lib/db';
import Turn from '@backend/models/Turn';
import Session from '@backend/models/Session';
import User from '@backend/models/User'; // Ensure User model is loaded/registered
import { requireAuth } from '@backend/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== 'moderator' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    // Register models
    const registeredSession = Session;
    const registeredUser = User;

    // Fetch turns with nested population
    const turns = await Turn.find({})
      .populate({
        path: 'sessionId',
        populate: {
          path: 'userId',
          select: 'fullName email'
        }
      })
      .sort({ createdAt: -1 })
      .limit(100);

    return NextResponse.json(turns);
  } catch (error: any) {
    console.error('[moderator/turns/GET] error:', error);
    return NextResponse.json({ error: 'Failed to fetch turn logs' }, { status: 500 });
  }
}

