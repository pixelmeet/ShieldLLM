'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const tempErrors: typeof errors = {};
    if (!fullName.trim()) {
      tempErrors.fullName = 'Full Name is required';
    }
    if (!email.trim()) {
      tempErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Email is invalid';
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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Signup failed');
      }

      // Store email temporarily in localStorage for OTP verification page to retrieve
      if (typeof window !== 'undefined') {
        localStorage.setItem('signup_email', email);
      }

      toast.success('Registration successful! Welcome to ShieldLLM.');
      router.push('/user/chat');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during registration');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full glass-panel glow-cyan p-8 text-white">
      <div className="flex flex-col gap-2 mb-6">
        <h2 className="text-xl font-bold tracking-tight">Create an account</h2>
        <p className="text-xs text-neutral-400">Get started with ShieldLLM active defense</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName" className="text-xs font-semibold text-neutral-300">
            Full Name
          </Label>
          <Input
            id="fullName"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
            disabled={isLoading}
            required
            className={`bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50 text-sm ${
              errors.fullName ? 'border-red-500/55 focus:border-red-500' : ''
            }`}
          />
          {errors.fullName && (
            <span className="text-[10px] text-red-400 font-semibold">{errors.fullName}</span>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-xs font-semibold text-neutral-300">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            disabled={isLoading}
            required
            className={`bg-[#0A0E17]/60 border-neutral-800 focus:border-cyan-500/50 text-sm ${
              errors.email ? 'border-red-500/55 focus:border-red-500' : ''
            }`}
          />
          {errors.email && (
            <span className="text-[10px] text-red-400 font-semibold">{errors.email}</span>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-xs font-semibold text-neutral-300">
            Password
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
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-neutral-400">
        Already have an account?{' '}
        <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );
}
