import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Session from '@/models/Session';
import Turn from '@/models/Turn';
import Alert from '@/models/Alert';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: sessionId } = await params;
    await dbConnect();

    const session = await Session.findOne({ _id: sessionId, userId: user.userId });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('[session/GET] error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: sessionId } = await params;
    await dbConnect();

    // Verify ownership
    const session = await Session.findOne({ _id: sessionId, userId: user.userId });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Cascade delete turns and alerts
    await Turn.deleteMany({ sessionId });
    await Alert.deleteMany({ sessionId });
    await Session.findByIdAndDelete(sessionId);

    return NextResponse.json({ message: 'Session and related logs deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('[session/DELETE] error:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
