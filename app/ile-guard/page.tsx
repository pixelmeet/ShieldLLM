'use client';

import { useState } from 'react';
import TopNavigationBar from '@/components/ile-guard/TopNavigationBar';
import UserInteractionPanel from '@/components/ile-guard/UserInteractionPanel';
import IntentVisualizationPanel from '@/components/ile-guard/IntentVisualizationPanel';
import DefenseAnalysisPanel from '@/components/ile-guard/DefenseAnalysisPanel';

export default function ILEGuardDashboard() {
    const [protectionStatus, setProtectionStatus] = useState<'protected' | 'analyzing' | 'threat'>('protected');
    const [latency, setLatency] = useState(0);
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [conversationHistory, setConversationHistory] = useState<any[]>([]);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [intentGraph, setIntentGraph] = useState<Record<string, any>>({});

    const handleSubmitPrompt = async (prompt: string) => {
        setProtectionStatus('analyzing');
        setCurrentPrompt(prompt);

        try {
            const res = await fetch('/api/defense/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userText: prompt,
                    intentGraph,
                    defenseMode: 'active',
                    policy: {},
                    modelType: 'groq',
                    sessionId: 'ile-guard-demo',
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || errData.error || `API error ${res.status}`);
            }

            const data = await res.json();

            setAnalysisResult(data);
            setIntentGraph(data.updatedGraph || intentGraph);
            setLatency(Math.round(data.total_latency_ms || 0));

            const riskLevel = data.riskLevel || 'low';
            setProtectionStatus(['high', 'critical'].includes(riskLevel) ? 'threat' : 'protected');

            setConversationHistory(prev => [
                ...prev,
                {
                    id: Date.now(),
                    type: 'user',
                    text: prompt,
                    threats: [],
                    timestamp: new Date(),
                },
                {
                    id: Date.now() + 1,
                    type: 'system',
                    text: data.primaryOutput || data.final_answer || 'No response generated.',
                    decision: (data.action || 'allow').toUpperCase(),
                    timestamp: new Date(),
                },
            ]);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setProtectionStatus('protected');

            setConversationHistory(prev => [
                ...prev,
                {
                    id: Date.now(),
                    type: 'user',
                    text: prompt,
                    threats: [],
                    timestamp: new Date(),
                },
                {
                    id: Date.now() + 1,
                    type: 'system',
                    text: `Error: ${message}`,
                    decision: 'ERROR',
                    timestamp: new Date(),
                },
            ]);
        }
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
                    <IntentVisualizationPanel graphData={intentGraph} />
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
                    <DefenseAnalysisPanel analysisResult={analysisResult} />
                </div>
            </main>
        </div>
    );
}
