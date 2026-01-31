export default function AlertModal({ data, onClose }: { data: any, onClose: () => void }) {
    if (!data) return null;

    // Support passing full turn data or just defense packet
    const defense = data.defense || {};
    const turn = data.turn || {};
    const scores = defense.scores || turn.scores || {};
    const signals = defense.signals || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-2xl overflow-hidden shadow-2xl shadow-red-900/20 border-red-500/30">
                <div className="bg-red-500/10 p-6 border-b border-red-500/20 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Security Intervention: {defense.action?.toUpperCase()}
                    </h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white">&times;</button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="text-xs uppercase text-neutral-500 font-bold tracking-wider">Detection Scores</div>
                            <div className="space-y-1">
                                <ScoreBar label="Semantic Drift" val={scores.semanticDrift} />
                                <ScoreBar label="Policy Stress" val={scores.policyStress} />
                                <ScoreBar label="Reasoning Mismatch" val={scores.reasoningMismatch} />
                                <div className="pt-2 mt-2 border-t border-white/10 flex justify-between text-lg font-bold">
                                    <span>Total Risk</span>
                                    <span className={scores.total > 70 ? 'text-red-500' : 'text-yellow-500'}>{scores.total}/100</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs uppercase text-neutral-500 font-bold tracking-wider mb-2">Primary vs Shadow</div>
                                <div className="text-xs space-y-2">
                                    <div className="p-3 bg-red-950/20 rounded border border-red-500/20">
                                        <div className="text-red-400 font-bold mb-1">Primary (Unsafe)</div>
                                        <p className="opacity-70 line-clamp-3">{defense.primaryOutput || "..."}</p>
                                    </div>
                                    <div className="p-3 bg-green-950/20 rounded border border-green-500/20">
                                        <div className="text-green-400 font-bold mb-1">Shadow (Safe)</div>
                                        <p className="opacity-70 line-clamp-3">{defense.shadowOutput || "..."}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {signals.length > 0 && (
                        <div>
                            <div className="text-xs uppercase text-neutral-500 font-bold tracking-wider mb-2">Canonicalization Signals</div>
                            <div className="flex flex-wrap gap-2">
                                {signals.map((s: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs font-mono border border-white/10">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                        Dismiss Analysis
                    </button>
                </div>
            </div>
        </div>
    );
}

function ScoreBar({ label, val }: { label: string, val: number }) {
    return (
        <div className="flex items-center gap-4 text-sm">
            <span className="w-32 truncate opacity-70">{label}</span>
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full ${val > 70 ? 'bg-red-500' : val > 30 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(val, 100)}%` }}
                />
            </div>
            <span className="w-8 text-right font-mono text-xs">{val}</span>
        </div>
    );
}
