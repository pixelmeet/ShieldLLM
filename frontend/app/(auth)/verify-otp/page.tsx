'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';


function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // 1. Check query parameter first
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      return;
    }

    // 2. Check localStorage fallback
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('signup_email');
      if (storedEmail) {
        setEmail(storedEmail);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Email is missing. Please sign up again.');
      return;
    }
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Verification failed');
      }

      toast.success('Email verified successfully!');
      
      // Clean up localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('signup_email');
      }

      router.push('/user/chat');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during verification');
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      toast.error('Email is missing. Cannot resend code.');
      return;
    }

    try {
      setIsResending(true);
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to resend code');
      }

      toast.success('A new verification code has been sent to your email.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full glass-panel glow-cyan p-8 text-white">
      <div className="flex flex-col gap-2 mb-6 text-center items-center">
        <h2 className="text-xl font-bold tracking-tight">Verify email</h2>
        <p className="text-xs text-neutral-400">
          Enter the 6-digit code sent to <span className="text-neutral-300 font-semibold">{email || 'your email'}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 items-center">
        <div className="flex flex-col gap-2 items-center">
          <Label htmlFor="otp" className="text-xs font-semibold text-neutral-300">
            One-Time Password
          </Label>
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(val) => setOtp(val)}
            disabled={isLoading}
          >
            <InputOTPGroup className="gap-2">
              <InputOTPSlot index={0} className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50" />
              <InputOTPSlot index={1} className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50" />
              <InputOTPSlot index={2} className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50" />
              <InputOTPSlot index={3} className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50" />
              <InputOTPSlot index={4} className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50" />
              <InputOTPSlot index={5} className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50" />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          type="submit"
          disabled={isLoading || otp.length !== 6}
          className="w-full font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(0,242,254,0.2)]"
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-neutral-400 flex flex-col gap-2">
        <p>
          Didn&apos;t receive the code?{' '}
          <button
            onClick={handleResendCode}
            disabled={isResending}
            className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isResending ? 'Resending...' : 'Resend code'}
          </button>
        </p>
        <Link href="/login" className="text-neutral-500 hover:text-neutral-300 font-medium transition-colors mt-2">
          Back to Login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div className="w-full glass-panel glow-cyan p-8 text-white flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <span className="text-xs text-neutral-400">Loading verification context...</span>
      </div>
    }>
      <VerifyOtpContent />
    </Suspense>
  );
}

