'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface PromptInputProps {
    onSubmit: (prompt: string) => void;
    isSubmitting: boolean;
}

export default function PromptInput({ onSubmit, isSubmitting }: PromptInputProps) {
    const [prompt, setPrompt] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [prompt]);

    const handleSubmit = () => {
        if (prompt.trim() && !isSubmitting) {
            onSubmit(prompt);
            setPrompt('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div>
            <label
                htmlFor="prompt-input"
                className="block mb-2 font-medium"
                style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    fontWeight: 'var(--font-medium)'
                }}
            >
                User Prompt
            </label>

            <div
                className="rounded-lg overflow-hidden"
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-medium)',
                    transition: 'border-color var(--transition-fast)'
                }}
            >
                <textarea
                    ref={textareaRef}
                    id="prompt-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter a prompt to analyze..."
                    disabled={isSubmitting}
                    className="w-full resize-none outline-none"
                    style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--text-base)',
                        color: 'var(--text-primary)',
                        background: 'transparent',
                        padding: 'var(--space-4)',
                        minHeight: '120px',
                        maxHeight: '300px',
                        lineHeight: '1.6'
                    }}
                />

                <div
                    className="flex items-center justify-between px-4 py-3 border-t"
                    style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-tertiary)'
                    }}
                >
                    <span
                        style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)'
                        }}
                    >
                        Press Enter to submit, Shift+Enter for new line
                    </span>

                    <button
                        onClick={handleSubmit}
                        disabled={!prompt.trim() || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
                        style={{
                            background: prompt.trim() && !isSubmitting ? 'var(--accent-primary)' : 'var(--status-neutral-dim)',
                            color: prompt.trim() && !isSubmitting ? 'white' : 'var(--text-muted)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            cursor: prompt.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                            opacity: isSubmitting ? 0.6 : 1
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Submit
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
