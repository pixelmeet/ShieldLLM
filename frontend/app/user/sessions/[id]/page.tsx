'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, Loader2, Calendar, Clock, GitCommit, AlertTriangle, CheckCircle, RefreshCw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Session {
  _id: string;
  toolType: 'code_review' | 'policy_enforcement' | 'compliance';
  defenseMode: 'passive' | 'active' | 'strict';
  modelType: string;
  trustScore: number;
  createdAt: string;
}

interface Turn {
  _id: string;
  sessionId: string;
  userText: string;
  primaryOutput: string;
  shadowOutput: string;
  scores: { semanticDrift: number, policyStress: number, reasoningMismatch: number, total: number };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'allow' | 'clarify' | 'sanitize_rerun' | 'contain';
  sanitizedText: string | null;
  latencyMs: number;
  createdAt: string;
}

export default function SessionDetailPage({ params }: PageProps) {
  const { id: sessionId } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      setIsLoading(true);
      // Fetch session meta
      const sessionRes = await fetch(`/api/sessions/${sessionId}`);
      if (!sessionRes.ok) throw new Error('Session not found');
      const sessionData = await sessionRes.json();
      setSession(sessionData);

      // Fetch turns
      const turnsRes = await fetch(`/api/sessions/${sessionId}/turn`);
      if (!turnsRes.ok) throw new Error('Turns not found');
      const turnsData = await turnsRes.json();
      setTurns(turnsData);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not load session audit details');
    } finally {
      setIsLoading(false);
    }
  };

  const getToolTypeLabel = (val: string) => {
    switch (val) {
      case 'code_review': return 'Code Review Guard';
      case 'policy_enforcement': return 'Policy Enforcement';
      case 'compliance': return 'Compliance Audit';
      default: return val;
    }
  };

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
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'clarify':
        return <HelpCircle className="w-3.5 h-3.5 text-yellow-500" />;
      case 'sanitize_rerun':
        return <RefreshCw className="w-3.5 h-3.5 text-orange-500" />;
      case 'contain':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 text-white">
      {/* Back CTA */}
      <div className="mb-6">
        <Link href="/user/sessions" className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-cyan-400 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to audit list
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs text-neutral-500">Retrieving audit timeline...</span>
        </div>
      ) : !session ? (
        <div className="glass-panel text-center py-12 border border-neutral-850">
          <Shield className="w-10 h-10 text-neutral-700 mx-auto mb-2" />
          <span className="text-xs text-neutral-500">Session logs not found.</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Header Metadata Summary Card */}
          <div className="glass-panel p-6 border border-neutral-850 bg-[#0D1321]/30 flex flex-col md:flex-row justify-between gap-6">
            <div className="space-y-2">
              <span className="text-gradient-cyan text-xs font-extrabold uppercase tracking-wider block">Audit Record Card</span>
              <h1 className="text-xl font-bold text-white">{getToolTypeLabel(session.toolType)}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-neutral-500" /> {new Date(session.createdAt).toLocaleString()}</span>
                <span>•</span>
                <span>Mode: <span className="capitalize text-neutral-200 font-semibold">{session.defenseMode}</span></span>
                <span>•</span>
                <span>Engine: <span className="text-neutral-200 font-semibold">{session.modelType}</span></span>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 md:border-l border-neutral-850 pt-4 md:pt-0 md:pl-6">
              <div className="text-left md:text-right">
                <span className="text-[10px] text-neutral-500 font-bold uppercase block">Final Trust Score</span>
                <span className={`text-2xl font-black ${
                  session.trustScore > 70 ? 'text-green-400' : session.trustScore > 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {Math.round(session.trustScore)}%
                </span>
              </div>
              <div className="w-32 h-2 bg-neutral-900 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    session.trustScore > 70 ? 'bg-green-500' : session.trustScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${session.trustScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Timeline header */}
          <div>
            <h2 className="text-sm font-bold text-neutral-300 mb-4 uppercase tracking-wider">Turn Execution Timeline ({turns.length})</h2>
            {turns.length === 0 ? (
              <div className="text-xs text-neutral-500 italic py-6 pl-4 border-l border-neutral-800">
                No turns recorded in this session.
              </div>
            ) : (
              <div className="space-y-8 relative before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-[2px] before:bg-neutral-850">
                {turns.map((t, idx) => (
                  <div key={t._id} className="relative pl-10 group">
                    {/* Timeline dot */}
                    <div className="absolute left-2.5 top-2.5 w-3.5 h-3.5 rounded-full bg-[#0A0E17] border-2 border-cyan-500/80 group-hover:border-cyan-400 transition-colors z-10 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    </div>

                    <div className="glass-panel p-6 border border-neutral-850 bg-[#0D1321]/20 hover:border-cyan-500/15 transition-all duration-200">
                      {/* Meta header */}
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-850/60 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-neutral-300">Turn #{idx + 1}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">ID: {t._id}</span>
                        </div>
                        <div className="flex items-center gap-x-4 text-neutral-400">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-neutral-500" /> {(t.latencyMs / 1000).toFixed(2)}s</span>
                          <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase ${getRiskColor(t.riskLevel)}`}>
                            {t.riskLevel} risk
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold text-neutral-300">
                            {getActionIcon(t.action)} {t.action}
                          </span>
                        </div>
                      </div>

                      {/* Prompts section */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        {/* Raw Prompt */}
                        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-900">
                          <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wide mb-2">Raw User input</h4>
                          <p className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed leading-relaxed font-mono">
                            {t.userText}
                          </p>
                        </div>

                        {/* Sanitized Prompt */}
                        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-900">
                          <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-2">Sanitized Prompt</h4>
                          {t.sanitizedText ? (
                            <p className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed font-mono">
                              {t.sanitizedText}
                            </p>
                          ) : (
                            <span className="text-xs text-neutral-500 italic">No sanitization was required</span>
                          )}
                        </div>
                      </div>

                      {/* Outputs comparison */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        {/* Primary Output */}
                        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-900">
                          <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wide mb-2">Primary LLM Output</h4>
                          {t.action === 'contain' ? (
                            <p className="text-xs text-red-400 italic">
                              [Output Blocked] Reasoning deviated significantly from shadow baseline. Execution contained to prevent system exploitation.
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed font-mono">
                              {t.primaryOutput}
                            </p>
                          )}
                        </div>

                        {/* Shadow Output */}
                        <div className="bg-neutral-950/60 p-4 rounded-lg border border-neutral-900">
                          <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-wide mb-2">Shadow Baseline Output</h4>
                          {t.shadowOutput ? (
                            <p className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed font-mono">
                              {t.shadowOutput}
                            </p>
                          ) : (
                            <span className="text-xs text-neutral-500 italic">Shadow model reasoning output unavailable</span>
                          )}
                        </div>
                      </div>

                      {/* Scores breakdown table */}
                      <div className="border border-neutral-850 rounded-lg overflow-hidden bg-neutral-950/20">
                        <div className="bg-neutral-950/40 px-4 py-2 border-b border-neutral-850">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Threat Divergence Score Breakdown</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-neutral-850 text-center text-xs">
                          <div className="p-3">
                            <span className="text-[10px] text-neutral-500 block mb-0.5">Semantic Drift</span>
                            <span className="font-bold text-white">{t.scores?.semanticDrift?.toFixed(1) || '0.0'}</span>
                          </div>
                          <div className="p-3">
                            <span className="text-[10px] text-neutral-500 block mb-0.5">Policy Stress</span>
                            <span className="font-bold text-white">{t.scores?.policyStress?.toFixed(1) || '0.0'}</span>
                          </div>
                          <div className="p-3">
                            <span className="text-[10px] text-neutral-500 block mb-0.5">Reasoning Mismatch</span>
                            <span className="font-bold text-white">{t.scores?.reasoningMismatch?.toFixed(1) || '0.0'}</span>
                          </div>
                          <div className="p-3 bg-neutral-950/20">
                            <span className="text-[10px] text-cyan-400 font-bold block mb-0.5">Total Divergence</span>
                            <span className={`font-black ${
                              (t.scores?.total || 0) > 70 ? 'text-red-400' : (t.scores?.total || 0) > 40 ? 'text-yellow-400' : 'text-green-400'
                            }`}>
                              {t.scores?.total?.toFixed(1) || '0.0'} / 100
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
