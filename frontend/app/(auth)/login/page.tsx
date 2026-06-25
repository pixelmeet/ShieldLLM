'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      toast.success('Signed in successfully!');
      
      const role = data.role;
      if (role === 'admin') {
        router.push('/admin/dashboard');
      } else if (role === 'moderator') {
        router.push('/moderator/dashboard');
      } else {
        router.push('/user/chat');
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during sign in');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full glass-panel glow-cyan p-8 text-white">
      <div className="flex flex-col gap-2 mb-6">
        <h2 className="text-xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-xs text-neutral-400">Sign in to your ShieldLLM account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-neutral-300">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold text-neutral-300">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50 text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(0,242,254,0.2)]"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-neutral-400">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
          Sign up
        </Link>
      </div>
    </div>
  );
}

