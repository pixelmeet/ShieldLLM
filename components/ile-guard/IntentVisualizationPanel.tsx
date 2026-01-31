'use client';

import React, { useState } from 'react';
import IntentGraph from './IntentGraph';
import { GitBranch, Clock } from 'lucide-react';

export default function IntentVisualizationPanel() {
    const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('graph');

    return (
        <div className="h-full flex flex-col" style={{ padding: 'var(--space-6)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2
                    className="font-semibold"
                    style={{
                        fontSize: 'var(--text-xl)',
                        color: 'var(--text-primary)',
                        fontWeight: 'var(--font-semibold)'
                    }}
                >
                    Intent Graph
                </h2>

                {/* View Toggle */}
                <div
                    className="flex rounded-lg overflow-hidden"
                    style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)'
                    }}
                >
                    <button
                        onClick={() => setViewMode('graph')}
                        className="flex items-center gap-2 px-3 py-1.5 transition-all"
                        style={{
                            background: viewMode === 'graph' ? 'var(--accent-primary)' : 'transparent',
                            color: viewMode === 'graph' ? 'white' : 'var(--text-secondary)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            cursor: 'pointer',
                            border: 'none'
                        }}
                    >
                        <GitBranch size={14} />
                        Graph
                    </button>
                    <button
                        onClick={() => setViewMode('timeline')}
                        className="flex items-center gap-2 px-3 py-1.5 transition-all"
                        style={{
                            background: viewMode === 'timeline' ? 'var(--accent-primary)' : 'transparent',
                            color: viewMode === 'timeline' ? 'white' : 'var(--text-secondary)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            cursor: 'pointer',
                            border: 'none'
                        }}
                    >
                        <Clock size={14} />
                        Timeline
                    </button>
                </div>
            </div>

            {/* Visualization Area */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'graph' ? (
                    <IntentGraph />
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            Timeline view coming soon
                        </p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div
                className="mt-4 p-4 rounded-lg"
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)'
                }}
            >
                <h3
                    className="font-medium mb-3"
                    style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        fontWeight: 'var(--font-medium)'
                    }}
                >
                    Legend
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: 'var(--accent-primary)', boxShadow: '0 0 10px var(--accent-primary)' }}
                        />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            Current Intent
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: 'var(--status-safe)', border: '2px solid var(--status-safe)' }}
                        />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            Allowed Action
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: 'transparent', border: '2px dashed var(--status-danger)' }}
                        />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            Forbidden Action
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-0.5" style={{ background: 'var(--status-safe)' }} />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            Allowed Transition
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
