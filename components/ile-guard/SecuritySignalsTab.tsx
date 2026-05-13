'use client';

import React from 'react';
import { TrendingUp, Activity, Shield, AlertCircle } from 'lucide-react';

interface SecuritySignalsTabProps {
    analysisResult?: any;
}

export default function SecuritySignalsTab({ analysisResult }: SecuritySignalsTabProps) {
    const hasData = !!analysisResult;
    const divergenceScore = analysisResult?.scores?.total ?? analysisResult?.divergence_score ?? 0;
    const signals = analysisResult?.signals || [];
    const totalLatency = analysisResult?.total_latency_ms ?? 0;
    const action = analysisResult?.action || 'allow';

    const intentDrift = hasData ? Math.min(100, Math.round(divergenceScore * 0.8)) : 0;
    const reasoningMismatch = hasData ? Math.round(divergenceScore) : 0;
    const policyStress = hasData
        ? Math.min(100, Math.round(signals.length * 15 + (divergenceScore > 60 ? 30 : 0)))
        : 0;

    const detectedPatterns = hasData
        ? signals.map((signal: string, idx: number) => ({
            name: signal.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            severity: divergenceScore > 60 ? 'High' : divergenceScore > 30 ? 'Medium' : 'Low',
            firstSeen: 'Just now',
            color: divergenceScore > 60
                ? 'var(--status-danger)'
                : divergenceScore > 30
                    ? 'var(--status-warning)'
                    : 'var(--status-safe)'
        }))
        : [];

    const threatsBlocked = hasData ? (action === 'contain' || action === 'block' ? 1 : 0) : 0;

    const getGaugeColor = (value: number) => {
        if (value < 30) return 'var(--status-safe)';
        if (value < 60) return 'var(--status-warning)';
        return 'var(--status-danger)';
    };

    const MetricCard = ({
        title,
        value,
        icon: Icon,
        trend,
        description
    }: {
        title: string;
        value: number;
        icon: any;
        trend: 'up' | 'down' | 'stable';
        description: string;
    }) => {
        const trendIcons = {
            up: '↑',
            down: '↓',
            stable: '→'
        };

        const trendColors = {
            up: 'var(--status-danger)',
            down: 'var(--status-safe)',
            stable: 'var(--status-neutral)'
        };

        return (
            <div
                className="p-4 rounded-lg"
                style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-medium)'
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Icon size={16} style={{ color: 'var(--accent-cyan)' }} />
                        <h4
                            className="font-medium"
                            style={{
                                fontSize: 'var(--text-sm)',
                                color: 'var(--text-secondary)',
                                fontWeight: 'var(--font-medium)'
                            }}
                        >
                            {title}
                        </h4>
                    </div>
                    <span
                        style={{
                            fontSize: 'var(--text-xs)',
                            color: trendColors[trend],
                            fontWeight: 'var(--font-bold)'
                        }}
                    >
                        {trendIcons[trend]}
                    </span>
                </div>

                {/* Gauge */}
                <div className="mb-3">
                    <div
                        className="text-center mb-2 font-bold"
                        style={{
                            fontSize: 'var(--text-2xl)',
                            color: getGaugeColor(value),
                            fontWeight: 'var(--font-bold)'
                        }}
                    >
                        {hasData ? value : '—'}
                    </div>
                    <div
                        className="w-full h-2 rounded-full overflow-hidden"
                        style={{ background: 'var(--bg-primary)' }}
                    >
                        <div
                            className="h-full transition-all"
                            style={{
                                width: `${value}%`,
                                background: getGaugeColor(value),
                                transition: 'width 800ms ease-out'
                            }}
                        />
                    </div>
                </div>

                <p
                    style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        lineHeight: '1.5'
                    }}
                >
                    {description}
                </p>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Signal Metrics Grid */}
            <div className="grid grid-cols-1 gap-4">
                <MetricCard
                    title="Intent Drift Score"
                    value={intentDrift}
                    icon={TrendingUp}
                    trend={intentDrift > 30 ? 'up' : 'stable'}
                    description="Measures deviation from original user intent across conversation turns"
                />

                <MetricCard
                    title="Reasoning Mismatch"
                    value={reasoningMismatch}
                    icon={Activity}
                    trend={reasoningMismatch > 30 ? 'up' : 'down'}
                    description="Percentage divergence between Primary and Shadow LLM reasoning"
                />

                <MetricCard
                    title="Policy Boundary Stress"
                    value={policyStress}
                    icon={Shield}
                    trend={policyStress > 30 ? 'up' : 'down'}
                    description="Proximity to policy violation thresholds"
                />
            </div>

            {/* Detected Patterns */}
            <div>
                <h3
                    className="font-semibold mb-3"
                    style={{
                        fontSize: 'var(--text-lg)',
                        color: 'var(--text-primary)',
                        fontWeight: 'var(--font-semibold)'
                    }}
                >
                    Detected Patterns
                </h3>

                <div className="space-y-2">
                    {detectedPatterns.length > 0 ? detectedPatterns.map((pattern: any, idx: number) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-subtle)'
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <AlertCircle size={16} style={{ color: pattern.color }} />
                                <div>
                                    <div
                                        className="font-medium"
                                        style={{
                                            fontSize: 'var(--text-sm)',
                                            color: 'var(--text-primary)',
                                            fontWeight: 'var(--font-medium)'
                                        }}
                                    >
                                        {pattern.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 'var(--text-xs)',
                                            color: 'var(--text-muted)'
                                        }}
                                    >
                                        First seen {pattern.firstSeen}
                                    </div>
                                </div>
                            </div>

                            <div
                                className="px-2 py-1 rounded"
                                style={{
                                    background: `color-mix(in oklch, ${pattern.color} 20%, transparent)`,
                                    border: `1px solid ${pattern.color}`,
                                    fontSize: 'var(--text-xs)',
                                    color: pattern.color,
                                    fontWeight: 'var(--font-semibold)'
                                }}
                            >
                                {pattern.severity}
                            </div>
                        </div>
                    )) : (
                        <div
                            className="p-3 rounded-lg text-center"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-subtle)',
                                fontSize: 'var(--text-sm)',
                                color: 'var(--text-muted)'
                            }}
                        >
                            {hasData ? 'No suspicious patterns detected' : 'Submit a prompt to detect patterns'}
                        </div>
                    )}
                </div>
            </div>

            {/* Historical Context */}
            <div
                className="p-4 rounded-lg"
                style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)'
                }}
            >
                <h4
                    className="font-medium mb-2"
                    style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        fontWeight: 'var(--font-medium)'
                    }}
                >
                    Session Summary
                </h4>
                <div className="grid grid-cols-3 gap-4 mt-3">
                    <div className="text-center">
                        <div
                            className="font-bold mb-1"
                            style={{
                                fontSize: 'var(--text-xl)',
                                color: 'var(--status-safe)',
                                fontWeight: 'var(--font-bold)'
                            }}
                        >
                            {signals.length || 0}
                        </div>
                        <div
                            style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-muted)'
                            }}
                        >
                            Signals Found
                        </div>
                    </div>
                    <div className="text-center">
                        <div
                            className="font-bold mb-1"
                            style={{
                                fontSize: 'var(--text-xl)',
                                color: 'var(--status-danger)',
                                fontWeight: 'var(--font-bold)'
                            }}
                        >
                            {threatsBlocked}
                        </div>
                        <div
                            style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-muted)'
                            }}
                        >
                            Threats Blocked
                        </div>
                    </div>
                    <div className="text-center">
                        <div
                            className="font-bold mb-1"
                            style={{
                                fontSize: 'var(--text-xl)',
                                color: 'var(--accent-primary)',
                                fontWeight: 'var(--font-bold)'
                            }}
                        >
                            {hasData ? `${Math.round(totalLatency)}ms` : '—'}
                        </div>
                        <div
                            style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-muted)'
                            }}
                        >
                            Latency
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
