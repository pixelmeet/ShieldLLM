'use client';

import React from 'react';

interface ExecutionPathTabProps {
    analysisResult?: any;
}

export default function ExecutionPathTab({ analysisResult }: ExecutionPathTabProps) {
    const primaryOutput = analysisResult?.primaryOutput || analysisResult?.final_answer || '';
    const shadowOutput = analysisResult?.shadowOutput || '';
    const divergenceScore = analysisResult?.scores?.total ?? analysisResult?.divergence_score ?? 0;
    const llmLatency = analysisResult?.llm_latency_ms ?? 0;
    const totalLatency = analysisResult?.total_latency_ms ?? 0;
    const hasData = !!analysisResult;

    const getDivergenceColor = () => {
        if (divergenceScore < 30) return 'var(--status-safe)';
        if (divergenceScore < 60) return 'var(--status-warning)';
        return 'var(--status-danger)';
    };

    return (
        <div className="space-y-4">
            {/* Comparison Header */}
            <div
                className="p-3 rounded-lg"
                style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)'
                }}
            >
                <h3
                    className="font-medium"
                    style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        fontWeight: 'var(--font-medium)'
                    }}
                >
                    Dual Inference Comparison
                </h3>
                <p
                    style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        marginTop: 'var(--space-1)'
                    }}
                >
                    {hasData
                        ? 'Live analysis from Primary and Shadow LLMs'
                        : 'Submit a prompt to see real dual-LLM analysis'}
                </p>
            </div>

            {/* Dual Output View */}
            <div className="grid grid-cols-2 gap-4">
                {/* Primary LLM Output */}
                <div
                    className="rounded-lg overflow-hidden"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-medium)'
                    }}
                >
                    <div
                        className="px-4 py-2 border-b"
                        style={{
                            background: 'var(--bg-tertiary)',
                            borderColor: 'var(--border-subtle)'
                        }}
                    >
                        <h4
                            className="font-medium"
                            style={{
                                fontSize: 'var(--text-sm)',
                                color: 'var(--accent-primary)',
                                fontWeight: 'var(--font-semibold)'
                            }}
                        >
                            Primary LLM
                        </h4>
                    </div>
                    <div className="p-4">
                        <pre
                            className="whitespace-pre-wrap"
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-primary)',
                                lineHeight: '1.6'
                            }}
                        >
                            {primaryOutput || 'Awaiting analysis...'}
                        </pre>
                        <div
                            className="mt-4 pt-3 border-t flex items-center justify-between"
                            style={{ borderColor: 'var(--border-subtle)' }}
                        >
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Provider: {analysisResult?.provider || '—'}
                            </span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Latency: {hasData ? `${Math.round(llmLatency)}ms` : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Shadow LLM Output */}
                <div
                    className="rounded-lg overflow-hidden"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-medium)'
                    }}
                >
                    <div
                        className="px-4 py-2 border-b"
                        style={{
                            background: 'var(--bg-tertiary)',
                            borderColor: 'var(--border-subtle)'
                        }}
                    >
                        <h4
                            className="font-medium"
                            style={{
                                fontSize: 'var(--text-sm)',
                                color: 'var(--accent-secondary)',
                                fontWeight: 'var(--font-semibold)'
                            }}
                        >
                            Shadow LLM
                        </h4>
                    </div>
                    <div className="p-4">
                        <pre
                            className="whitespace-pre-wrap"
                            style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-primary)',
                                lineHeight: '1.6'
                            }}
                        >
                            {shadowOutput || (hasData ? 'Shadow not triggered (low ambiguity)' : 'Awaiting analysis...')}
                        </pre>
                        <div
                            className="mt-4 pt-3 border-t flex items-center justify-between"
                            style={{ borderColor: 'var(--border-subtle)' }}
                        >
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Security: {analysisResult?.security_level || '—'}
                            </span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Total: {hasData ? `${Math.round(totalLatency)}ms` : '—'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Divergence Score */}
            <div
                className="p-4 rounded-lg text-center"
                style={{
                    background: `color-mix(in oklch, ${getDivergenceColor()} 10%, transparent)`,
                    border: `2px solid ${getDivergenceColor()}`
                }}
            >
                <div
                    className="font-bold mb-1"
                    style={{
                        fontSize: 'var(--text-3xl)',
                        color: getDivergenceColor(),
                        fontWeight: 'var(--font-bold)'
                    }}
                >
                    {hasData ? `${Math.round(divergenceScore)}%` : '—'}
                </div>
                <div
                    style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        fontWeight: 'var(--font-medium)'
                    }}
                >
                    Divergence Score
                </div>
                <p
                    className="mt-2"
                    style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)'
                    }}
                >
                    {hasData
                        ? (divergenceScore < 30
                            ? 'Low divergence indicates consistent reasoning between models'
                            : divergenceScore < 60
                                ? 'Moderate divergence — shadow reasoning detected discrepancies'
                                : 'High divergence — potential injection or manipulation detected')
                        : 'Submit a prompt to measure divergence'}
                </p>
            </div>
        </div>
    );
}
