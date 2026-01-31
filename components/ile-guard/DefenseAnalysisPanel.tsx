'use client';

import React, { useState } from 'react';
import ExecutionPathTab from './ExecutionPathTab';
import DefenseDecisionTab from './DefenseDecisionTab';
import SecuritySignalsTab from './SecuritySignalsTab';

export default function DefenseAnalysisPanel() {
    const [activeTab, setActiveTab] = useState<'execution' | 'decision' | 'signals'>('execution');

    const tabs = [
        { id: 'execution' as const, label: 'Execution Path' },
        { id: 'decision' as const, label: 'Defense Decision' },
        { id: 'signals' as const, label: 'Security Signals' },
    ];

    return (
        <div className="h-full flex flex-col" style={{ padding: 'var(--space-6)' }}>
            {/* Tab Navigation */}
            <div
                className="flex border-b mb-6"
                style={{ borderColor: 'var(--border-subtle)' }}
            >
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="relative px-4 py-3 font-medium transition-all"
                        style={{
                            fontSize: 'var(--text-sm)',
                            color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: 'var(--font-medium)',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none'
                        }}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <div
                                className="absolute bottom-0 left-0 right-0 h-0.5"
                                style={{
                                    background: 'var(--accent-primary)',
                                    transition: 'all var(--transition-base)'
                                }}
                            />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'execution' && <ExecutionPathTab />}
                {activeTab === 'decision' && <DefenseDecisionTab />}
                {activeTab === 'signals' && <SecuritySignalsTab />}
            </div>
        </div>
    );
}
