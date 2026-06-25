import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@backend/lib/db';
import Alert from '@backend/models/Alert';
import { requireAuth } from '@backend/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (user.role !== 'moderator' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: alertId } = await params;
    const { status } = await req.json();

    if (!status || !['pending', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await dbConnect();

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    alert.status = status;
    await alert.save();

    return NextResponse.json(alert);
  } catch (error: any) {
    console.error('[alerts/PATCH] error:', error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}
