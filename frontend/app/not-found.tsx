import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0E17] text-white flex flex-col items-center justify-center relative px-4 overflow-hidden">
      {/* Cyber Grid Overlay */}
      <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />

      {/* Decorative Blur Backgrounds */}
      <div className="absolute w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[120px] -top-20 -left-20 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] -bottom-20 -right-20 pointer-events-none" />

      {/* Center Containment Panel */}
      <div className="max-w-md w-full glass-panel p-8 text-center border border-red-500/20 relative z-10 space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto text-red-500 animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-bold text-red-400 font-mono tracking-widest uppercase block">
            [ Security Alert ]
          </span>
          <h1 className="text-xl font-black tracking-tight text-white uppercase font-mono">
            Error 404: Access Terminated
          </h1>
          <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
            The page you are trying to visit has been quarantined or does not exist.
          </p>
        </div>

        {/* Console Details */}
        <div className="bg-neutral-950/60 border border-neutral-900 rounded-md p-4 text-left font-mono text-[10px] text-red-400/80 space-y-1.5">
          <div>&gt; HOST_REASON: PATH_RESOLUTION_FAILED</div>
          <div>&gt; STATUS_CODE: 0x404_NOT_FOUND</div>
          <div>&gt; SYSTEM_ACTION: CONFLICTING_ROUTE_CONTAINED</div>
          <div>&gt; SAFE_TERMINATE: ENABLED</div>
        </div>

        <div className="pt-2">
          <Link href="/">
            <Button className="w-full bg-gradient-to-r from-red-600/80 to-red-700/80 hover:from-red-500 hover:to-red-600 text-white font-semibold text-xs gap-1.5 py-2 border border-red-500/30 cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Secure Perimeter
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

