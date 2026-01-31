import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      {/* Hero Section */}
      <section className="py-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-8">
          Now Available for Demo
        </div>
        <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 mb-6 max-w-4xl">
          Secure LLM Agents with Intent-Locked Execution
        </h1>
        <p className="text-xl text-neutral-400 max-w-2xl mb-10 leading-relaxed">
          ShieldLLM introduces a novel defense architecture combining progressive canonicalization, shadow reasoning, and divergence analysis to detect prompt injection attacks in real-time.
        </p>

        <div className="flex gap-4">
          <Link href="/auth/login" className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-cyan-900/20">
            Get Started
          </Link>
          <Link href="/logs" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg font-semibold transition-all">
            View Demo Attacks
          </Link>
          <Link href="#how-it-works" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg font-semibold transition-all">
            View Architecture
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section id="how-it-works" className="py-20 grid md:grid-cols-3 gap-8">
        {[
          { title: "Intent Graph", desc: "Maps user goals to allowed actions. Any deviation triggers immediate suspicion." },
          { title: "Shadow Reasoning", desc: "Runs parallel execution on a sanitized, policy-strict model to cross-verify outputs." },
          { title: "Divergence Analysis", desc: "Compares primary and shadow outputs. High divergence indicates successful manipulation." }
        ].map((f, i) => (
          <div key={i} className="glass-panel p-8 hover:border-cyan-500/30 transition-colors group">
            <h3 className="text-xl font-bold mb-3 group-hover:text-cyan-400 transition-colors">{f.title}</h3>
            <p className="text-neutral-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
