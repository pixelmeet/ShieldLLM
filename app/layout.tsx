import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ShieldLLM | Intent-Locked Execution Engine',
  description: 'Defending LLM Agents against Prompt Injection with Shadow Reasoning and Divergence Analysis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-100 selection:bg-cyan-500/30`}>
        <nav className="fixed top-0 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur-md z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white">S</div>
              <span className="font-bold text-lg tracking-tight">ShieldLLM</span>
            </div>
            <div className="flex gap-6 text-sm font-medium text-neutral-400">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              <Link href="/logs" className="hover:text-white transition-colors">Logs</Link>
              <Link href="/auth/login" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-md text-white transition-colors">Login</Link>
            </div>
          </div>
        </nav>
        <main className="pt-20 pb-10 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}