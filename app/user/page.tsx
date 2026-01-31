"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  LogIn,
  ArrowLeft,
  LayoutDashboard,
  Moon,
  Sun,
  Loader2,
} from "lucide-react";

import { getCurrentUserAction } from "@/app/actions/auth";
import { canAccessRole, UserRole } from "@/types/roles";
import { UserInfoCard } from "@/components/user";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  [key: string]: unknown;
}

export default function UserPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await getCurrentUserAction();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Failed to fetch user", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You must be logged in to view this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")}>
              <LogIn className="mr-2 h-4 w-4" /> Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
  };

  return (
    <main className="min-h-screen bg-secondary p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <motion.div
          className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"
          variants={cardVariants}
          initial="hidden"
          animate="visible">
          {/* Left Side: User Profile */}
          <UserInfoCard 
            user={user} 
            onUserUpdate={handleUserUpdate}
            variants={cardVariants}
          />

          {/* Right Side: Links & Settings */}
          <motion.div
            variants={cardVariants}
            className="flex flex-col justify-between gap-6 lg:gap-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-serif">
                  Quick Links
                </CardTitle>
                <CardDescription>
                  Navigate to other parts of the application.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canAccessRole(user.role, "admin") ? (
                  <Link href="/admin">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-base h-12">
                      <LayoutDashboard className="mr-3 h-5 w-5 text-primary" />
                      Go to Admin Panel
                    </Button>
                  </Link>
                ) : canAccessRole(user.role, "moderator") ? (
                  <Link href="/moderator">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-base h-12">
                      <LayoutDashboard className="mr-3 h-5 w-5 text-primary" />
                      Go to Moderator Dashboard
                    </Button>
                  </Link>
                ) : (
                  <Link href="/user">
                    <Button
                      variant="outline"
                      className="w-full justify-start text-base h-12">
                      <LayoutDashboard className="mr-3 h-5 w-5 text-primary" />
                      Go to User Dashboard
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-serif">Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel of the app.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="font-medium">Toggle Theme</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}