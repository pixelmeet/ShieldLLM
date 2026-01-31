'use client';

import React, { useEffect, useRef } from 'react';

export default function IntentGraph() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Demo intent graph data
        const nodes = [
            { id: 'current', label: 'User Query', x: canvas.width / 2, y: canvas.height / 2, type: 'current' },
            { id: 'search', label: 'Search Data', x: canvas.width / 2 - 150, y: canvas.height / 2 - 100, type: 'allowed' },
            { id: 'format', label: 'Format Response', x: canvas.width / 2 + 150, y: canvas.height / 2 - 100, type: 'allowed' },
            { id: 'admin', label: 'Admin Access', x: canvas.width / 2 - 150, y: canvas.height / 2 + 100, type: 'forbidden' },
            { id: 'system', label: 'System Prompt', x: canvas.width / 2 + 150, y: canvas.height / 2 + 100, type: 'forbidden' },
        ];

        const edges = [
            { from: 'current', to: 'search', type: 'allowed' },
            { from: 'current', to: 'format', type: 'allowed' },
            { from: 'current', to: 'admin', type: 'forbidden' },
            { from: 'current', to: 'system', type: 'forbidden' },
        ];

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
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.label, node.x, node.y + (node.type === 'current' ? 60 : 50));
        });

    }, []);

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
