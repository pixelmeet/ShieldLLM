import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'ILE Guard — AI Security System',
    description: 'Intent-Locked Execution with Shadow Reasoning for prompt injection defense',
};

export default function ILEGuardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
