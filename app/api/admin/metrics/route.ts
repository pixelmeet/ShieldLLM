import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import dbConnect from '@/lib/db';
import Turn from '@/models/Turn';
import Session from '@/models/Session';
import Alert from '@/models/Alert';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    // 1. General counts
    const totalTurns = await Turn.countDocuments({});
    const totalAlerts = await Alert.countDocuments({});
    
    // 2. Action distribution
    const actionCounts = await Turn.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]);
    const actionDist = {
      allow: 0,
      clarify: 0,
      sanitize_rerun: 0,
      contain: 0
    };
    actionCounts.forEach(item => {
      if (item._id in actionDist) {
        (actionDist as any)[item._id] = item.count;
      }
    });

    // 3. Risk level distribution
    const riskCounts = await Turn.aggregate([
      { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
    ]);
    const riskDist = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    riskCounts.forEach(item => {
      if (item._id in riskDist) {
        (riskDist as any)[item._id] = item.count;
      }
    });

    // 4. Average Latency
    const latencyAvg = await Turn.aggregate([
      { $group: { _id: null, avgLatency: { $avg: '$latencyMs' } } }
    ]);
    const averageLatencyMs = latencyAvg[0]?.avgLatency || 0;

    // 5. Calculate Security Index (percentage of allowed turns)
    const allowedCount = actionDist.allow;
    const securityIndex = totalTurns > 0 ? (allowedCount / totalTurns) * 100 : 100;

    // 6. Recent turn trend (last 7 turns or simple timeline)
    const recentTurns = await Turn.find({})
      .sort({ createdAt: -1 })
      .limit(7)
      .select('scores riskLevel createdAt');

    // 7. Latency by model (using Session joins)
    // Register models
    const registeredSession = Session;
    const modelLatencies = await Turn.aggregate([
      {
        $lookup: {
          from: 'sessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session'
        }
      },
      { $unwind: '$session' },
      {
        $group: {
          _id: '$session.modelType',
          avgLatency: { $avg: '$latencyMs' },
          count: { $sum: 1 }
        }
      }
    ]);

    const modelLatencyData = modelLatencies.map(item => ({
      model: item._id,
      avgLatencyMs: item.avgLatency,
      requestCount: item.count
    }));

    return NextResponse.json({
      totalRequests: totalTurns,
      totalAlerts,
      actionDistribution: actionDist,
      riskDistribution: riskDist,
      averageLatencyMs,
      securityIndex,
      recentTrends: recentTurns.reverse(),
      modelPerformance: modelLatencyData
    });
  } catch (error: any) {
    console.error('[admin/metrics/GET] error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin metrics' }, { status: 500 });
  }
}
