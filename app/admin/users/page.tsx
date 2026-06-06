'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Loader2, Trash2, Search, ShieldAlert, Shield, 
  User as UserIcon, Calendar, ArrowUpRight, Check 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface User {
  _id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track updating state per user ID
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Could not load system user registry');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'moderator' | 'user') => {
    try {
      setUpdatingId(userId);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update role');
      }

      toast.success('User privileges updated successfully');
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Could not change user privileges');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('WARNING: Deleting this user will delete all their audit sessions, LLM turns, and threat alert history. This action is irreversible. Proceed?')) {
      return;
    }

    try {
      setDeletingId(userId);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      toast.success('User account and audit history deleted');
      setUsers(prev => prev.filter(u => u._id !== userId));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Could not delete user account');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const query = searchQuery.trim().toLowerCase();
    return !query || 
      u.fullName.toLowerCase().includes(query) || 
      u.email.toLowerCase().includes(query);
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-400 bg-red-950/40 border-red-500/30';
      case 'moderator': return 'text-yellow-400 bg-yellow-950/40 border-yellow-500/30';
      default: return 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30';
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 text-white">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-cyan-400" />
          User Privilege Directory
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Monitor system membership list, alter user roles, and purge test accounts with cascading data cleanups.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 border border-neutral-850 bg-[#0D1321]/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or email address..."
            className="w-full bg-neutral-900 border border-neutral-850 rounded-md py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <span className="text-xs text-neutral-500 text-right">
          Total Members: {filteredUsers.length} of {users.length}
        </span>
      </div>

      {/* Users List Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs text-neutral-500">Loading user accounts directory...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass-panel text-center py-16 px-4 border border-neutral-850">
          <Users className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No Matching Accounts</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Try adjusting your search keywords to locate registered members.
          </p>
        </div>
      ) : (
        <div className="glass-panel border border-neutral-850 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-950/40 border-b border-neutral-850 text-neutral-400 uppercase tracking-wider font-bold">
                  <th className="p-4 text-[10px]">User Details</th>
                  <th className="p-4 text-[10px]">Date Joined</th>
                  <th className="p-4 text-[10px]">Role Status</th>
                  <th className="p-4 text-[10px]">Assign Role</th>
                  <th className="p-4 text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850/60">
                {filteredUsers.map((user) => {
                  const date = new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <tr 
                      key={user._id} 
                      className="hover:bg-neutral-950/20 transition-all duration-150"
                    >
                      {/* Details */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
                            <UserIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-white block">
                              {user.fullName || 'No Name'}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono block">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="p-4 text-neutral-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                          {date}
                        </span>
                      </td>

                      {/* Role Status Badge */}
                      <td className="p-4">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>

                      {/* Assign Role Picker */}
                      <td className="p-4">
                        <Select 
                          value={user.role} 
                          onValueChange={(val: any) => handleRoleChange(user._id, val)}
                          disabled={updatingId === user._id}
                        >
                          <SelectTrigger className="w-[120px] h-8 bg-neutral-900 border-neutral-850 text-white text-[11px] font-semibold">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0D1321] border-neutral-850 text-white text-xs">
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <Button
                          onClick={() => handleDeleteUser(user._id)}
                          disabled={deletingId === user._id}
                          className="p-2 h-8 w-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md inline-flex items-center justify-center cursor-pointer"
                        >
                          {deletingId === user._id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
