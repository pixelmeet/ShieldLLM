import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Session from '@/models/Session';
import Turn from '@/models/Turn';
import Alert from '@/models/Alert';
import { requireAuth } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAuth();
    if (adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    const { role } = await req.json();

    if (!role || !['admin', 'moderator', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Prevent downgrading self
    if (adminUser.userId === targetUserId) {
      return NextResponse.json({ error: 'Cannot modify your own administrative role' }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findById(targetUserId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.role = role;
    await user.save();

    return NextResponse.json({ message: 'User role updated successfully' });
  } catch (error: any) {
    console.error('[admin/users/PATCH] error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = await requireAuth();
    if (adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: targetUserId } = await params;

    // Prevent deleting self
    if (adminUser.userId === targetUserId) {
      return NextResponse.json({ error: 'Cannot delete your own administrative account' }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findById(targetUserId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cascade delete user data
    const sessions = await Session.find({ userId: targetUserId });
    const sessionIds = sessions.map(s => s._id);

    await Turn.deleteMany({ sessionId: { $in: sessionIds } });
    await Alert.deleteMany({ sessionId: { $in: sessionIds } });
    await Session.deleteMany({ userId: targetUserId });
    await User.findByIdAndDelete(targetUserId);

    return NextResponse.json({ message: 'User and all associated logs deleted successfully' });
  } catch (error: any) {
    console.error('[admin/users/DELETE] error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
