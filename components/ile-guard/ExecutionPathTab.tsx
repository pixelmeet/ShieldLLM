'use client';

import React from 'react';

export default function ExecutionPathTab() {
    // Demo data
    const primaryOutput = `Based on your query, I can provide information about the weather. To give you accurate details, I would need to know your location. 

Weather services typically provide:
- Current temperature
- Precipitation forecast
- Wind conditions
- Humidity levels

Would you like to share your location?`;

    const shadowOutput = `I can help you with weather information. However, I need your location to provide accurate data.

Available weather metrics:
- Temperature readings
- Forecast predictions
- Wind speed and direction
- Atmospheric conditions

Please provide your location for specific details.`;

    const divergenceScore = 23;

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
                    Primary and Shadow LLM outputs analyzed for divergence
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
                            {primaryOutput}
                        </pre>
                        <div
                            className="mt-4 pt-3 border-t flex items-center justify-between"
                            style={{ borderColor: 'var(--border-subtle)' }}
                        >
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Tokens: 87
                            </span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Latency: 42ms
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
                            {shadowOutput}
                        </pre>
                        <div
                            className="mt-4 pt-3 border-t flex items-center justify-between"
                            style={{ borderColor: 'var(--border-subtle)' }}
                        >
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Tokens: 72
                            </span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Latency: 38ms
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
                    {divergenceScore}%
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
                    Low divergence indicates consistent reasoning between models
                </p>
            </div>
        </div>
    );
}
