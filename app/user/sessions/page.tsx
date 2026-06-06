'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Trash2, ArrowRight, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Session {
  _id: string;
  toolType: 'code_review' | 'policy_enforcement' | 'compliance';
  defenseMode: 'passive' | 'active' | 'strict';
  modelType: string;
  trustScore: number;
  createdAt: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/sessions');
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not fetch active sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session and all its message logs?')) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Deletion failed');
      
      toast.success('Session deleted successfully');
      setSessions(prev => prev.filter(s => s._id !== id));
    } catch (err: any) {
      console.error(err);
      toast.error('Could not delete session');
    } finally {
      setDeletingId(null);
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

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 text-white">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            Audit Sessions History
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Review and manage active Guard execution histories, trust degradation logs, and model interactions.
          </p>
        </div>

        <Link href="/user/chat">
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs gap-1.5 cursor-pointer">
            <Play className="w-3.5 h-3.5 fill-current" /> Start New Guard Chat
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs text-neutral-500">Loading audit records...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-panel text-center py-16 px-4 border border-neutral-850">
          <Shield className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No Active Auditing Sessions Found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
            ShieldLLM records each LLM interaction in isolated sandbox sessions to check for intent divergence.
          </p>
          <Link href="/user/chat">
            <Button className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/15 text-xs cursor-pointer">
              Launch Guard Console
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((s) => {
            const date = new Date(s.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div 
                key={s._id} 
                className="glass-panel p-6 border border-neutral-850 hover:border-cyan-500/20 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold text-white truncate max-w-[170px]">
                      {getToolTypeLabel(s.toolType)}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase ${
                      s.defenseMode === 'strict' 
                        ? 'text-red-400 bg-red-950/20 border-red-500/20' 
                        : s.defenseMode === 'active' 
                        ? 'text-cyan-400 bg-cyan-950/20 border-cyan-500/20'
                        : 'text-neutral-400 bg-neutral-900/20 border-neutral-800'
                    }`}>
                      {s.defenseMode}
                    </span>
                  </div>

                  <div className="text-[10px] text-neutral-500 font-mono mb-4">
                    ID: {s._id}
                  </div>

                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-neutral-400">Trust Score:</span>
                    <span className={`font-bold ${
                      s.trustScore > 70 ? 'text-green-400' : s.trustScore > 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {Math.round(s.trustScore)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden mb-6">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        s.trustScore > 70 ? 'bg-green-500' : s.trustScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${s.trustScore}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-850/60 flex items-center justify-between gap-4">
                  <span className="text-[10px] text-neutral-500 truncate">{date}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      onClick={() => handleDelete(s._id)}
                      disabled={deletingId === s._id}
                      className="p-2 h-8 w-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md flex items-center justify-center cursor-pointer"
                    >
                      {deletingId === s._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    <Link href={`/user/sessions/${s._id}`}>
                      <Button className="h-8 py-0 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer">
                        Audit Logs <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
