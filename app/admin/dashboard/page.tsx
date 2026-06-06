'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Activity, Clock, ShieldCheck, ShieldAlert, 
  RotateCw, Loader2, Cpu, AlertTriangle, ShieldX, CheckCircle, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MetricData {
  totalRequests: number;
  totalAlerts: number;
  actionDistribution: {
    allow: number;
    clarify: number;
    sanitize_rerun: number;
    contain: number;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  averageLatencyMs: number;
  securityIndex: number;
  recentTrends: Array<{
    _id: string;
    scores: { total: number };
    riskLevel: string;
    createdAt: string;
  }>;
  modelPerformance: Array<{
    model: string;
    avgLatencyMs: number;
    requestCount: number;
  }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<MetricData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/metrics');
      if (!res.ok) throw new Error('Failed to load metrics');
      const metrics = await res.json();
      setData(metrics);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not load administrative metrics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="text-xs text-neutral-500">Compiling database metrics...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-white">
        <span className="text-xs text-neutral-500">Failed to load metrics dashboard. Please refresh.</span>
      </div>
    );
  }

  // Intercepted: total - allowed
  const interceptedCount = data.totalRequests - data.actionDistribution.allow;

  // Compute percentages for action distribution
  const totalActions = data.totalRequests || 1;
  const getPercent = (val: number) => ((val / totalActions) * 100).toFixed(1);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            System Performance Metrics
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time server diagnostic aggregates, threat interceptions, and model inference latency audits.
          </p>
        </div>

        <Button 
          onClick={fetchMetrics}
          className="bg-[#0D1321] border border-neutral-850 hover:border-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" /> Refresh Metrics
        </Button>
      </div>

      {/* 1. TOP METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Metric 1 */}
        <div className="glass-panel p-5 border border-neutral-850 bg-[#0D1321]/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-neutral-900/60 border border-neutral-850 flex items-center justify-center text-neutral-400">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Total Queries</span>
            <span className="text-xl font-black">{data.totalRequests}</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-5 border border-neutral-850 bg-[#0D1321]/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <ShieldX className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Intercepted</span>
            <span className="text-xl font-black text-red-400">{interceptedCount}</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-5 border border-neutral-850 bg-[#0D1321]/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-neutral-900/60 border border-neutral-850 flex items-center justify-center text-neutral-400">
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Avg Latency</span>
            <span className="text-xl font-black">{(data.averageLatencyMs / 1000).toFixed(2)}s</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel p-5 border border-neutral-850 bg-[#0D1321]/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Security Index</span>
            <span className="text-xl font-black text-green-400">{data.securityIndex.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* 2. CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Chart Card 1: Action Distribution */}
        <div className="glass-panel p-6 border border-neutral-850 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-6">Security Action Enforcement</h3>
            <div className="space-y-4">
              {/* Allow */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-1.5 text-neutral-400"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Allow Execution</span>
                  <span className="font-bold">{data.actionDistribution.allow} ({getPercent(data.actionDistribution.allow)}%)</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${getPercent(data.actionDistribution.allow)}%` }} />
                </div>
              </div>

              {/* Clarify */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-1.5 text-neutral-400"><HelpCircle className="w-3.5 h-3.5 text-yellow-500" /> Request Clarification</span>
                  <span className="font-bold">{data.actionDistribution.clarify} ({getPercent(data.actionDistribution.clarify)}%)</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${getPercent(data.actionDistribution.clarify)}%` }} />
                </div>
              </div>

              {/* Sanitize Rerun */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-1.5 text-neutral-400"><RotateCw className="w-3.5 h-3.5 text-orange-500" /> Sanitize & Rerun</span>
                  <span className="font-bold">{data.actionDistribution.sanitize_rerun} ({getPercent(data.actionDistribution.sanitize_rerun)}%)</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${getPercent(data.actionDistribution.sanitize_rerun)}%` }} />
                </div>
              </div>

              {/* Contain */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-1.5 text-neutral-400"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Contain & Block</span>
                  <span className="font-bold">{data.actionDistribution.contain} ({getPercent(data.actionDistribution.contain)}%)</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${getPercent(data.actionDistribution.contain)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 mt-6 pt-4 border-t border-neutral-850/50">
            Total enforce actions logged during active verification pipeline.
          </div>
        </div>

        {/* Chart Card 2: Risk Distribution */}
        <div className="glass-panel p-6 border border-neutral-850 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-6">Threat Risk Profile</h3>
            <div className="space-y-4">
              {/* Low */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Low Risk</span>
                  <span className="font-bold">{data.riskDistribution.low} ({getPercent(data.riskDistribution.low)}%)</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${getPercent(data.riskDistribution.low)}%` }} />
                </div>
              </div>

              {/* Medium */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Medium Risk</span>
                  <span className="font-bold">{data.riskDistribution.medium} ({getPercent(data.riskDistribution.medium)}%)</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${getPercent(data.riskDistribution.medium)}%` }} />
                </div>
              </div>

              {/* High */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">High Risk</span>
                  <span className="font-bold">{data.riskDistribution.high} ({getPercent(data.riskDistribution.high)}%)</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${getPercent(data.riskDistribution.high)}%` }} />
                </div>
              </div>

              {/* Critical */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Critical Risk</span>
                  <span className="font-bold">{data.riskDistribution.critical} ({getPercent(data.riskDistribution.critical)}%)</span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full animate-pulse" style={{ width: `${getPercent(data.riskDistribution.critical)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 mt-6 pt-4 border-t border-neutral-850/50">
            Categorized by threat score boundaries set in baseline safety policies.
          </div>
        </div>
      </div>

      {/* 3. PERFORMANCE BY INFERENCE ENGINE & RECENT TREND */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Model Performance */}
        <div className="glass-panel p-6 border border-neutral-850 lg:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-6">Inference Model Performance</h3>
          {data.modelPerformance && data.modelPerformance.length > 0 ? (
            <div className="space-y-4">
              {data.modelPerformance.map((mp, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-neutral-950/40 rounded-lg border border-neutral-850">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-400">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white capitalize">{mp.model || 'Unknown'}</span>
                      <span className="text-[9px] text-neutral-500 block">{mp.requestCount} queries executed</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-white block">{(mp.avgLatencyMs / 1000).toFixed(2)}s</span>
                    <span className="text-[9px] text-neutral-500 block">Avg latency</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-neutral-500 italic">No model performance logs available.</div>
          )}
        </div>

        {/* Recent safety trend */}
        <div className="glass-panel p-6 border border-neutral-850">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-6">Recent Safety Trend</h3>
          {data.recentTrends && data.recentTrends.length > 0 ? (
            <div className="space-y-3.5">
              {data.recentTrends.map((rt, i) => (
                <div key={i} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-neutral-400 font-mono">Event #{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500 font-mono">Divergence: {rt.scores?.total?.toFixed(1) || '0.0'}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase ${
                      rt.riskLevel === 'critical' ? 'text-red-400 border-red-500/20 bg-red-950/20' :
                      rt.riskLevel === 'high' ? 'text-orange-400 border-orange-500/20 bg-orange-950/20' :
                      rt.riskLevel === 'medium' ? 'text-yellow-400 border-yellow-500/20 bg-yellow-950/20' :
                      'text-green-400 border-green-500/20 bg-green-950/20'
                    }`}>
                      {rt.riskLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-neutral-500 italic">No recent execution logs.</div>
          )}
        </div>
      </div>
    </div>
  );
}
