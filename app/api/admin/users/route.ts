import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const adminUser = await requireAuth();
    if (adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    // Fetch all users and omit password hash for security
    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return NextResponse.json(users);
  } catch (error: any) {
    console.error('[admin/users/GET] error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
