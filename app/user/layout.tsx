import React from 'react';
import { Shell } from "@/components/layout/shell";
import { getCurrentUserAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserAction();
  
  if (!user) {
    redirect("/login");
  }

  return <Shell user={user}>{children}</Shell>;
}
