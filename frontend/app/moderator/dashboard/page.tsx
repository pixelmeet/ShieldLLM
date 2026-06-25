'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, ShieldCheck, Eye, EyeOff, Loader2, AlertTriangle, 
  CheckCircle, FileSearch, ArrowRight, BarChart3, AlertCircle 
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Alert {
  _id: string;
  sessionId: {
    _id: string;
    toolType: 'code_review' | 'policy_enforcement' | 'compliance';
    defenseMode: string;
  } | null;
  turnId: {
    _id: string;
    userText: string;
    action: string;
    scores: { total: number };
  } | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

export default function ModeratorDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      setAlerts(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not retrieve security alerts feed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'resolved' | 'dismissed') => {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error('Failed to update alert state');
      
      toast.success(`Alert marked as ${status}`);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, status } : a));
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to change alert resolution status');
    } finally {
      setUpdatingId(null);
    }
  };

  // Stats calculation
  const pendingCount = alerts.filter(a => a.status === 'pending').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;
  const dismissedCount = alerts.filter(a => a.status === 'dismissed').length;
  const totalCount = alerts.length;

  const filteredAlerts = alerts.filter(a => {
    const statusMatch = statusFilter === 'all' || a.status === statusFilter;
    const riskMatch = riskFilter === 'all' || a.riskLevel === riskFilter;
    return statusMatch && riskMatch;
  });

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'text-red-400 bg-red-950/40 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-950/40 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-950/40 border-yellow-500/30';
      default: return 'text-green-400 bg-green-950/40 border-green-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'text-green-400 bg-green-950/20 border-green-800/30';
      case 'dismissed': return 'text-neutral-400 bg-neutral-900/20 border-neutral-800';
      default: return 'text-yellow-400 bg-yellow-950/20 border-yellow-800/30 animate-pulse';
    }
  };

  const getToolTypeLabel = (val?: string) => {
    switch (val) {
      case 'code_review': return 'Code Review';
      case 'policy_enforcement': return 'Policy Enforcement';
      case 'compliance': return 'Compliance';
      default: return val || 'User Chat';
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 text-white">
      {/* Title Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-red-400 animate-pulse" />
          Moderation Threat Feed
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Monitor anomalies, prompt injections, and policy stress alerts triggered across LLM execution contexts.
        </p>
      </div>

      {/* 1. Statistics Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass-panel p-4 border border-neutral-850 bg-[#0D1321]/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neutral-900/60 flex items-center justify-center text-neutral-400 border border-neutral-800">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Total Signals</span>
            <span className="text-lg font-black text-white">{totalCount}</span>
          </div>
        </div>

        <div className="glass-panel p-4 border border-neutral-850 bg-[#0D1321]/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400 border border-yellow-500/20">
            <AlertCircle className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Pending Review</span>
            <span className="text-lg font-black text-yellow-400">{pendingCount}</span>
          </div>
        </div>

        <div className="glass-panel p-4 border border-neutral-850 bg-[#0D1321]/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Resolved Threat</span>
            <span className="text-lg font-black text-green-400">{resolvedCount}</span>
          </div>
        </div>

        <div className="glass-panel p-4 border border-neutral-850 bg-[#0D1321]/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neutral-900/60 flex items-center justify-center text-neutral-500 border border-neutral-800">
            <EyeOff className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-neutral-500 font-bold uppercase block">Dismissed</span>
            <span className="text-lg font-black text-neutral-400">{dismissedCount}</span>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="glass-panel p-4 border border-neutral-850 bg-[#0D1321]/30 flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-semibold">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] bg-neutral-900 border-neutral-850 text-xs text-white">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1321] border-neutral-850 text-white text-xs">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-semibold">Risk:</span>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[130px] bg-neutral-900 border-neutral-850 text-xs text-white">
                <SelectValue placeholder="All risk" />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1321] border-neutral-850 text-white text-xs">
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <span className="text-xs text-neutral-500">
          Showing {filteredAlerts.length} audit notifications
        </span>
      </div>

      {/* 3. Alerts Timeline list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs text-neutral-500">Loading security incidents feed...</span>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="glass-panel text-center py-16 px-4 border border-neutral-850">
          <ShieldCheck className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Zero Incidents Registered</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            No system alerts match your filters. The active agent reasoning logs are verified clean.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((a) => {
            const date = new Date(a.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div 
                key={a._id} 
                className="glass-panel p-5 border border-neutral-850 hover:border-red-500/10 transition-all duration-300 flex flex-col lg:flex-row justify-between lg:items-center gap-6"
              >
                <div className="space-y-2.5 max-w-2xl">
                  {/* Incident info and badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase ${getRiskColor(a.riskLevel)}`}>
                      {a.riskLevel}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase ${getStatusColor(a.status)}`}>
                      {a.status}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-400">
                      Goal: {getToolTypeLabel(a.sessionId?.toolType)}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      ID: {a._id}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white leading-relaxed">
                    {a.title}
                  </h3>

                  {a.turnId?.userText && (
                    <div className="text-[11px] text-neutral-400 leading-relaxed font-mono bg-neutral-950/40 p-2.5 rounded border border-neutral-900 truncate">
                      <span className="font-bold text-cyan-400 mr-1.5">User Prompt:</span>
                      {a.turnId.userText}
                    </div>
                  )}
                </div>

                <div className="pt-4 lg:pt-0 border-t lg:border-t-0 border-neutral-850/60 flex flex-wrap items-center gap-3 shrink-0">
                  <span className="text-[10px] text-neutral-500 mr-2">{date}</span>

                  {a.status === 'pending' && (
                    <>
                      <Button
                        onClick={() => handleUpdateStatus(a._id, 'resolved')}
                        disabled={updatingId === a._id}
                        className="h-8 px-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 text-xs font-semibold cursor-pointer"
                      >
                        Resolve
                      </Button>
                      <Button
                        onClick={() => handleUpdateStatus(a._id, 'dismissed')}
                        disabled={updatingId === a._id}
                        className="h-8 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 text-xs font-semibold cursor-pointer"
                      >
                        Dismiss
                      </Button>
                    </>
                  )}

                  {a.sessionId?._id && (
                    <Link href={`/user/sessions/${a.sessionId._id}`}>
                      <Button className="h-8 px-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold flex items-center gap-1 cursor-pointer">
                        Audit Logs <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

