'use client';

export default function AdminConfig() {
    return (
        <div className="max-w-4xl mx-auto px-6 py-10">
            <h1 className="text-3xl font-bold mb-8">System Configuration</h1>

            <div className="glass-panel p-8 opacity-70">
                <div className="flex items-center gap-4 mb-6 text-yellow-500 bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <div className="font-bold">Admin Access Only</div>
                </div>

                <p className="mb-6">Global policy thresholds and trust decay rates can be configured here. (Read-only for demo)</p>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Divergence Thresholds (Critical)</label>
                        <input type="range" className="w-full" value="85" disabled />
                        <div className="flex justify-between text-xs text-neutral-500 mt-1">
                            <span>Low</span>
                            <span>85/100</span>
                            <span>High</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Shadow Reasoning</label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                                <input type="radio" checked disabled /> Enabled
                            </label>
                            <label className="flex items-center gap-2 opacity-50">
                                <input type="radio" disabled /> Disabled
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
