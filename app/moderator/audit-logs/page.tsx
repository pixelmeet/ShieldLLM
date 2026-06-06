'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileSearch, Loader2, ArrowRight, ShieldAlert, ShieldCheck, 
  Calendar, User as UserIcon, HelpCircle, RefreshCw, AlertTriangle, 
  Search, ExternalLink, Activity
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Turn {
  _id: string;
  sessionId: {
    _id: string;
    toolType: string;
    defenseMode: string;
    userId: {
      _id: string;
      fullName: string;
      email: string;
    } | null;
  } | null;
  userText: string;
  primaryOutput: string;
  scores: { total: number };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'allow' | 'clarify' | 'sanitize_rerun' | 'contain';
  latencyMs: number;
  createdAt: string;
}

export default function ModeratorAuditLogs() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchTurns();
  }, []);

  const fetchTurns = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/moderator/turns');
      if (!res.ok) throw new Error('Failed to fetch turn logs');
      const data = await res.json();
      setTurns(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not load system execution logs');
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique list of users from turns
  const uniqueUsers = Array.from(new Set(turns.map(t => {
    const user = t.sessionId?.userId;
    return user ? JSON.stringify({ email: user.email, name: user.fullName }) : null;
  }).filter(Boolean))).map(str => JSON.parse(str!));

  const filteredTurns = turns.filter(t => {
    const riskMatch = riskFilter === 'all' || t.riskLevel === riskFilter;
    const actionMatch = actionFilter === 'all' || t.action === actionFilter;
    
    const user = t.sessionId?.userId;
    const userMatch = userFilter === 'all' || user?.email === userFilter;

    const query = searchQuery.trim().toLowerCase();
    const searchMatch = !query || 
      t.userText.toLowerCase().includes(query) ||
      user?.fullName.toLowerCase().includes(query) ||
      user?.email.toLowerCase().includes(query);

    return riskMatch && actionMatch && userMatch && searchMatch;
  });

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'text-red-400 bg-red-950/40 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-950/40 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-950/40 border-yellow-500/30';
      default: return 'text-green-400 bg-green-950/40 border-green-500/30';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'allow':
        return <ShieldCheck className="w-3.5 h-3.5 text-green-500" />;
      case 'clarify':
        return <HelpCircle className="w-3.5 h-3.5 text-yellow-500" />;
      case 'sanitize_rerun':
        return <RefreshCw className="w-3.5 h-3.5 text-orange-500" />;
      case 'contain':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />;
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
          <FileSearch className="w-6 h-6 text-cyan-400" />
          System Audit Stream
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Review, filter, and inspect LLM turn reasoning logs across all sessions in the system.
        </p>
      </div>

      {/* Filter panel */}
      <div className="glass-panel p-4 border border-neutral-850 bg-[#0D1321]/30 space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* User selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-neutral-400 font-bold uppercase">Filter User</span>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full bg-neutral-900 border-neutral-850 text-xs text-white">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1321] border-neutral-850 text-white text-xs">
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map(user => (
                  <SelectItem key={user.email} value={user.email} className="truncate">
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Risk selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-neutral-400 font-bold uppercase">Filter Risk</span>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full bg-neutral-900 border-neutral-850 text-xs text-white">
                <SelectValue placeholder="All risk" />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1321] border-neutral-850 text-white text-xs">
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-neutral-400 font-bold uppercase">Filter Action</span>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full bg-neutral-900 border-neutral-850 text-xs text-white">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1321] border-neutral-850 text-white text-xs">
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="clarify">Clarify</SelectItem>
                <SelectItem value="sanitize_rerun">Sanitize Rerun</SelectItem>
                <SelectItem value="contain">Contain</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prompt Search */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-neutral-400 font-bold uppercase">Search Prompts</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user email or text..."
                className="w-full bg-neutral-900 border border-neutral-850 rounded-md py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-neutral-850/50 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            Showing {filteredTurns.length} records of {turns.length} logged
          </span>
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Log Feed timeline */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs text-neutral-500">Loading global audit log...</span>
        </div>
      ) : filteredTurns.length === 0 ? (
        <div className="glass-panel text-center py-16 px-4 border border-neutral-850">
          <FileSearch className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No Matching Audit Entries</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Try adjusting your status filters or searching for another keyword to audit.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTurns.map((t) => {
            const date = new Date(t.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            return (
              <div 
                key={t._id}
                className="glass-panel p-5 border border-neutral-850 hover:border-neutral-800 transition-all duration-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  {/* Incident metadata */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className={`font-bold px-1.5 py-0.5 border rounded uppercase ${getRiskColor(t.riskLevel)}`}>
                      {t.riskLevel}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-neutral-300 uppercase px-1.5 py-0.5 border border-neutral-850 rounded">
                      {getActionIcon(t.action)} {t.action}
                    </span>
                    <span className="text-cyan-400 font-bold bg-cyan-950/20 border border-cyan-900/30 px-1.5 py-0.5 rounded">
                      Div: {t.scores?.total?.toFixed(1) || '0.0'}
                    </span>
                    <span className="text-neutral-500">
                      Goal: {getToolTypeLabel(t.sessionId?.toolType)}
                    </span>
                  </div>

                  {/* User info */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <UserIcon className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="font-semibold text-neutral-200">{t.sessionId?.userId?.fullName || 'System User'}</span>
                    <span className="text-[10px] text-neutral-500">({t.sessionId?.userId?.email || 'N/A'})</span>
                  </div>

                  {/* User Prompt Text */}
                  <p className="text-xs text-neutral-300 font-mono leading-relaxed truncate max-w-3xl">
                    <span className="font-bold text-neutral-400 mr-2">Prompt:</span>
                    {t.userText}
                  </p>
                </div>

                <div className="pt-4 md:pt-0 border-t md:border-t-0 border-neutral-850/60 flex items-center justify-between md:justify-end gap-4 shrink-0 w-full md:w-auto">
                  <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-neutral-600" />
                    {date}
                  </span>

                  {t.sessionId?._id && (
                    <Link href={`/user/sessions/${t.sessionId._id}`}>
                      <Button className="h-8 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold flex items-center gap-1 cursor-pointer">
                        Audit Log <ExternalLink className="w-3.5 h-3.5" />
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
