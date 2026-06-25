import { NextResponse } from 'next/server';
import { getMongoDb } from '@backend/lib/database/clients';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getMongoDb();
    const turnsCollection = db.collection('turns');

    const totalScanned = await turnsCollection.countDocuments();
    
    const attackQuery = { 
      $or: [
        { riskLevel: { $in: ['high', 'critical'] } },
        { 'scores.total': { $gt: 70 } }
      ],
      action: { $exists: true } 
    };
    const attacksBlocked = await turnsCollection.countDocuments(attackQuery);
    
    const fpQuery = { 'scores.total': { $gt: 70 }, action: 'allow' };
    const fpCount = await turnsCollection.countDocuments(fpQuery);
    const fpRate = totalScanned > 0 ? (fpCount / totalScanned) * 100 : 0;

    const avgLatencyResult = await turnsCollection.aggregate([
      { $match: { latencyMs: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$latencyMs' } } }
    ]).toArray();
    const avgLatency = avgLatencyResult.length > 0 ? Math.round(avgLatencyResult[0].avg) : 0;

    const attackTypeBreakdown = await turnsCollection.aggregate([
      { $match: attackQuery },
      { $group: { _id: '$attackType', count: { $sum: 1 } } },
      { $project: { _id: 0, type: { $ifNull: ['$_id', 'Unknown'] }, count: 1 } }
    ]).toArray() as unknown as Array<{ type: string; count: number }>;

    const standardTypes = ['Direct Injection', 'Multi-Turn', 'Obfuscation', 'Unknown'];
    const formattedBreakdown = standardTypes.map(type => {
      const found = attackTypeBreakdown.find(b => b.type === type);
      return { type, count: found ? found.count : 0 };
    });

    attackTypeBreakdown.forEach(b => {
      if (!standardTypes.includes(b.type)) {
        formattedBreakdown.push(b);
      }
    });

    const recentAttacks = await turnsCollection
      .find(attackQuery)
      .sort({ timestamp: -1 })
      .limit(10)
      .project({ timestamp: 1, attackType: 1, riskScore: 1, action: 1, _id: 0 })
      .toArray();

    return NextResponse.json({
      totalScanned,
      attacksBlocked,
      fpRate,
      avgLatency,
      attackTypeBreakdown: formattedBreakdown,
      recentAttacks
    });
  } catch (error) {
    console.error('Metrics API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

