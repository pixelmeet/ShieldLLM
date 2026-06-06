import React from 'react';
import Link from 'next/link';
import { Shield, GitBranch, Terminal, Layers, ArrowRight, ExternalLink } from 'lucide-react';

export default function LandingPage() {
  const demoUrl = process.env.NEXT_PUBLIC_DEMO_URL;

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation Bar */}
      <header className="border-b border-neutral-800 bg-[#0D1321]/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(0,242,254,0.3)]">
              S
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-white leading-none">
                Shield<span className="text-gradient-cyan">LLM</span>
              </span>
              <span className="text-[9px] text-neutral-500 font-medium tracking-wider uppercase mt-0.5">
                Active Defense
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-neutral-800 hover:border-cyan-500/30 hover:text-cyan-400 bg-neutral-900/50 hover:bg-cyan-500/5 transition-all duration-300"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 md:py-32 flex flex-col items-center text-center px-6 cyber-grid border-b border-neutral-800/50">
        {/* Large Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider mb-8">
            <Shield className="w-3.5 h-3.5" /> Now Live in Production
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            Secure LLM Agents with{' '}
            <span className="text-gradient-cyan">Intent-Locked Execution</span>
          </h1>

          <p className="text-base md:text-lg text-neutral-400 max-w-2xl mb-10 leading-relaxed">
            ShieldLLM combines progressive canonicalization, shadow reasoning, and divergence analysis
            to detect prompt injection attacks in real-time.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(0,242,254,0.25)] flex items-center justify-center gap-2 group transition-all duration-300"
            >
              Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold border border-neutral-800 hover:border-cyan-500/30 hover:text-cyan-400 bg-neutral-900/40 hover:bg-cyan-500/5 transition-all duration-300 flex items-center justify-center"
            >
              View Architecture
            </a>

            {demoUrl && (
              <a
                href={demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold border border-cyan-500/20 hover:border-cyan-500/40 hover:text-cyan-300 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all duration-300 flex items-center justify-center gap-1.5"
              >
                View Demo <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 max-w-7xl mx-auto px-6 border-b border-neutral-800/30">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Core Defense Mechanisms</h2>
          <p className="text-sm text-neutral-400 max-w-lg mx-auto">
            Our multi-tiered architecture operates inline with agent execution to prevent system compromise.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-panel p-8 flex flex-col gap-4 border border-neutral-800 hover:border-cyan-500/20 hover:bg-[#0D1321]/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Intent Graph</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Dynamically maps user goals to allowed actions. Constrains agent capability boundaries in real-time, preventing malicious policy override attempts.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel p-8 flex flex-col gap-4 border border-neutral-800 hover:border-cyan-500/20 hover:bg-[#0D1321]/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Shadow Reasoning</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Runs parallel prompt execution on a sanitized baseline LLM model. Creates an unmanipulated baseline output to measure reasoning deltas.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel p-8 flex flex-col gap-4 border border-neutral-800 hover:border-cyan-500/20 hover:bg-[#0D1321]/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Divergence Analysis</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Detects manipulation via semantic comparison and reasoning mismatch score evaluation between the primary and shadow LLM outputs.
            </p>
          </div>
        </div>
      </section>

      {/* Defense Pipeline Step Diagram */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Active Defense Pipeline</h2>
          <p className="text-sm text-neutral-400 max-w-lg mx-auto">
            Every prompt goes through six inline processing steps before execution is approved.
          </p>
        </div>

        <div className="relative">
          {/* Horizontal line for desktop, hidden on mobile */}
          <div className="hidden lg:block absolute top-10 left-[8%] right-[8%] h-[2px] bg-gradient-to-r from-cyan-500/20 via-blue-500/40 to-cyan-500/20 z-0" />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 relative z-10">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#0D1321] border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-sm shadow-[0_0_15px_rgba(0,242,254,0.1)] mb-4">
                01
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Input</h4>
              <p className="text-[11px] text-neutral-500 max-w-[120px]">User text is gathered.</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#0D1321] border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-sm shadow-[0_0_15px_rgba(0,242,254,0.1)] mb-4">
                02
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Canonicalize</h4>
              <p className="text-[11px] text-neutral-500 max-w-[120px]">Unicode and encoding normalization.</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#0D1321] border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-sm shadow-[0_0_15px_rgba(0,242,254,0.1)] mb-4">
                03
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Intent Check</h4>
              <p className="text-[11px] text-neutral-500 max-w-[120px]">Validate against graph goals.</p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#0D1321] border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-sm shadow-[0_0_15px_rgba(0,242,254,0.1)] mb-4">
                04
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Dual LLM</h4>
              <p className="text-[11px] text-neutral-500 max-w-[120px]">Execute primary & shadow paths.</p>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#0D1321] border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-sm shadow-[0_0_15px_rgba(0,242,254,0.1)] mb-4">
                05
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Divergence</h4>
              <p className="text-[11px] text-neutral-500 max-w-[120px]">Score comparison log.</p>
            </div>

            {/* Step 6 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#0D1321] border border-cyan-500/30 flex items-center justify-center font-bold text-cyan-400 text-sm shadow-[0_0_15px_rgba(0,242,254,0.1)] mb-4">
                06
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Action</h4>
              <p className="text-[11px] text-neutral-500 max-w-[120px]">Allow, clarify, or contain execution.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-[#070A10] py-12 mt-12 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} ShieldLLM. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-neutral-300">Privacy Policy</a>
            <a href="#" className="hover:text-neutral-300">Terms of Service</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-300">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
