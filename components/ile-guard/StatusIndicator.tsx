import React from 'react';

interface StatusIndicatorProps {
    status: 'protected' | 'analyzing' | 'threat';
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
    const getStatusConfig = () => {
        switch (status) {
            case 'protected':
                return {
                    color: 'var(--status-safe)',
                    text: 'Protected',
                    dotClass: 'status-dot-safe',
                    icon: '🟢'
                };
            case 'analyzing':
                return {
                    color: 'var(--status-warning)',
                    text: 'Analyzing',
                    dotClass: 'status-dot-warning',
                    icon: '🟡'
                };
            case 'threat':
                return {
                    color: 'var(--status-danger)',
                    text: 'Injection Detected',
                    dotClass: 'status-dot-danger',
                    icon: '🔴'
                };
        }
    };

    const config = getStatusConfig();

    return (
        <div className="flex items-center gap-2">
            {/* Animated Status Dot */}
            <div
                className={`rounded-full ${config.dotClass}`}
                style={{
                    width: '8px',
                    height: '8px',
                    background: config.color
                }}
            />

            {/* Status Text */}
            <span
                className="font-semibold"
                style={{
                    fontSize: 'var(--text-sm)',
                    color: config.color,
                    fontWeight: 'var(--font-semibold)'
                }}
            >
                {config.text}
            </span>
        </div>
    );
}
