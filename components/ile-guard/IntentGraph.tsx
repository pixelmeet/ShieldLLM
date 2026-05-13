'use client';

import React, { useEffect, useRef } from 'react';

interface IntentGraphProps {
    graphData?: Record<string, any>;
}

export default function IntentGraph({ graphData }: IntentGraphProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const allowedActions = graphData?.allowed || ['read_code', 'explain_vuln', 'suggest_fix', 'general_chat'];
        const forbiddenActions = graphData?.forbidden || ['override_policy', 'reveal_system', 'rce_attempt', 'obfuscation_attempt'];
        const goal = graphData?.goal || 'User Query';

        // Build nodes dynamically from graph data
        const nodes: { id: string; label: string; x: number; y: number; type: 'current' | 'allowed' | 'forbidden' }[] = [];
        const edges: { from: string; to: string; type: 'allowed' | 'forbidden' }[] = [];

        // Center node
        nodes.push({ id: 'current', label: goal, x: canvas.width / 2, y: canvas.height / 2, type: 'current' });

        // Place allowed nodes on top arc
        const maxDisplay = 4;
        const displayAllowed = allowedActions.slice(0, maxDisplay);
        const displayForbidden = forbiddenActions.slice(0, maxDisplay);

        displayAllowed.forEach((action: string, i: number) => {
            const angle = Math.PI + (Math.PI / (displayAllowed.length + 1)) * (i + 1);
            const radius = Math.min(canvas.width, canvas.height) * 0.35;
            nodes.push({
                id: `allowed-${i}`,
                label: action.replace(/_/g, ' '),
                x: canvas.width / 2 + Math.cos(angle) * radius,
                y: canvas.height / 2 + Math.sin(angle) * radius,
                type: 'allowed'
            });
            edges.push({ from: 'current', to: `allowed-${i}`, type: 'allowed' });
        });

        displayForbidden.forEach((action: string, i: number) => {
            const angle = (Math.PI / (displayForbidden.length + 1)) * (i + 1);
            const radius = Math.min(canvas.width, canvas.height) * 0.35;
            nodes.push({
                id: `forbidden-${i}`,
                label: action.replace(/_/g, ' '),
                x: canvas.width / 2 + Math.cos(angle) * radius,
                y: canvas.height / 2 + Math.sin(angle) * radius,
                type: 'forbidden'
            });
            edges.push({ from: 'current', to: `forbidden-${i}`, type: 'forbidden' });
        });

        // Clear canvas
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary');
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw edges
        edges.forEach(edge => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return;

            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(toNode.x, toNode.y);

            if (edge.type === 'allowed') {
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--status-safe');
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
            } else {
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--status-danger');
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
            }

            ctx.stroke();
            ctx.setLineDash([]);
        });

        // Draw nodes
        nodes.forEach(node => {
            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.type === 'current' ? 40 : 30, 0, Math.PI * 2);

            if (node.type === 'current') {
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary');
                ctx.shadowBlur = 20;
                ctx.shadowColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary');
            } else if (node.type === 'allowed') {
                ctx.fillStyle = 'transparent';
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--status-safe');
                ctx.lineWidth = 2;
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = 'transparent';
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--status-danger');
                ctx.lineWidth = 2;
                ctx.shadowBlur = 0;
            }

            ctx.fill();
            if (node.type !== 'current') {
                ctx.stroke();
            }
            ctx.shadowBlur = 0;

            // Node label
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, node.x, node.y + (node.type === 'current' ? 60 : 50));
        });

    }, [graphData]);

    return (
        <div className="h-full w-full rounded-lg overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ cursor: 'grab' }}
            />
        </div>
    );
}
