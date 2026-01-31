'use client';

import { useState } from 'react';
import TopNavigationBar from '@/components/ile-guard/TopNavigationBar';
import UserInteractionPanel from '@/components/ile-guard/UserInteractionPanel';
import IntentVisualizationPanel from '@/components/ile-guard/IntentVisualizationPanel';
import DefenseAnalysisPanel from '@/components/ile-guard/DefenseAnalysisPanel';

export default function ILEGuardDashboard() {
    const [protectionStatus, setProtectionStatus] = useState<'protected' | 'analyzing' | 'threat'>('protected');
    const [latency, setLatency] = useState(42);
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [conversationHistory, setConversationHistory] = useState<any[]>([]);

    const handleSubmitPrompt = async (prompt: string) => {
        setProtectionStatus('analyzing');
        setCurrentPrompt(prompt);

        // TODO: Integrate with defense service API
        // For now, simulate analysis
        setTimeout(() => {
            setProtectionStatus('protected');
            setLatency(Math.floor(Math.random() * 100) + 20);
        }, 1500);
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Top Navigation */}
            <TopNavigationBar
                status={protectionStatus}
                latency={latency}
            />

            {/* Main Dashboard - Three Panel Layout */}
            <main className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
                {/* Left Panel - User Interaction (30%) */}
                <div
                    className="border-r overflow-y-auto"
                    style={{
                        width: '30%',
                        minWidth: '400px',
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-primary)'
                    }}
                >
                    <UserInteractionPanel
                        onSubmitPrompt={handleSubmitPrompt}
                        conversationHistory={conversationHistory}
                    />
                </div>

                {/* Center Panel - Intent Visualization (40%) */}
                <div
                    className="border-r overflow-y-auto"
                    style={{
                        width: '40%',
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-primary)'
                    }}
                >
                    <IntentVisualizationPanel />
                </div>

                {/* Right Panel - Defense Analysis (30%) */}
                <div
                    className="overflow-y-auto"
                    style={{
                        width: '30%',
                        minWidth: '400px',
                        background: 'var(--bg-primary)'
                    }}
                >
                    <DefenseAnalysisPanel />
                </div>
            </main>
        </div>
    );
}
