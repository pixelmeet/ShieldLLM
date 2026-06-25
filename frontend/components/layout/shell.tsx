'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Shield, 
  History, 
  Bell, 
  FileSearch, 
  BarChart, 
  Settings, 
  Users, 
  LogOut, 
  Menu 
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface User {
  fullName: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
  name?: string;
}

interface ShellProps {
  user: User;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: ('admin' | 'moderator' | 'user')[];
}

const navItems: NavItem[] = [
  // User routes
  { href: '/user/chat', label: 'ILE Guard', icon: Shield, roles: ['user', 'moderator', 'admin'] },
  { href: '/user/sessions', label: 'Sessions', icon: History, roles: ['user', 'moderator', 'admin'] },
  
  // Moderator routes
  { href: '/moderator/dashboard', label: 'Alert Feed', icon: Bell, roles: ['moderator', 'admin'] },
  { href: '/moderator/audit-logs', label: 'Audit Logs', icon: FileSearch, roles: ['moderator', 'admin'] },
  
  // Admin routes
  { href: '/admin/dashboard', label: 'System Metrics', icon: BarChart, roles: ['admin'] },
  { href: '/admin/policy', label: 'Policy Config', icon: Settings, roles: ['admin'] },
  { href: '/admin/users', label: 'User Management', icon: Users, roles: ['admin'] },
];

export function Shell({ user, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const filteredNavItems = navItems.filter((item) => item.roles.includes(user.role));

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logoutAction();
      toast.success('Logged out successfully');
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
      setIsLoggingOut(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2) || 'U';
  };

  const renderNavLinks = () => {
    return (
      <div className="space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border-l-2 ${
                isActive
                  ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400'
                  : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-neutral-400'}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  };

  const renderUserInfo = () => {
    const roleBadgeStyles = {
      admin: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
      moderator: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
      user: 'bg-neutral-500/15 border-neutral-500/30 text-neutral-400',
    };

    return (
      <div className="border-t border-neutral-800 pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9 border border-neutral-800">
            <AvatarFallback className="bg-cyan-950 text-cyan-400 text-xs font-semibold">
              {getInitials(user.fullName || user.name || '')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user.fullName || user.name}</p>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${roleBadgeStyles[user.role] || roleBadgeStyles.user}`}>
              {user.role}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={isLoggingOut}
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-xs text-neutral-400 hover:text-white hover:bg-white/5"
        >
          <LogOut className="w-3.5 h-3.5 text-neutral-400" />
          {isLoggingOut ? 'Logging out...' : 'Sign Out'}
        </Button>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0E17]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] border-r border-neutral-800 bg-[#0D1321]/80 backdrop-blur-md p-4">
        {/* Header/Logo */}
        <div className="flex items-center gap-2 px-2 pb-6 pt-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(0,242,254,0.3)]">
            S
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white">
              Shield<span className="text-gradient-cyan">LLM</span>
            </span>
            <span className="text-[9px] text-neutral-500 font-medium leading-none">
              Intent-Locked Engine
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {renderNavLinks()}
        </nav>

        {/* Footer / User Profile */}
        {renderUserInfo()}
      </aside>

      {/* Main Content & Mobile Header */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Navbar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-neutral-800 bg-[#0D1321]/80 backdrop-blur-md z-40">
          <div className="flex items-center gap-2">
            <div className="w-6.5 h-6.5 rounded bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-xs text-white">
              S
            </div>
            <span className="font-bold text-sm tracking-tight text-white">
              Shield<span className="text-gradient-cyan text-xs">LLM</span>
            </span>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] bg-[#0D1321] border-r border-neutral-800 p-4 flex flex-col justify-between text-white">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-2 pb-6 pt-2 border-b border-neutral-800 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-white">
                    S
                  </div>
                  <span className="font-bold text-sm tracking-tight text-white">
                    Shield<span className="text-gradient-cyan">LLM</span>
                  </span>
                </div>
                <nav className="flex-1 overflow-y-auto">
                  {renderNavLinks()}
                </nav>
                <div className="mt-auto">
                  {renderUserInfo()}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-auto p-6 relative">
          {/* subtle ambient background glow */}
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
          {children}
        </main>
      </div>
    </div>
  );
}

