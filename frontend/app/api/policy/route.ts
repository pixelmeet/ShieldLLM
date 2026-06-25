import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@backend/lib/db';
import Policy from '@backend/models/Policy';
import { requireAuth } from '@backend/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    let policy = await Policy.findOne({});
    if (!policy) {
      // Create default policy
      policy = await Policy.create({
        divergenceThresholds: {
          low: 10,
          medium: 30,
          high: 60,
          critical: 85
        },
        trustDecay: 5,
        shadowEnabled: true,
        defenseModeDefault: 'active'
      });
    }

    return NextResponse.json(policy);
  } catch (error: any) {
    console.error('[policy/GET] error:', error);
    return NextResponse.json({ error: 'Failed to fetch policy' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    await dbConnect();

    let policy = await Policy.findOne({});
    if (!policy) {
      policy = new Policy({});
    }

    // Update fields
    if (body.divergenceThresholds) {
      policy.divergenceThresholds = {
        low: Number(body.divergenceThresholds.low) ?? policy.divergenceThresholds.low,
        medium: Number(body.divergenceThresholds.medium) ?? policy.divergenceThresholds.medium,
        high: Number(body.divergenceThresholds.high) ?? policy.divergenceThresholds.high,
        critical: Number(body.divergenceThresholds.critical) ?? policy.divergenceThresholds.critical,
      };
    }

    if (body.trustDecay !== undefined) {
      policy.trustDecay = Number(body.trustDecay);
    }

    if (body.shadowEnabled !== undefined) {
      policy.shadowEnabled = Boolean(body.shadowEnabled);
    }

    if (body.defenseModeDefault && ['passive', 'active', 'strict'].includes(body.defenseModeDefault)) {
      policy.defenseModeDefault = body.defenseModeDefault;
    }

    await policy.save();

    return NextResponse.json(policy);
  } catch (error: any) {
    console.error('[policy/PUT] error:', error);
    return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 });
  }
}

