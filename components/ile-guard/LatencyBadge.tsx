import React from 'react';
import { Zap } from 'lucide-react';

interface LatencyBadgeProps {
    latency: number;
}

export default function LatencyBadge({ latency }: LatencyBadgeProps) {
    const getLatencyColor = () => {
        if (latency < 50) return 'var(--status-safe)';
        if (latency < 150) return 'var(--status-warning)';
        return 'var(--status-danger)';
    };

    const getLatencyBg = () => {
        if (latency < 50) return 'var(--status-safe-dim)';
        if (latency < 150) return 'var(--status-warning-dim)';
        return 'var(--status-danger-dim)';
    };

    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5"
            style={{
                background: getLatencyBg(),
                borderRadius: 'var(--radius-full)',
                border: `1px solid ${getLatencyColor()}`,
                transition: 'all var(--transition-base)'
            }}
        >
            <Zap size={14} color={getLatencyColor()} fill={getLatencyColor()} />
            <span
                className="font-medium tabular-nums"
                style={{
                    fontSize: 'var(--text-sm)',
                    color: getLatencyColor(),
                    fontWeight: 'var(--font-medium)',
                    fontVariantNumeric: 'tabular-nums'
                }}
            >
                {latency}ms
            </span>
        </div>
    );
}
