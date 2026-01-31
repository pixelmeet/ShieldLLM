"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group bg-white text-midnightGreen border border-border shadow-lg rounded-lg p-4 flex gap-3 items-start",
          title: "text-sm font-medium",
          description: "text-sm text-gray-500",
          success:
            "bg-white border-green-200 text-green-600",
          error:
            "bg-white border-red-200 text-red-600",
          actionButton:
            "bg-burntOrange text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-burntOrange/90",
          cancelButton:
            "bg-gray-100 text-gray-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-200",
        },
      }}
    />
  );
}

export { toast } from "sonner"; 