'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    otp?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
    const tokenParam = searchParams.get('token') || searchParams.get('otp') || searchParams.get('code');
    if (tokenParam) {
      setOtp(tokenParam);
    }
  }, [searchParams]);

  const validate = () => {
    const tempErrors: typeof errors = {};
    if (!otp.trim()) {
      tempErrors.otp = 'Verification code is required';
    }
    if (!password) {
      tempErrors.password = 'Password is required';
    } else if (password.length < 6) {
      tempErrors.password = 'Password must be at least 6 characters';
    }
    if (password !== confirmPassword) {
      tempErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Password reset failed');
      }

      toast.success('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during password reset');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full glass-panel glow-cyan p-8 text-white">
      <div className="flex flex-col gap-2 mb-6">
        <h2 className="text-xl font-bold tracking-tight">Reset password</h2>
        <p className="text-xs text-neutral-400">
          Enter your verification code and choose a new password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email Field */}
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
            disabled={isLoading || !!searchParams.get('email')}
            required
            className="bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50 text-sm disabled:opacity-70"
          />
        </div>

        {/* OTP/Token Field */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp" className="text-xs font-semibold text-neutral-300">
            6-Digit Reset Code
          </Label>
          <Input
            id="otp"
            placeholder="123456"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value);
              if (errors.otp) setErrors((prev) => ({ ...prev, otp: undefined }));
            }}
            disabled={isLoading}
            required
            className={`bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50 text-sm ${
              errors.otp ? 'border-red-500/55 focus:border-red-500' : ''
            }`}
          />
          {errors.otp && (
            <span className="text-[10px] text-red-400 font-semibold">{errors.otp}</span>
          )}
        </div>

        {/* New Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-neutral-300">
            New Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            disabled={isLoading}
            required
            className={`bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50 text-sm ${
              errors.password ? 'border-red-500/55 focus:border-red-500' : ''
            }`}
          />
          {errors.password && (
            <span className="text-[10px] text-red-400 font-semibold">{errors.password}</span>
          )}
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-semibold text-neutral-300">
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            disabled={isLoading}
            required
            className={`bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50 text-sm ${
              errors.confirmPassword ? 'border-red-500/55 focus:border-red-500' : ''
            }`}
          />
          {errors.confirmPassword && (
            <span className="text-[10px] text-red-400 font-semibold">{errors.confirmPassword}</span>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_15px_rgba(0,242,254,0.2)]"
        >
          {isLoading ? 'Resetting password...' : 'Reset Password'}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-neutral-400">
        Remember your password?{' '}
        <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="w-full glass-panel glow-cyan p-8 text-white flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <span className="text-xs text-neutral-400">Loading reset context...</span>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

