'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Email is required');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Request failed');
      }

      toast.success('Reset code sent if account exists');
      setIsSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full glass-panel glow-cyan p-8 text-white">
      <div className="flex flex-col gap-2 mb-6">
        <h2 className="text-xl font-bold tracking-tight">Recover account</h2>
        <p className="text-xs text-neutral-400">
          Enter your email address to receive a password reset code
        </p>
      </div>

      {isSubmitted ? (
        <div className="flex flex-col gap-4 text-center">
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs leading-relaxed">
            If an account matches <span className="font-semibold text-white">{email}</span>, a verification code has been dispatched. Check your inbox to retrieve your 6-digit code.
          </div>
          <Link
            href={`/reset-password?email=${encodeURIComponent(email)}`}
            className="w-full mt-2 inline-flex items-center justify-center h-9 rounded-md text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(0,242,254,0.2)]"
          >
            Enter Reset Code
          </Link>
          <Link
            href="/login"
            className="text-xs text-neutral-400 hover:text-white font-medium transition-colors"
          >
            Back to login
          </Link>
        </div>
      ) : (
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

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(0,242,254,0.2)]"
          >
            {isLoading ? 'Sending code...' : 'Send Reset Code'}
          </Button>

          <div className="mt-4 text-center text-xs">
            <Link href="/login" className="text-neutral-400 hover:text-white transition-colors font-medium">
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

