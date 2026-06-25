'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
    Activity, Shield, Cpu, Radio, Upload, Trash2, FolderMinus,
    Send, ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle,
    Loader2, Copy, Check, Zap, Server, Eye
} from 'lucide-react';

/* ── types ── */
interface Endpoint {
    id: string;
    method: 'GET' | 'POST' | 'DELETE';
    path: string;
    label: string;
    description: string;
    category: string;
    icon: React.ReactNode;
    bodyTemplate?: Record<string, unknown>;
    headers?: Record<string, string>;
    requiresAuth?: boolean;
}

interface ApiResponse {
    status: number;
    data: unknown;
    latency: number;
    ok: boolean;
    timestamp: Date;
}

/* ── endpoint definitions ── */
const ENDPOINTS: Endpoint[] = [
    // Defense Service
    {
        id: 'defense-health', method: 'GET', path: '/api/defense/llm-status',
        label: 'Defense Health', description: 'Check if defense service & LLM backends are running',
        category: 'Defense Service', icon: <Shield className="w-4 h-4" />,
    },
    {
        id: 'defense-analyze', method: 'POST', path: '/api/defense/analyze',
        label: 'Analyze Prompt', description: 'Run full ILE pipeline on a prompt (canonicalize → intent graph → dual LLM → divergence)',
        category: 'Defense Service', icon: <Zap className="w-4 h-4" />,
        bodyTemplate: {
            userText: 'Can you analyze this code for SQL injection?',
            intentGraph: { goal: 'code_review', allowed: ['read_code', 'explain_vuln'], forbidden: ['override_policy'], history: [] },
            defenseMode: 'active',
            policy: { divergenceThresholds: { low: 10, medium: 30, high: 60, critical: 85 } },
            modelType: 'groq',
            sessionId: 'api-console-demo',
        },
    },
    // Metrics & Monitoring
    {
        id: 'metrics', method: 'GET', path: '/api/metrics',
        label: 'Defense Metrics', description: 'Aggregated attack stats, false positive rate, latency, and attack type breakdown',
        category: 'Monitoring', icon: <Activity className="w-4 h-4" />,
    },
    {
        id: 'stream', method: 'GET', path: '/api/stream',
        label: 'Alert Stream (SSE)', description: 'Server-Sent Events stream for real-time security alerts',
        category: 'Monitoring', icon: <Radio className="w-4 h-4" />,
    },
    // Sessions
    {
        id: 'sessions-list', method: 'GET', path: '/api/sessions',
        label: 'List Sessions', description: 'Get all sessions for the authenticated user',
        category: 'Sessions', icon: <Server className="w-4 h-4" />, requiresAuth: true,
    },
    {
        id: 'sessions-create', method: 'POST', path: '/api/sessions',
        label: 'Create Session', description: 'Create a new secure analysis session',
        category: 'Sessions', icon: <Server className="w-4 h-4" />, requiresAuth: true,
        bodyTemplate: { toolType: 'code_review', defenseMode: 'active', modelType: 'groq' },
    },
    // Logs
    {
        id: 'logs', method: 'GET', path: '/api/logs',
        label: 'Attack Logs', description: 'Fetch recent turn logs with risk levels and divergence scores',
        category: 'Logs', icon: <Eye className="w-4 h-4" />, requiresAuth: true,
    },
    // AI
    {
        id: 'ai-generate', method: 'POST', path: '/api/ai/generate',
        label: 'Generate Image', description: 'Generate an image via Pollinations API from a text prompt',
        category: 'AI', icon: <Cpu className="w-4 h-4" />,
        bodyTemplate: { prompt: 'cyberpunk shield protecting a neural network', style: 'Digital Art', aspectRatio: '16:9' },
    },
    // Files
    {
        id: 'file-upload', method: 'POST', path: '/api/files/upload',
        label: 'Upload File', description: 'Upload a file to Cloudinary (multipart/form-data)',
        category: 'Files', icon: <Upload className="w-4 h-4" />,
    },
    {
        id: 'file-delete', method: 'POST', path: '/api/files/delete',
        label: 'Delete File', description: 'Delete a file from Cloudinary by public ID',
        category: 'Files', icon: <Trash2 className="w-4 h-4" />,
        bodyTemplate: { publicId: 'uploads/example_file' },
    },
    {
        id: 'folder-delete', method: 'POST', path: '/api/files/delete-folder',
        label: 'Delete Folder', description: 'Delete an entire Cloudinary folder and its contents',
        category: 'Files', icon: <FolderMinus className="w-4 h-4" />,
        bodyTemplate: { folder: 'uploads' },
    },
];

const METHOD_COLORS: Record<string, string> = {
    GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const CATEGORY_COLORS: Record<string, string> = {
    'Defense Service': 'from-cyan-500/20 to-blue-500/20 border-cyan-500/20',
    'Monitoring': 'from-violet-500/20 to-purple-500/20 border-violet-500/20',
    'Sessions': 'from-amber-500/20 to-orange-500/20 border-amber-500/20',
    'Logs': 'from-rose-500/20 to-pink-500/20 border-rose-500/20',
    'AI': 'from-green-500/20 to-emerald-500/20 border-green-500/20',
    'Files': 'from-sky-500/20 to-indigo-500/20 border-sky-500/20',
};

/* ── components ── */
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
            title="Copy"
        >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
}

function EndpointCard({ ep, onRun }: { ep: Endpoint; onRun: (ep: Endpoint, body?: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const [body, setBody] = useState(ep.bodyTemplate ? JSON.stringify(ep.bodyTemplate, null, 2) : '');

    return (
        <div className="group glass-panel overflow-hidden transition-all duration-300 hover:border-cyan-500/30">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 p-4 text-left"
            >
                <span className={`shrink-0 px-2.5 py-1 rounded text-[11px] font-bold tracking-wider border ${METHOD_COLORS[ep.method]}`}>
                    {ep.method}
                </span>
                <span className="flex items-center gap-2 text-neutral-300 shrink-0">{ep.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-white truncate">{ep.label}</div>
                    <div className="text-xs text-neutral-500 font-mono truncate">{ep.path}</div>
                </div>
                {ep.requiresAuth && (
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">AUTH</span>
                )}
                {expanded ? <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />}
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <p className="text-xs text-neutral-400 leading-relaxed">{ep.description}</p>

                    {ep.bodyTemplate && ep.id !== 'file-upload' && (
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1 block">Request Body</label>
                            <textarea
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                rows={Math.min(Object.keys(ep.bodyTemplate).length + 4, 12)}
                                className="w-full bg-neutral-900/80 border border-white/10 rounded-lg p-3 text-xs font-mono text-neutral-300 focus:outline-none focus:border-cyan-500/50 resize-y"
                                spellCheck={false}
                            />
                        </div>
                    )}

                    {ep.id === 'file-upload' && (
                        <p className="text-xs text-neutral-500 italic">File upload requires multipart/form-data. Use the dashboard or a tool like Postman.</p>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={() => onRun(ep, body)}
                            disabled={ep.id === 'file-upload'}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                            <Send className="w-3.5 h-3.5" /> Execute
                        </button>
                        <CopyButton text={`fetch('${ep.path}'${ep.method === 'GET' ? '' : `, { method: '${ep.method}', headers: {'Content-Type':'application/json'}, body: ${body ? `JSON.stringify(${body})` : "'{}'"} }`})`} />
                    </div>
                </div>
            )}
        </div>
    );
}

function ResponsePanel({ response, loading }: { response: ApiResponse | null; loading: boolean }) {
    if (loading) {
        return (
            <div className="glass-panel p-8 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                <span className="text-sm text-neutral-400">Executing request...</span>
            </div>
        );
    }
    if (!response) {
        return (
            <div className="glass-panel p-8 text-center">
                <Server className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                <p className="text-neutral-500 text-sm">Select an endpoint and click Execute to see the response here.</p>
            </div>
        );
    }

    const statusColor = response.ok ? 'text-green-400' : 'text-red-400';
    const StatusIcon = response.ok ? CheckCircle2 : XCircle;

    return (
        <div className="glass-panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                    <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                    <span className={`font-bold text-lg ${statusColor}`}>{response.status}</span>
                    <span className="text-xs text-neutral-500">{response.ok ? 'OK' : 'Error'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-neutral-400">
                        <Clock className="w-3.5 h-3.5" /> {response.latency}ms
                    </span>
                    <CopyButton text={JSON.stringify(response.data, null, 2)} />
                </div>
            </div>
            <pre className="p-4 text-xs font-mono text-neutral-300 overflow-auto max-h-[500px] leading-relaxed whitespace-pre-wrap break-words">
                {JSON.stringify(response.data, null, 2)}
            </pre>
        </div>
    );
}

/* ── main page ── */
export default function ApiConsolePage() {
    const [response, setResponse] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const responseRef = useRef<HTMLDivElement>(null);

    const categories = [...new Set(ENDPOINTS.map(e => e.category))];

    const filteredEndpoints = ENDPOINTS.filter(ep => {
        const matchesCategory = !activeCategory || ep.category === activeCategory;
        const matchesSearch = !searchQuery ||
            ep.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ep.method.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleRun = async (ep: Endpoint, body?: string) => {
        setLoading(true);
        setResponse(null);
        const start = performance.now();

        try {
            const opts: RequestInit = {
                method: ep.method,
                credentials: 'include',
                headers: ep.method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
            };
            if (ep.method !== 'GET' && body) {
                opts.body = body;
            }

            // SSE special handling
            if (ep.id === 'stream') {
                const res = await fetch(ep.path, { credentials: 'include' });
                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                let text = '';
                if (reader) {
                    const timeout = setTimeout(() => reader.cancel(), 5000);
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            text += decoder.decode(value, { stream: true });
                        }
                    } catch { /* reader cancelled */ }
                    clearTimeout(timeout);
                }
                setResponse({
                    status: res.status,
                    data: { type: 'SSE Stream', captured: text || '(no events in 5s)', note: 'Stream was read for 5 seconds then closed.' },
                    latency: Math.round(performance.now() - start),
                    ok: res.ok,
                    timestamp: new Date(),
                });
                setLoading(false);
                return;
            }

            const res = await fetch(ep.path, opts);
            const latency = Math.round(performance.now() - start);
            let data: unknown;
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                data = await res.json();
            } else {
                data = { rawText: await res.text() };
            }
            setResponse({ status: res.status, data, latency, ok: res.ok, timestamp: new Date() });
        } catch (err) {
            setResponse({
                status: 0,
                data: { error: 'Network Error', message: err instanceof Error ? err.message : String(err) },
                latency: Math.round(performance.now() - start),
                ok: false,
                timestamp: new Date(),
            });
        }
        setLoading(false);
        setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-10">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 to-violet-600 rounded-xl flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">API Console</h1>
                        <p className="text-sm text-neutral-500">Interactive endpoint explorer for ShieldLLM</p>
                    </div>
                </div>
            </div>

            {/* Search & Category Filters */}
            <div className="mb-8 space-y-4">
                <input
                    type="text"
                    placeholder="Search endpoints... (e.g. analyze, metrics, GET)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveCategory(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${!activeCategory ? 'bg-cyan-600 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'}`}
                    >
                        All ({ENDPOINTS.length})
                    </button>
                    {categories.map(cat => {
                        const count = ENDPOINTS.filter(e => e.category === cat).length;
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeCategory === cat ? 'bg-cyan-600 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'}`}
                            >
                                {cat} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Two-Column Layout */}
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Endpoints */}
                <div className="space-y-3">
                    <h2 className="text-sm uppercase tracking-wider text-neutral-500 font-semibold mb-4">
                        Endpoints ({filteredEndpoints.length})
                    </h2>
                    {filteredEndpoints.length === 0 && (
                        <div className="glass-panel p-8 text-center text-neutral-500 text-sm">No endpoints match your search.</div>
                    )}
                    {filteredEndpoints.map(ep => (
                        <EndpointCard key={ep.id} ep={ep} onRun={handleRun} />
                    ))}
                </div>

                {/* Response Panel */}
                <div ref={responseRef} className="lg:sticky lg:top-24 lg:self-start space-y-4">
                    <h2 className="text-sm uppercase tracking-wider text-neutral-500 font-semibold mb-4">Response</h2>
                    <ResponsePanel response={response} loading={loading} />

                    {/* Quick Links */}
                    <div className="glass-panel p-4">
                        <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3">Related Pages</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { href: '/dashboard', label: 'Dashboard' },
                                { href: '/ile-guard', label: 'ILE Guard' },
                                { href: '/logs', label: 'Attack Logs' },
                                { href: '/metrics', label: 'Metrics' },
                                { href: '/sessions/new', label: 'New Session' },
                                { href: '/ai/generate', label: 'AI Generate' },
                            ].map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-neutral-400 hover:text-white transition-colors text-center"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

