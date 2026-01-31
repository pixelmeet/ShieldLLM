'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('dev@shield.com');
    const [password, setPassword] = useState('dev');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                router.push('/dashboard');
            } else {
                alert('Login failed');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <div className="glass-panel p-10 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center">Login to Console</h2>
                <form
                    onSubmit={handleLogin}
                    className="space-y-4"
                    suppressHydrationWarning
                >
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-neutral-950 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500"
                            suppressHydrationWarning
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-neutral-950 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500"
                            suppressHydrationWarning
                        />
                    </div>

                    <div className="text-xs text-neutral-500 mt-2 p-3 bg-white/5 rounded">
                        <p className="font-bold mb-1">Demo Credentials:</p>
                        <p>admin@shield.com / admin</p>
                        <p>dev@shield.com / dev</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                        suppressHydrationWarning
                    >
                        {loading ? 'Logging in...' : 'Enter Dashboard'}
                    </button>
                </form>
            </div>
        </div>
    );
}
