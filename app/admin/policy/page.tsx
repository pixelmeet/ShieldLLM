'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, Loader2, Save, ToggleLeft, ToggleRight, 
  Shield, AlertTriangle, ShieldAlert, CheckCircle, HelpCircle, 
  RefreshCw, Info 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PolicyData {
  divergenceThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  trustDecay: number;
  shadowEnabled: boolean;
  defenseModeDefault: 'passive' | 'active' | 'strict';
}

export default function AdminPolicyPage() {
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/policy');
      if (!res.ok) throw new Error('Failed to load policy');
      const data = await res.json();
      setPolicy(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not load system safety policies');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policy) return;

    // Validation: thresholds should be sequential
    const { low, medium, high, critical } = policy.divergenceThresholds;
    if (low >= medium || medium >= high || high >= critical) {
      toast.error('Divergence thresholds must be sequentially increasing (Low < Medium < High < Critical)');
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch('/api/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });

      if (!res.ok) throw new Error('Update failed');
      toast.success('System safety policy updated successfully');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to commit safety policies');
    } finally {
      setIsSaving(false);
    }
  };

  const updateThreshold = (level: 'low' | 'medium' | 'high' | 'critical', val: number) => {
    if (!policy) return;
    setPolicy({
      ...policy,
      divergenceThresholds: {
        ...policy.divergenceThresholds,
        [level]: val
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="text-xs text-neutral-500">Retrieving global safety configuration...</span>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="text-center py-20 text-white">
        <span className="text-xs text-neutral-500">Failed to load system policy. Please try again.</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 text-white">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          Global Safety Policy Configuration
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Adjust model response comparison limits, default defense modes, and session trust degradation metrics.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* SECTION 1: DEFAULT DEFENSE MODE */}
        <div className="glass-panel p-6 border border-neutral-850 bg-[#0D1321]/20 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-neutral-200">Default Policy Mode</h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              Select the initial containment strategy for all new user LLM guard sessions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Passive */}
            <label className={`glass-panel p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              policy.defenseModeDefault === 'passive' 
                ? 'border-cyan-500/50 bg-cyan-950/10' 
                : 'border-neutral-850 hover:border-neutral-800'
            }`}>
              <input 
                type="radio" 
                name="defenseModeDefault" 
                value="passive"
                checked={policy.defenseModeDefault === 'passive'}
                onChange={() => setPolicy({ ...policy, defenseModeDefault: 'passive' })}
                className="sr-only"
              />
              <div>
                <span className="text-xs font-bold text-white block mb-1">Passive</span>
                <span className="text-[10px] text-neutral-500 leading-normal block">
                  Log threat divergence levels without modifying, filtering, or intercepting model completions.
                </span>
              </div>
            </label>

            {/* Active */}
            <label className={`glass-panel p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              policy.defenseModeDefault === 'active' 
                ? 'border-cyan-500/50 bg-cyan-950/10' 
                : 'border-neutral-850 hover:border-neutral-800'
            }`}>
              <input 
                type="radio" 
                name="defenseModeDefault" 
                value="active"
                checked={policy.defenseModeDefault === 'active'}
                onChange={() => setPolicy({ ...policy, defenseModeDefault: 'active' })}
                className="sr-only"
              />
              <div>
                <span className="text-xs font-bold text-cyan-400 block mb-1">Active Guard (Default)</span>
                <span className="text-[10px] text-neutral-500 leading-normal block">
                  Automatically sanitize inputs, request clarifications, and quarantine outputs that trigger threat alerts.
                </span>
              </div>
            </label>

            {/* Strict */}
            <label className={`glass-panel p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              policy.defenseModeDefault === 'strict' 
                ? 'border-red-500/30 bg-red-950/10' 
                : 'border-neutral-850 hover:border-neutral-800'
            }`}>
              <input 
                type="radio" 
                name="defenseModeDefault" 
                value="strict"
                checked={policy.defenseModeDefault === 'strict'}
                onChange={() => setPolicy({ ...policy, defenseModeDefault: 'strict' })}
                className="sr-only"
              />
              <div>
                <span className="text-xs font-bold text-red-400 block mb-1">Strict Isolation</span>
                <span className="text-[10px] text-neutral-500 leading-normal block">
                  Immediately terminate and block sessions that present low-level/medium anomalies. Minimal tolerance thresholds.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION 2: DIVERGENCE THRESHOLDS (SLIDERS) */}
        <div className="glass-panel p-6 border border-neutral-850 bg-[#0D1321]/20 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-neutral-200">Threat Divergence Thresholds</h3>
            <p className="text-[11px] text-neutral-500 mt-1">
              Configure score ranges mapping to safety risk classifications (Low, Medium, High, and Critical).
            </p>
          </div>

          <div className="space-y-6">
            {/* Low */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-green-400">Low Threat Boundary</span>
                <span className="font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">{policy.divergenceThresholds.low} / 100</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={policy.divergenceThresholds.low}
                onChange={(e) => updateThreshold('low', Number(e.target.value))}
                className="w-full accent-green-500 bg-neutral-900 h-1 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Medium */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-yellow-400">Medium Threat Boundary</span>
                <span className="font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">{policy.divergenceThresholds.medium} / 100</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={policy.divergenceThresholds.medium}
                onChange={(e) => updateThreshold('medium', Number(e.target.value))}
                className="w-full accent-yellow-500 bg-neutral-900 h-1 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* High */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-orange-400">High Threat Boundary</span>
                <span className="font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">{policy.divergenceThresholds.high} / 100</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={policy.divergenceThresholds.high}
                onChange={(e) => updateThreshold('high', Number(e.target.value))}
                className="w-full accent-orange-500 bg-neutral-900 h-1 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Critical */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-red-500">Critical Threat Boundary</span>
                <span className="font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">{policy.divergenceThresholds.critical} / 100</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={policy.divergenceThresholds.critical}
                onChange={(e) => updateThreshold('critical', Number(e.target.value))}
                className="w-full accent-red-500 bg-neutral-900 h-1 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Action Threshold Map Visual representation */}
          <div className="border border-neutral-850 rounded-lg overflow-hidden bg-neutral-950/20">
            <div className="bg-neutral-950/40 px-4 py-2.5 border-b border-neutral-850 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Boundary Enforcement Map</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-neutral-850 text-xs text-center">
              <div className="p-3.5 space-y-1">
                <span className="text-[10px] text-green-400 font-bold block uppercase">0 - {policy.divergenceThresholds.low}</span>
                <span className="font-semibold text-white flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Allow</span>
              </div>
              <div className="p-3.5 space-y-1">
                <span className="text-[10px] text-yellow-400 font-bold block uppercase">{policy.divergenceThresholds.low} - {policy.divergenceThresholds.medium}</span>
                <span className="font-semibold text-white flex items-center justify-center gap-1"><HelpCircle className="w-3 h-3 text-yellow-500" /> Clarify</span>
              </div>
              <div className="p-3.5 space-y-1">
                <span className="text-[10px] text-orange-400 font-bold block uppercase">{policy.divergenceThresholds.medium} - {policy.divergenceThresholds.high}</span>
                <span className="font-semibold text-white flex items-center justify-center gap-1"><RefreshCw className="w-3 h-3 text-orange-500" /> Sanitize</span>
              </div>
              <div className="p-3.5 space-y-1 bg-red-950/10">
                <span className="text-[10px] text-red-400 font-bold block uppercase">&gt; {policy.divergenceThresholds.high}</span>
                <span className="font-semibold text-red-400 flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Contain</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: SYSTEM METRICS & INFRASTRUCTURE CONFIG */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trust decay config */}
          <div className="glass-panel p-6 border border-neutral-850 bg-[#0D1321]/20 space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Trust Degradation</h3>
              <p className="text-[10px] text-neutral-500 mt-1">
                Percentage deducted from overall session trust rating per anomalous action.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="number"
                min="0"
                max="100"
                value={policy.trustDecay}
                onChange={(e) => setPolicy({ ...policy, trustDecay: Number(e.target.value) })}
                className="w-24 bg-neutral-900 border border-neutral-850 rounded-md py-1.5 px-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
              />
              <span className="text-xs text-neutral-400 font-mono">% Decay / Signal</span>
            </div>
          </div>

          {/* Shadow Routing */}
          <div className="glass-panel p-6 border border-neutral-850 bg-[#0D1321]/20 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Shadow Baseline Routing</h3>
              <p className="text-[10px] text-neutral-500 mt-1">
                Enable concurrent shadow model execution to map divergence baselines.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPolicy({ ...policy, shadowEnabled: !policy.shadowEnabled })}
              className="text-cyan-400 hover:text-cyan-300 transition-colors focus:outline-none cursor-pointer"
            >
              {policy.shadowEnabled ? (
                <ToggleRight className="w-10 h-10" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-neutral-600" />
              )}
            </button>
          </div>
        </div>

        {/* SAVE SUBMIT BUTTON */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={isSaving}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs gap-1.5 px-6 py-2.5 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Configuration...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Policy Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
