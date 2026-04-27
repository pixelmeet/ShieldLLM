'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Activity, Clock } from 'lucide-react';

interface MetricData {
  totalScanned: number;
  attacksBlocked: number;
  fpRate: number;
  avgLatency: number;
  attackTypeBreakdown: { type: string; count: number }[];
  recentAttacks: {
    timestamp: string | Date;
    attackType: string;
    riskScore: number;
    action: string;
  }[];
}

export default function MetricsPage() {
  const [data, setData] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics');
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const maxCount = Math.max(...data.attackTypeBreakdown.map(b => b.count), 1);

  return (
    <div className="min-h-screen p-8 text-white" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Defense Metrics</h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>Real-time evaluation of LLM prompt injection defenses.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Scanned" 
            value={data.totalScanned.toLocaleString()} 
            icon={<Activity className="text-blue-400" />} 
          />
          <StatCard 
            title="Attacks Blocked" 
            value={data.attacksBlocked.toLocaleString()} 
            icon={<ShieldAlert className="text-red-400" />} 
          />
          <StatCard 
            title="False Positive Rate" 
            value={`${data.fpRate.toFixed(2)}%`} 
            icon={<ShieldCheck className="text-green-400" />} 
          />
          <StatCard 
            title="Avg Latency" 
            value={`${data.avgLatency} ms`} 
            icon={<Clock className="text-yellow-400" />} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div 
            className="col-span-1 rounded-xl p-6 border"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}
          >
            <h2 className="text-xl font-semibold mb-6">Attack Types</h2>
            <div className="space-y-4">
              {data.attackTypeBreakdown.map((item) => (
                <div key={item.type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: 'var(--text-secondary)' }}>{item.type}</span>
                    <span className="font-mono">{item.count}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500 rounded-full transition-all duration-500" 
                      style={{ width: `${(item.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div 
            className="col-span-1 lg:col-span-2 rounded-xl p-6 border overflow-x-auto"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}
          >
            <h2 className="text-xl font-semibold mb-6">Recent Attacks</h2>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th className="pb-3 font-medium">Timestamp</th>
                  <th className="pb-3 font-medium">Attack Type</th>
                  <th className="pb-3 font-medium">Risk Score</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: 'var(--border-subtle)' }}>
                {data.recentAttacks.map((attack, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-white/5">
                    <td className="py-3" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(attack.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3">{attack.attackType || 'Unknown'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-mono ${attack.riskScore > 0.8 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {attack.riskScore.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        attack.action === 'BLOCK' ? 'bg-red-500/20 text-red-400' :
                        attack.action === 'SANITIZE' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {attack.action}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.recentAttacks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                      No recent attacks found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div 
      className="flex items-center p-6 rounded-xl border"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-medium)' }}
    >
      <div className="p-4 rounded-lg mr-4" style={{ background: 'var(--bg-tertiary)' }}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
