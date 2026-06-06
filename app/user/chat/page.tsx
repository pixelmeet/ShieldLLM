'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Shield, History, Clock, Cpu, CheckCircle2, 
  HelpCircle, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Send, Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// TS interfaces
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

interface Defense {
  status: string;
  canonicalText: string;
  signals: string[];
  updatedGraph: { goal: string, allowed: string[], forbidden: string[], history: any[] };
  scores: { total: number };
  riskLevel: string;
  action: string;
  primaryOutput: string;
  shadowOutput: string;
  final_answer: string;
  divergence_score: number;
  total_latency_ms: number;
  llm_latency_ms: number;
  provider: string;
  model: string;
  llm_called: boolean;
  security_level: string;
  divergenceLog?: { divergenceScore: number, primary_ok: boolean, shadow_ok: boolean }
}

const CircularProgress = ({ value, size = 80, strokeWidth = 8 }: { value: number, size?: number, strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  let color = 'stroke-green-500';
  if (value > 25 && value <= 50) color = 'stroke-yellow-500';
  else if (value > 50 && value <= 75) color = 'stroke-orange-500';
  else if (value > 75) color = 'stroke-red-500';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="stroke-neutral-800"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${color} transition-all duration-300`}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="absolute text-sm font-bold text-white">{Math.round(value)}</span>
    </div>
  );
};

export default function ChatPage() {
  // Session states
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isFetchingSessions, setIsFetchingSessions] = useState(true);

  // New session form states
  const [toolType, setToolType] = useState<'code_review' | 'policy_enforcement' | 'compliance'>('code_review');
  const [defenseMode, setDefenseMode] = useState<'passive' | 'active' | 'strict'>('active');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Chat states
  const [turns, setTurns] = useState<Turn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFetchingTurns, setIsFetchingTurns] = useState(false);

  // Live Defense details state
  const [latestDefense, setLatestDefense] = useState<Defense | null>(null);

  // UI expanded states for Right Panel
  const [expandedSections, setExpandedSections] = useState({
    risk: true,
    divergence: true,
    action: true,
    signals: true,
    graph: true,
    latency: true,
    provider: true,
    shadow: true,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [turns, isSending]);

  // Fetch all sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async (selectFirst = true) => {
    try {
      setIsFetchingSessions(true);
      const res = await fetch('/api/sessions');
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(data);
      if (selectFirst && data.length > 0) {
        handleSelectSession(data[0]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Could not fetch active sessions');
    } finally {
      setIsFetchingSessions(false);
    }
  };

  const handleSelectSession = async (session: Session) => {
    setActiveSession(session);
    setTurns([]);
    setLatestDefense(null);
    setIsFetchingTurns(true);

    try {
      const res = await fetch(`/api/sessions/${session._id}/turn`);
      if (!res.ok) throw new Error('Failed to load turns');
      const data = await res.json();
      setTurns(data);

      // Extract the last turn to render details in the Right Panel
      if (data.length > 0) {
        const lastTurn: Turn = data[data.length - 1];
        setLatestDefense({
          status: 'success',
          canonicalText: lastTurn.sanitizedText || '',
          signals: [],
          updatedGraph: {
            goal: session.toolType,
            allowed: [],
            forbidden: [],
            history: []
          },
          scores: { total: lastTurn.scores?.total || 0 },
          riskLevel: lastTurn.riskLevel,
          action: lastTurn.action,
          primaryOutput: lastTurn.primaryOutput,
          shadowOutput: lastTurn.shadowOutput,
          final_answer: lastTurn.primaryOutput,
          divergence_score: lastTurn.scores?.total || 0,
          total_latency_ms: lastTurn.latencyMs,
          llm_latency_ms: lastTurn.latencyMs,
          provider: 'groq',
          model: 'groq-llama-3',
          llm_called: true,
          security_level: session.defenseMode
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load session history');
    } finally {
      setIsFetchingTurns(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      setIsCreatingSession(true);
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolType, defenseMode, modelType: 'groq' }),
      });

      if (!res.ok) throw new Error('Could not create session');
      const newSession = await res.json();
      
      toast.success('New session initialized');
      setIsNewSessionOpen(false);
      
      // Refresh list and select new session
      await fetchSessions(false);
      handleSelectSession(newSession);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to initialize session');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !activeSession || isSending) return;

    const currentPrompt = prompt;
    setPrompt('');
    setIsSending(true);

    try {
      const res = await fetch(`/api/sessions/${activeSession._id}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: currentPrompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to execute turn');
      }

      setTurns(prev => [...prev, data.turn]);
      setLatestDefense(data.defense);

      // Decay trust score locally if we received update
      if (data.defense.action !== 'unverified') {
        setActiveSession(prev => prev ? {
          ...prev,
          trustScore: Math.max(0, prev.trustScore - ((data.defense.scores?.total ?? 0) / 5))
        } : null);
        // Refresh active list in background to update score bar
        fetchSessions(false);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error occurred while sending message');
      // Put prompt back in input in case of failure
      setPrompt(currentPrompt);
    } finally {
      setIsSending(false);
    }
  };

  // Helper formatting styles
  const getToolTypeLabel = (val: string) => {
    switch (val) {
      case 'code_review': return 'Code Review';
      case 'policy_enforcement': return 'Policy Guard';
      case 'compliance': return 'Compliance';
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
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'clarify':
        return <HelpCircle className="w-5 h-5 text-yellow-500" />;
      case 'sanitize_rerun':
        return <RefreshCw className="w-5 h-5 text-orange-500" />;
      case 'contain':
        return <Shield className="w-5 h-5 text-red-500" />;
      default:
        return <HelpCircle className="w-5 h-5 text-neutral-400" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-48px)] overflow-hidden gap-4 -m-4 md:-m-6 bg-[#0A0E17]">
      {/* 1. LEFT COLUMN: Session Sidebar (280px) */}
      <aside className="w-[280px] flex flex-col border-r border-neutral-800 bg-[#0D1321]/50 backdrop-blur-sm p-4 shrink-0">
        <Dialog open={isNewSessionOpen} onOpenChange={setIsNewSessionOpen}>
          <DialogTrigger asChild>
            <Button className="w-full justify-center gap-2 mb-4 font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md cursor-pointer">
              <Plus className="w-4 h-4" /> New Session
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0D1321] border border-neutral-800 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Configure Guard Session</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="toolType" className="text-xs font-semibold text-neutral-300">Tool System Goal</Label>
                <Select value={toolType} onValueChange={(val: any) => setToolType(val)}>
                  <SelectTrigger className="w-full bg-[#0A0E17]/60 border-neutral-800 text-white">
                    <SelectValue placeholder="Select tool type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D1321] border border-neutral-800 text-white">
                    <SelectItem value="code_review" className="hover:bg-cyan-500/10 focus:bg-cyan-500/10">Code Review</SelectItem>
                    <SelectItem value="policy_enforcement" className="hover:bg-cyan-500/10 focus:bg-cyan-500/10">Policy Enforcement</SelectItem>
                    <SelectItem value="compliance" className="hover:bg-cyan-500/10 focus:bg-cyan-500/10">Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="defenseMode" className="text-xs font-semibold text-neutral-300">Defense Enforcement Mode</Label>
                <Select value={defenseMode} onValueChange={(val: any) => setDefenseMode(val)}>
                  <SelectTrigger className="w-full bg-[#0A0E17]/60 border-neutral-800 text-white">
                    <SelectValue placeholder="Select defense mode" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D1321] border border-neutral-800 text-white">
                    <SelectItem value="passive" className="hover:bg-cyan-500/10 focus:bg-cyan-500/10">Passive (Log & Warn)</SelectItem>
                    <SelectItem value="active" className="hover:bg-cyan-500/10 focus:bg-cyan-500/10">Active (Filter & Rerun)</SelectItem>
                    <SelectItem value="strict" className="hover:bg-cyan-500/10 focus:bg-cyan-500/10">Strict (Block anomalies)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-neutral-400">LLM Provider Backend</Label>
                <input
                  type="text"
                  disabled
                  value="Groq (llama-3-70b)"
                  className="w-full bg-neutral-950 border border-neutral-900 rounded-md px-3 py-2 text-xs text-neutral-500 select-none cursor-not-allowed"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleCreateSession}
                disabled={isCreatingSession}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold cursor-pointer"
              >
                {isCreatingSession ? 'Initializing...' : 'Create Session'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isFetchingSessions ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-[10px] text-neutral-500">Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-neutral-500">No sessions yet. Create one above.</div>
          ) : (
            sessions.map((s) => {
              const isActive = activeSession?._id === s._id;
              const date = new Date(s.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              });
              return (
                <button
                  key={s._id}
                  onClick={() => handleSelectSession(s)}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-cyan-950/20 border-cyan-400/50 shadow-[0_0_10px_rgba(0,242,254,0.05)]'
                      : 'bg-[#0D1321]/30 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-white truncate max-w-[140px]">
                      {getToolTypeLabel(s.toolType)}
                    </span>
                    <span className="text-[10px] text-neutral-500">{date}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] mb-2 text-neutral-400">
                    <span className="capitalize">{s.defenseMode} mode</span>
                    <span className="font-semibold">{Math.round(s.trustScore)}% trust</span>
                  </div>

                  {/* Trust indicator bar */}
                  <div className="w-full h-1 bg-neutral-850 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        s.trustScore > 70 ? 'bg-green-500' : s.trustScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${s.trustScore}%` }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. CENTER COLUMN: Chat Interface (flex-1) */}
      <section className="flex-1 flex flex-col min-w-0 border-r border-neutral-800 p-4 relative">
        {activeSession ? (
          <>
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4 shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  {getToolTypeLabel(activeSession.toolType)}
                </h2>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Mode: <span className="capitalize text-neutral-300 font-semibold">{activeSession.defenseMode}</span> | 
                  Provider: <span className="text-neutral-300 font-semibold">Groq Llama-3</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-400">Session Trust:</span>
                <span className={`text-xs font-bold ${
                  activeSession.trustScore > 70 ? 'text-green-400' : activeSession.trustScore > 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {Math.round(activeSession.trustScore)}%
                </span>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
              {isFetchingTurns ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <span className="text-xs text-neutral-500">Loading conversation history...</span>
                </div>
              ) : turns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-cyan-950/20 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Shield className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Intent-Locked Chat Session Initiated</h3>
                  <p className="text-xs text-neutral-500 max-w-sm">
                    Enter a prompt below. Your instructions are cross-referenced with your system constraints before model processing.
                  </p>
                </div>
              ) : (
                turns.map((t) => (
                  <div key={t._id} className="flex flex-col gap-2">
                    {/* User Prompt */}
                    <div className="flex justify-end pl-12">
                      <div className="bg-cyan-950/15 border border-cyan-500/20 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-xl">
                        <p className="text-xs text-cyan-50 font-medium whitespace-pre-wrap leading-relaxed">
                          {t.userText}
                        </p>
                        <span className="text-[8px] text-cyan-500/50 block text-right mt-1.5">
                          {new Date(t.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Assistant Output */}
                    <div className="flex justify-start pr-12">
                      <div className={`glass-panel p-4 rounded-2xl rounded-tl-none max-w-xl w-full border ${
                        t.action === 'contain' 
                          ? 'bg-red-500/5 border-red-500/20 text-red-50' 
                          : 'bg-[#0D1321]/40 border-neutral-800 text-neutral-200'
                      }`}>
                        {t.action === 'contain' ? (
                          <div className="flex gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-red-400 mb-1">Execution Blocked & Contained</p>
                              <p className="text-xs italic text-red-200/80 leading-relaxed">
                                {t.primaryOutput || 'Potential prompt injection attempt blocked by ShieldLLM active guardrails.'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs leading-relaxed whitespace-pre-wrap">
                            {t.primaryOutput}
                          </p>
                        )}

                        {/* Badges footer */}
                        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-neutral-800/40">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase ${getRiskColor(t.riskLevel)}`}>
                            {t.riskLevel} risk
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] text-neutral-400 font-semibold uppercase">
                            Action: {getActionIcon(t.action)} <span className="text-neutral-300 font-bold ml-0.5">{t.action}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Typing / Loading Indicator */}
              {isSending && (
                <div className="flex justify-start pr-12">
                  <div className="glass-panel p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span className="text-[11px] text-neutral-500 font-medium">Analyzing prompt intent...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <form onSubmit={handleSendMessage} className="relative shrink-0">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isSending}
                placeholder="Type your message..."
                rows={1}
                required
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                className="w-full bg-[#0A0E17]/60 border border-neutral-800 rounded-xl py-3 pl-4 pr-12 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 resize-none"
              />
              <Button
                type="submit"
                disabled={isSending || !prompt.trim()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 h-8 w-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-neutral-800 disabled:opacity-50 text-neutral-950 hover:text-black shadow-md flex items-center justify-center cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <Shield className="w-10 h-10 text-neutral-700" />
            <span className="text-xs text-neutral-500">Please select or create a session to begin.</span>
          </div>
        )}
      </section>

      {/* 3. RIGHT COLUMN: Live Defense Analysis Panel (320px) */}
      <aside className="w-[320px] flex flex-col border-l border-neutral-800 bg-[#0D1321]/50 backdrop-blur-sm p-4 shrink-0 overflow-y-auto space-y-3">
        <div className="pb-3 border-b border-neutral-800">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Defense Auditor</h3>
          <p className="text-[9px] text-neutral-500 mt-0.5">Real-time threat diagnostics</p>
        </div>

        {latestDefense ? (
          <>
            {/* Risk Level Panel */}
            <div className="glass-panel overflow-hidden border-neutral-850">
              <button 
                onClick={() => toggleSection('risk')} 
                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-white bg-neutral-950/20 cursor-pointer"
              >
                <span>Risk Level Assessment</span>
                {expandedSections.risk ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {expandedSections.risk && (
                <div className="p-3 border-t border-neutral-850">
                  <div className={`w-full py-2.5 px-3 rounded-lg border text-center font-extrabold uppercase text-sm tracking-wider ${
                    latestDefense.riskLevel === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' :
                    latestDefense.riskLevel === 'high' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                    latestDefense.riskLevel === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                    'bg-green-500/10 border-green-500/30 text-green-400'
                  }`}>
                    {latestDefense.riskLevel || 'low'} Risk
                  </div>
                </div>
              )}
            </div>

            {/* Divergence Score Panel */}
            <div className="glass-panel overflow-hidden border-neutral-850">
              <button 
                onClick={() => toggleSection('divergence')} 
                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-white bg-neutral-950/20 cursor-pointer"
              >
                <span>Divergence Analysis</span>
                {expandedSections.divergence ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {expandedSections.divergence && (
                <div className="p-3 border-t border-neutral-850 flex flex-col items-center gap-3">
                  <CircularProgress value={latestDefense.divergence_score || 0} />
                  <p className="text-[10px] text-neutral-400 text-center leading-relaxed px-2">
                    Measures reasoning deviations between the primary prompt and shadow-baseline prompt.
                  </p>
                </div>
              )}
            </div>

            {/* Defense Action Panel */}
            <div className="glass-panel overflow-hidden border-neutral-850">
              <button 
                onClick={() => toggleSection('action')} 
                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-white bg-neutral-950/20 cursor-pointer"
              >
                <span>Enforcement Action</span>
                {expandedSections.action ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {expandedSections.action && (
                <div className="p-3 border-t border-neutral-850 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                    {getActionIcon(latestDefense.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white capitalize">{latestDefense.action}</p>
                    <p className="text-[10px] text-neutral-500">Pipeline policy decision</p>
                  </div>
                </div>
              )}
            </div>

            {/* Security Signals Panel */}
            <div className="glass-panel overflow-hidden border-neutral-850">
              <button 
                onClick={() => toggleSection('signals')} 
                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-white bg-neutral-950/20 cursor-pointer"
              >
                <span>Security Signals ({latestDefense.signals?.length || 0})</span>
                {expandedSections.signals ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {expandedSections.signals && (
                <div className="p-3 border-t border-neutral-850">
                  {latestDefense.signals && latestDefense.signals.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {latestDefense.signals.map((sig, i) => (
                        <span key={i} className="text-[9px] font-semibold px-2 py-0.5 rounded bg-cyan-950/30 border border-cyan-800/30 text-cyan-400">
                          {sig}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-neutral-500">No security warnings triggered</span>
                  )}
                </div>
              )}
            </div>

            {/* Intent Graph Status Panel */}
            <div className="glass-panel overflow-hidden border-neutral-850">
              <button 
                onClick={() => toggleSection('graph')} 
                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-white bg-neutral-950/20 cursor-pointer"
              >
                <span>Intent Graph Lock</span>
                {expandedSections.graph ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {expandedSections.graph && (
                <div className="p-3 border-t border-neutral-850 space-y-2.5">
                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-0.5">Core Goal Constraint</span>
                    <span className="text-xs font-semibold text-white bg-neutral-950 border border-neutral-900 rounded-md py-1 px-2 block truncate">
                      {getToolTypeLabel(latestDefense.updatedGraph?.goal || '')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase block mb-1">State Transition Logs</span>
                    {latestDefense.updatedGraph?.history && latestDefense.updatedGraph.history.length > 0 ? (
                      <div className="space-y-1">
                        {latestDefense.updatedGraph.history.slice(-3).map((hist, i) => (
                          <div key={i} className="text-[9px] text-neutral-400 bg-neutral-950/40 p-1.5 rounded border border-neutral-850 truncate">
                            {hist?.action || hist || 'State transition recorded'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[9px] text-neutral-500 italic">No graph updates recorded yet</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Latency Panel */}
            <div className="glass-panel overflow-hidden border-neutral-850">
              <button 
                onClick={() => toggleSection('latency')} 
                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-white bg-neutral-950/20 cursor-pointer"
              >
                <span>Pipeline Performance</span>
                {expandedSections.latency ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {expandedSections.latency && (
                <div className="p-3 border-t border-neutral-850 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400">Total processing latency:</span>
                  <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-500" />
                    {(latestDefense.total_latency_ms / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
            </div>

            {/* LLM Provider Panel */}
            <div className="glass-panel overflow-hidden border-neutral-850">
              <button 
                onClick={() => toggleSection('provider')} 
                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-white bg-neutral-950/20 cursor-pointer"
              >
                <span>Deployment Stack</span>
                {expandedSections.provider ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {expandedSections.provider && (
                <div className="p-3 border-t border-neutral-850 space-y-2 text-[10px] text-neutral-400">
                  <div className="flex justify-between">
                    <span>Inference Endpoint:</span>
                    <span className="text-white font-semibold flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-neutral-500" /> {latestDefense.provider}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>LLM Engine Model:</span>
                    <span className="text-white font-semibold">{latestDefense.model}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Shadow Reasoning Panel */}
            <div className="glass-panel overflow-hidden border-neutral-850">
              <button 
                onClick={() => toggleSection('shadow')} 
                className="w-full flex items-center justify-between p-3 text-left font-bold text-xs text-white bg-neutral-950/20 cursor-pointer"
              >
                <span>Shadow Reasoning System</span>
                {expandedSections.shadow ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {expandedSections.shadow && (
                <div className="p-3 border-t border-neutral-850 space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-neutral-400">
                    <span>Shadow Path:</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      latestDefense.divergenceLog?.shadow_ok !== false
                        ? 'text-green-400 bg-green-950/20 border-green-500/20'
                        : 'text-yellow-400 bg-yellow-950/20 border-yellow-500/20'
                    }`}>
                      {latestDefense.divergenceLog?.shadow_ok !== false ? 'Active' : 'Skipped'}
                    </span>
                  </div>

                  {latestDefense.shadowOutput && (
                    <div className="text-[9px] bg-neutral-950/60 p-2 rounded border border-neutral-850 max-h-24 overflow-y-auto">
                      <p className="font-bold text-purple-400 mb-0.5">Shadow Engine Output</p>
                      <p className="text-neutral-400 leading-relaxed font-mono whitespace-pre-wrap">{latestDefense.shadowOutput}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 gap-2 border border-dashed border-neutral-850 rounded-lg">
            <Shield className="w-8 h-8 text-neutral-700 animate-pulse" />
            <span className="text-[10px] text-neutral-500 leading-relaxed px-2">
              Send a prompt to populate real-time defense analysis and Intent Graph constraints.
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}
