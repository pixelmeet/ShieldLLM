'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewSession() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        toolType: 'code_review',
        modelType: 'simulated',
        defenseMode: 'active'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/sessions', {
                method: 'POST',
                body: JSON.stringify(form)
            });

            if (res.ok) {
                const session = await res.json();
                router.push(`/sessions/${session._id}`);
            } else {
                alert('Failed to create session');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-6 py-10">
            <h1 className="text-3xl font-bold mb-8">Start New Secure Session</h1>

            <div className="glass-panel p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">Primary Goal</label>
                        <div className="grid grid-cols-3 gap-4">
                            {['code_review', 'policy_enforcement', 'compliance'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setForm({ ...form, toolType: t })}
                                    className={`p-4 rounded-lg border text-left transition-all ${form.toolType === t
                                            ? 'bg-cyan-500/10 border-cyan-500 text-white'
                                            : 'bg-neutral-950 border-white/10 text-neutral-400 hover:border-white/30'
                                        }`}
                                >
                                    <span className="block font-bold capitalize mb-1">{t.replace('_', ' ')}</span>
                                    <span className="text-xs opacity-70">Strict adherence to {t} tasks.</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">Model Backend</label>
                            <select
                                value={form.modelType}
                                onChange={e => setForm({ ...form, modelType: e.target.value })}
                                className="w-full bg-neutral-950 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500"
                            >
                                <option value="openai">OpenAI (GPT-4o-mini + GPT-3.5-turbo)</option>
                                <option value="huggingface">Hugging Face (Phi-3-mini)</option>
                                <option value="huggingface_phi3">Hugging Face (Phi-3-mini, same)</option>
                                <option value="simulated">Simulated (Demo, no API)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">Defense Mode</label>
                            <select
                                value={form.defenseMode}
                                onChange={e => setForm({ ...form, defenseMode: e.target.value })}
                                className="w-full bg-neutral-950 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500"
                            >
                                <option value="passive">Passive (Monitor Only)</option>
                                <option value="active">Active (Block Anomalies)</option>
                                <option value="strict">Strict (Zero Tolerance)</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            disabled={loading}
                            className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-bold transition-colors"
                        >
                            {loading ? 'Creating Environment...' : 'Launch Session'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
