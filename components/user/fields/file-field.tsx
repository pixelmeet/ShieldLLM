"use client";

import { Control, FieldPath, FieldValues } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

interface FileFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  control: Control<T>;
  label: string;
  disabled?: boolean;
  onFileUpload?: (url: string, publicId: string) => void;
}

export function FileField<T extends FieldValues>({
  name,
  control,
  label,
  disabled = false,
  onFileUpload,
}: FileFieldProps<T>) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile picture must be 2 MB or smaller.");
      e.currentTarget.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("folder", "users/profilePics");
    formData.append("file", file);

    try {
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const url = data?.uploads?.[0]?.url as string | undefined;
      const publicId = data?.uploads?.[0]?.public_id as string | undefined;
      
      if (url && onFileUpload) {
        onFileUpload(url, publicId || "");
      }
    } catch {
      toast.error("Failed to upload file");
    }
  };

  return (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
