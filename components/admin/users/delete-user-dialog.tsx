"use client";

import { useState } from "react";
import { toast } from "sonner";
import { User } from "@/types/user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteAdminUserAction } from "@/app/actions/admin";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteUserDialogProps {
  user: User | null;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({
  user,
  onOpenChange,
}: DeleteUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    setIsSubmitting(true);
    const result = await deleteAdminUserAction(user.id);
    if (result.success) {
      toast.success("User Deleted", { description: result.message });
      onOpenChange(false);
    } else {
      toast.error("Deletion Failed", { description: result.message });
    }
    setIsSubmitting(false);
  };

  return (
    <AlertDialog open={!!user} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            account for <strong>{user?.fullName}</strong> ({user?.email}).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            asChild
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}>
            <Button variant="destructive" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Yes, delete user
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}