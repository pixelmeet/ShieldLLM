'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function Dashboard() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [attackCount, setAttackCount] = useState<number>(0);
    const [userVerified, setUserVerified] = useState<boolean | null>(null);
    const [verifiedUser, setVerifiedUser] = useState<{ userId?: string; role?: string } | null>(null);

    // Verify user first, then load dashboard data
    useEffect(() => {
        let cancelled = false;

        const verifyAndLoad = async () => {
            try {
                const verifyRes = await fetch('/api/auth/login', { credentials: 'include', method: 'GET' });
                if (cancelled) return;

                if (verifyRes.status === 401) {
                    window.location.href = '/auth/login';
                    return;
                }

                if (!verifyRes.ok) {
                    setUserVerified(false);
                    return;
                }

                const verifyData = await verifyRes.json().catch(() => ({}));
                if (verifyData.authenticated && verifyData.user) {
                    setVerifiedUser({ userId: verifyData.user.userId, role: verifyData.user.role });
                }
                setUserVerified(true);
            } catch {
                if (!cancelled) setUserVerified(false);
            }
        };

        verifyAndLoad();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (userVerified !== true) return;

        fetch('/api/sessions', { credentials: 'include' })
            .then(res => {
                if (res.status === 401) {
                    window.location.href = '/auth/login';
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setSessions(data);
            });
    }, [userVerified]);

    useEffect(() => {
        if (userVerified !== true) return;

        fetch('/api/logs', { credentials: 'include' })
            .then(res => res.status === 401 ? null : res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const blocked = data.filter((t: any) => t.action !== 'allow' && ['high', 'critical'].includes(t.riskLevel));
                    setAttackCount(blocked.length);
                }
            });
    }, [userVerified]);

    const avgTrust = sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.trustScore ?? 100), 0) / sessions.length) : 0;

    // Verifying user
    if (userVerified === null) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" aria-hidden />
                <p className="text-neutral-400">Verifying user...</p>
            </div>
        );
    }

    // Verification failed
    if (userVerified === false) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <p className="text-red-400">Unable to verify user. Please log in again.</p>
                <Link href="/auth/login" className="text-cyan-400 hover:text-cyan-300 underline">Go to Login</Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-10">
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold">Security Dashboard</h1>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-sm" title={verifiedUser?.role ? `Role: ${verifiedUser.role}` : undefined}>
                        <ShieldCheck className="w-4 h-4" aria-hidden />
                        Verified
                    </span>
                </div>
                <Link href="/sessions/new" className="bg-cyan-600 hover:bg-cyan-500 px-6 py-2 rounded-lg font-semibold transition-colors">
                    + New Secure Session
                </Link>
            </div>

            <div className="grid md:grid-cols-4 gap-6 mb-12">
                {[
                    { label: "Active Sessions", val: sessions.length },
                    { label: "Attacks Blocked", val: attackCount },
                    { label: "Avg Trust Score", val: `${avgTrust}%` },
                    { label: "System Status", val: "Operational", color: "text-green-400" }
                ].map((stat, i) => (
                    <div key={i} className="glass-panel p-6">
                        <div className="text-sm text-neutral-400 mb-1">{stat.label}</div>
                        <div className={`text-2xl font-bold ${stat.color || ''}`}>{stat.val}</div>
                    </div>
                ))}
            </div>

            <h2 className="text-xl font-bold mb-4">Recent Sessions</h2>
            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-xs uppercase text-neutral-400">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Tool Type</th>
                            <th className="px-6 py-4">Defense Mode</th>
                            <th className="px-6 py-4">Trust Score</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-sm">
                        {sessions.map(s => (
                            <tr key={s._id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-mono text-neutral-500">{s._id.substring(0, 8)}...</td>
                                <td className="px-6 py-4">{s.toolType}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs ${s.defenseMode === 'strict' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                        {s.defenseMode}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{Math.round(s.trustScore)}%</td>
                                <td className="px-6 py-4">Active</td>
                                <td className="px-6 py-4 text-right">
                                    <Link href={`/sessions/${s._id}`} className="text-cyan-400 hover:text-cyan-300">View Chat &rarr;</Link>
                                </td>
                            </tr>
                        ))}
                        {sessions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">No active sessions found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
