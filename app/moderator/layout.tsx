import React from 'react';
import { Shell } from "@/components/layout/shell";
import { getCurrentUserAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserAction();
  
  if (!user) {
    redirect("/login");
  }

  // Authorize only moderators and admins
  if (user.role !== 'moderator' && user.role !== 'admin') {
    redirect("/user/chat");
  }

  return <Shell user={user}>{children}</Shell>;
}
