import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative bg-[#0A0E17] cyber-grid overflow-hidden px-4">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Auth Content Container */}
      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Logo Section */}
        <div className="flex flex-col items-center gap-1.5 mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-white text-xl shadow-[0_0_25px_rgba(0,242,254,0.35)] mb-2">
            S
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Shield<span className="text-gradient-cyan">LLM</span>
          </h1>
          <p className="text-xs text-neutral-400 font-medium tracking-wide uppercase">
            Intent-Locked Execution Engine
          </p>
        </div>

        {/* Children Panel */}
        {children}
      </div>
    </div>
  );
}
