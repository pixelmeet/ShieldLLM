'use client';

import React, { useState } from 'react';
import PromptInput from './PromptInput';
import ConversationHistory from './ConversationHistory';
import { Trash2, Download } from 'lucide-react';

interface UserInteractionPanelProps {
    onSubmitPrompt: (prompt: string) => void;
    conversationHistory: any[];
}

export default function UserInteractionPanel({ onSubmitPrompt, conversationHistory }: UserInteractionPanelProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (prompt: string) => {
        setIsSubmitting(true);
        await onSubmitPrompt(prompt);
        setIsSubmitting(false);
    };

    const handleClear = () => {
        // TODO: Clear conversation
        console.log('Clear conversation');
    };

    const handleExport = () => {
        // TODO: Export conversation
        console.log('Export conversation');
    };

    return (
        <div className="h-full flex flex-col" style={{ padding: 'var(--space-6)' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2
                    className="font-semibold"
                    style={{
                        fontSize: 'var(--text-xl)',
                        color: 'var(--text-primary)',
                        fontWeight: 'var(--font-semibold)'
                    }}
                >
                    User Interaction
                </h2>

                {/* Controls */}
                <div className="flex gap-2">
                    <button
                        onClick={handleClear}
                        className="p-2 rounded-lg transition-all"
                        style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}
                        title="Clear conversation"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        onClick={handleExport}
                        className="p-2 rounded-lg transition-all"
                        style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}
                        title="Export conversation"
                    >
                        <Download size={16} />
                    </button>
                </div>
            </div>

            {/* Conversation History */}
            <div className="flex-1 mb-4 overflow-hidden">
                <ConversationHistory history={conversationHistory} />
            </div>

            {/* Prompt Input */}
            <PromptInput onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
    );
}
