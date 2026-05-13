'use client';

import React from 'react';
import { ShieldCheck, Search, BarChart3, Brain, AlertTriangle, ShieldX } from 'lucide-react';

interface DefenseDecisionTabProps {
    analysisResult?: any;
}

export default function DefenseDecisionTab({ analysisResult }: DefenseDecisionTabProps) {
    const hasData = !!analysisResult;
    const decision = hasData ? (analysisResult.action || 'allow').toUpperCase() : 'ALLOW';
    const divergenceScore = analysisResult?.scores?.total ?? analysisResult?.divergence_score ?? 0;
    const confidence = hasData ? Math.max(0, Math.min(100, 100 - divergenceScore)) : 0;
    const signals = analysisResult?.signals || [];
    const riskLevel = analysisResult?.riskLevel || 'low';

    const reasoningPoints = hasData
        ? [
            {
                icon: Search,
                text: signals.length > 0
                    ? `Detected patterns: ${signals.slice(0, 3).join(', ')}`
                    : 'No suspicious patterns detected in user prompt',
                type: 'pattern'
            },
            {
                icon: BarChart3,
                text: `Divergence score: ${Math.round(divergenceScore)}% (${divergenceScore < 30 ? 'normal' : divergenceScore < 60 ? 'elevated' : 'critical'} range)`,
                type: 'statistical'
            },
            {
                icon: Brain,
                text: analysisResult.shadowOutput
                    ? `Primary and Shadow LLM outputs analyzed (divergence: ${Math.round(divergenceScore)}%)`
                    : 'Shadow LLM not triggered — primary assessment sufficient',
                type: 'intent'
            },
            {
                icon: ShieldCheck,
                text: riskLevel === 'low'
                    ? 'No policy boundary violations detected'
                    : `Policy stress detected — risk level: ${riskLevel}`,
                type: 'policy'
            }
        ]
        : [
            { icon: Search, text: 'Submit a prompt to see pattern analysis', type: 'pattern' },
            { icon: BarChart3, text: 'Awaiting divergence measurement', type: 'statistical' },
            { icon: Brain, text: 'Dual-LLM reasoning comparison pending', type: 'intent' },
            { icon: ShieldCheck, text: 'Policy boundary check pending', type: 'policy' }
        ];

    const getDecisionConfig = () => {
        switch (decision) {
            case 'ALLOW':
                return {
                    color: 'var(--status-safe)',
                    bg: 'var(--status-safe-dim)',
                    icon: ShieldCheck,
                    label: 'ALLOW'
                };
            case 'CLARIFY':
                return {
                    color: 'var(--status-warning)',
                    bg: 'var(--status-warning-dim)',
                    icon: AlertTriangle,
                    label: 'CLARIFY'
                };
            case 'SANITIZE':
            case 'SANITIZE_RERUN':
                return {
                    color: 'var(--status-warning)',
                    bg: 'var(--status-warning-dim)',
                    icon: AlertTriangle,
                    label: 'SANITIZE'
                };
            case 'BLOCK':
            case 'CONTAIN':
                return {
                    color: 'var(--status-danger)',
                    bg: 'var(--status-danger-dim)',
                    icon: ShieldX,
                    label: decision
                };
            default:
                return {
                    color: 'var(--status-neutral)',
                    bg: 'var(--status-neutral-dim)',
                    icon: ShieldCheck,
                    label: hasData ? decision : 'PENDING'
                };
        }
    };

    const config = getDecisionConfig();
    const DecisionIcon = config.icon;

    const getActionDescription = () => {
        switch (decision) {
            case 'ALLOW':
                return 'Request processed normally. Response generated and delivered to user without modifications.';
            case 'CLARIFY':
                return 'Ambiguous intent detected. User may be prompted for clarification before proceeding.';
            case 'SANITIZE':
            case 'SANITIZE_RERUN':
                return 'Suspicious content detected and sanitized. Response regenerated with cleaned input.';
            case 'CONTAIN':
                return 'High-risk injection detected. Response blocked and replaced with safe containment message.';
            case 'BLOCK':
                return 'Critical threat detected. Request fully blocked by safety filters.';
            default:
                return hasData ? `Action taken: ${decision}` : 'Submit a prompt to see defense decisions.';
        }
    };

    return (
        <div className="space-y-6">
            {/* Decision Badge */}
            <div
                className="p-6 rounded-lg text-center"
                style={{
                    background: config.bg,
                    border: `2px solid ${config.color}`,
                    boxShadow: `0 0 30px ${config.color}40`
                }}
            >
                <DecisionIcon
                    size={48}
                    style={{
                        color: config.color,
                        margin: '0 auto var(--space-3)'
                    }}
                />
                <div
                    className="font-bold mb-2"
                    style={{
                        fontSize: 'var(--text-3xl)',
                        color: config.color,
                        fontWeight: 'var(--font-bold)',
                        letterSpacing: '0.05em'
                    }}
                >
                    {config.label}
                </div>

                {/* Confidence Score */}
                <div className="mt-4">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <span
                            style={{
                                fontSize: 'var(--text-sm)',
                                color: 'var(--text-secondary)',
                                fontWeight: 'var(--font-medium)'
                            }}
                        >
                            Confidence
                        </span>
                        <div
                            className="font-bold"
                            style={{
                                fontSize: 'var(--text-2xl)',
                                color: config.color,
                                fontWeight: 'var(--font-bold)'
                            }}
                        >
                            {hasData ? confidence : '—'}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                        className="w-full h-2 rounded-full overflow-hidden"
                        style={{ background: 'var(--bg-primary)' }}
                    >
                        <div
                            className="h-full transition-all"
                            style={{
                                width: `${hasData ? confidence : 0}%`,
                                background: config.color,
                                transition: 'width 800ms ease-out'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Reasoning Section */}
            <div>
                <h3
                    className="font-semibold mb-4"
                    style={{
                        fontSize: 'var(--text-lg)',
                        color: 'var(--text-primary)',
                        fontWeight: 'var(--font-semibold)'
                    }}
                >
                    Why this decision?
                </h3>

                <div className="space-y-3">
                    {reasoningPoints.map((point, idx) => {
                        const PointIcon = point.icon;
                        return (
                            <div
                                key={idx}
                                className="flex items-start gap-3 p-3 rounded-lg"
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-subtle)'
                                }}
                            >
                                <div
                                    className="flex-shrink-0 p-2 rounded"
                                    style={{
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--accent-cyan)'
                                    }}
                                >
                                    <PointIcon size={16} />
                                </div>
                                <p
                                    style={{
                                        fontSize: 'var(--text-sm)',
                                        color: 'var(--text-primary)',
                                        lineHeight: '1.6',
                                        flex: 1
                                    }}
                                >
                                    {point.text}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Action Taken */}
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
                    Action Taken
                </h4>
                <p
                    style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        lineHeight: '1.6'
                    }}
                >
                    {getActionDescription()}
                </p>
            </div>
        </div>
    );
}
