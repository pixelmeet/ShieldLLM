'use client';

import { useEffect, useState } from 'react';

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/logs', { credentials: 'include' })
            .then(res => {
                if (res.status === 401) {
                    window.location.href = '/auth/login';
                    return [];
                }
                return res.json();
            })
            .then(data => {
                setLogs(Array.isArray(data) ? data : []);
            });
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-6 py-10">
            <h1 className="text-3xl font-bold mb-8">Attack Logs</h1>

            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-xs uppercase text-neutral-400">
                        <tr>
                            <th className="px-6 py-4">Time</th>
                            <th className="px-6 py-4">User Input</th>
                            <th className="px-6 py-4">Risk Level</th>
                            <th className="px-6 py-4">Action</th>
                            <th className="px-6 py-4">Scores (Drift/Stress/Mismatch)</th>
                            <th className="px-6 py-4">Session</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-sm">
                        {logs.map((log: any) => (
                            <tr key={log._id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 text-neutral-500 whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 max-w-xs truncate" title={log.userText}>
                                    {log.userText}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${log.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                                            log.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                                log.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-green-500/20 text-green-400'
                                        }`}>
                                        {log.riskLevel}
                                    </span>
                                </td>
                                <td className="px-6 py-4 capitalize">{log.action || '-'}</td>
                                <td className="px-6 py-4 font-mono text-xs">
                                    {log.scores?.semanticDrift}/{log.scores?.policyStress}/{log.scores?.reasoningMismatch}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-cyan-400">
                                    {log.sessionId?._id?.substring(0, 8) || log.sessionId?.substring(0, 8)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
