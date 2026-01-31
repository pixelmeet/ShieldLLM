import React from 'react';
import StatusIndicator from './StatusIndicator';
import LatencyBadge from './LatencyBadge';
import { Shield } from 'lucide-react';

interface TopNavigationBarProps {
    status: 'protected' | 'analyzing' | 'threat';
    latency: number;
}

export default function TopNavigationBar({ status, latency }: TopNavigationBarProps) {
    return (
        <nav
            className="sticky top-0 z-50 flex items-center justify-between px-6 border-b"
            style={{
                height: '64px',
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)'
            }}
        >
            {/* Brand Section */}
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center rounded-lg"
                    style={{
                        width: '40px',
                        height: '40px',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
                        boxShadow: '0 0 20px hsla(210, 100%, 60%, 0.3)'
                    }}
                >
                    <Shield size={24} color="white" strokeWidth={2.5} />
                </div>
                <div>
                    <h1
                        className="font-semibold tracking-tight"
                        style={{
                            fontSize: 'var(--text-xl)',
                            color: 'var(--text-primary)',
                            fontWeight: 'var(--font-bold)'
                        }}
                    >
                        ILE Guard
                    </h1>
                    <p
                        style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)'
                        }}
                    >
                        Intent-Locked Execution
                    </p>
                </div>
            </div>

            {/* Status & Metrics */}
            <div className="flex items-center gap-4">
                <StatusIndicator status={status} />
                <LatencyBadge latency={latency} />
            </div>
        </nav>
    );
}
