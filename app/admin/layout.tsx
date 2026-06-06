import React from 'react';
import { Shell } from "@/components/layout/shell";
import { getCurrentUserAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserAction();
  
  if (!user) {
    redirect("/login");
  }

  // Restrict only to admin role
  if (user.role !== 'admin') {
    redirect("/user/chat");
  }

  return <Shell user={user}>{children}</Shell>;
}
