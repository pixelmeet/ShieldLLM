"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  User as UserIcon,
  Mail,
  Shield,
  Loader2,
  LogOut,
  Trash2,
  Save,
} from "lucide-react";

import {
  updateUserNameAction,
  deleteUserAction,
  updateUserExtrasAction,
} from "@/app/actions/user";
import { UserRole } from "@/types/roles";
import {
  getProfileUserFields,
  buildUserExtraZodShape,
} from "@/types/user-schema";
import { FieldFactory, SelectField } from "./fields";
import { getFieldOptions } from "@/types/user-schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  [key: string]: unknown;
}

interface UserInfoCardProps {
  user: User;
  onUserUpdate: (updatedUser: User) => void;
  variants?: {
    hidden: { opacity: number; y: number };
    visible: { opacity: number; y: number; transition: { staggerChildren: number } };
  };
}

const createFormSchema = () => {
  const baseSchema = z.object({
    fullName: z.string().min(2, "Name must be at least 2 characters."),
  });

  const extraSchema = buildUserExtraZodShape();

  return baseSchema.extend(extraSchema);
};

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

export function UserInfoCard({
  user,
  onUserUpdate,
  variants,
}: UserInfoCardProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(
    null
  );

  const formSchema = createFormSchema();

  const getDefaultValues = () => {
    const defaults: Record<string, unknown> = { fullName: user.name };
    getProfileUserFields().forEach((field) => {
      const value = (user as Record<string, unknown>)[field.name];
      if (field.ui === "select") {
        defaults[field.name] = value || "none";
      } else {
        defaults[field.name] = value || "";
      }
    });
    return defaults;
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
  });

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
      });

      if (response.ok) {
        router.push("/");
      } else {
        console.error("Logout failed:", response.statusText);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleDeleteAccount = async () => {
    setIsSubmitting(true);
    const result = await deleteUserAction();
    if (result.success) {
      toast.success(result.message);
      router.push("/");
    } else {
      toast.error(result.message);
    }
    setIsSubmitting(false);
  };

  const handleSelectValueChange = (value: string, fieldName: string) => {
    if (fieldName === "country") {
      form.setValue("state" as keyof FormData, "none");
      form.setValue("city" as keyof FormData, "none");
    } else if (fieldName === "state") {
      form.setValue("city" as keyof FormData, "none");
    }
  };

  const handleFileUpload = async (url: string, publicId: string) => {
    form.setValue("profilePic" as keyof FormData, url);
    form.setValue("profilePicId" as keyof FormData, publicId);
  };

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);

    try {
      if (values.fullName !== user.name) {
        const nameResult = await updateUserNameAction(
          values.fullName as string
        );
        if (nameResult.success) {
          onUserUpdate({ ...user, name: values.fullName as string });
        } else {
          toast.error(nameResult.message);
          setIsSubmitting(false);
          return;
        }
      }

      const extraFields: Record<string, unknown> = {};
      getProfileUserFields().forEach((field) => {
        const currentValue = (user as Record<string, unknown>)[field.name];
        let newValue = values[field.name as keyof typeof values];

        if (field.ui === "select" && newValue === "none") {
          newValue = "";
        }

        if (newValue !== currentValue) {
          extraFields[field.name] = newValue;
        }
      });

      if (Object.keys(extraFields).length > 0) {
        const extraResult = await updateUserExtrasAction(extraFields);
        if (extraResult.success) {
          onUserUpdate({ ...user, ...extraFields } as User);
          toast.success("Profile updated successfully!");
        } else {
          toast.error(extraResult.message);
        }
      } else if (values.fullName === user.name) {
        toast.info("No changes to save");
      } else {
        toast.success("Profile updated successfully!");
      }
    } catch (error) {
      toast.error("Failed to update profile");
      console.error("Profile update error:", error);
    }

    setIsSubmitting(false);
  }

  return (
    <motion.div variants={variants}>
      <Card className="h-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-serif">My Profile</CardTitle>
          <CardDescription>
            View and manage your personal information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-sm">
            {/* Prominent profile picture at top (only if a file field is enabled in schema) */}
            {getProfileUserFields().some((f) => f.ui === "file") && (
              <div className="w-full flex flex-col items-center justify-center gap-3">
                {(() => {
                  const pic = (user as Record<string, unknown>)[
                    "profilePic"
                  ] as string | undefined;
                  const imgSrc = pic && pic.length ? pic : "/images/user.png";
                  return (
                    <Image
                      src={imgSrc}
                      alt="Profile"
                      width={144}
                      height={144}
                      className="h-28 w-28 sm:h-36 sm:w-36 rounded-full object-cover border"
                    />
                  );
                })()}
                {(user as Record<string, unknown>)["profilePic"] ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const publicId = (user as Record<string, unknown>)[
                          "profilePicId"
                        ] as string | undefined;
                        if (publicId) {
                          await fetch("/api/files/delete", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ publicId }),
                          });
                        }
                      } catch {}
                      await updateUserExtrasAction({
                        profilePic: "",
                        profilePicId: "",
                      });
                      onUserUpdate({
                        ...user,
                        profilePic: "",
                        profilePicId: "",
                      } as User);
                      setProfilePicPreview(null);
                    }}>
                    Remove Photo
                  </Button>
                ) : null}
              </div>
            )}

            <div className="flex items-center gap-4">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center gap-4">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium capitalize">{user.role}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getProfileUserFields()
                .filter((def) => def.ui !== "checkbox")
                .map((def) => {
                  const value = (user as Record<string, unknown>)[def.name];
                  if (def.ui === "file") return null;
                  if (value === undefined || value === null || value === "")
                    return null;
                  return (
                    <div key={def.name} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {def.label}
                      </span>
                      <span className="font-medium break-words">
                        {String(value)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Full Name Field */}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold">
                      <UserIcon className="h-4 w-4" /> Full Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your full name"
                        {...field}
                        value={field.value as string}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Dynamic Profile Fields */}
              {getProfileUserFields()
                .filter(
                  (def) =>
                    def.ui !== "checkbox" && def.editableInProfile !== false
                )
                .map((def) => {
                  // Handle select fields with dynamic options separately
                  if (def.ui === "select") {
                    let options = def.options || [];
                    if (def.dependsOn) {
                      const dependentValue = form.getValues(def.dependsOn as keyof FormData) as string;
                      options = getFieldOptions(def.name, dependentValue);
                    }
                    
                    return (
                      <SelectField
                        key={def.name}
                        name={def.name as keyof FormData}
                        control={form.control}
                        label={def.label}
                        options={options}
                        disabled={isSubmitting}
                        onValueChange={handleSelectValueChange}
                      />
                    );
                  }
                  
                  // Use field factory for other field types
                  return (
                    <FieldFactory
                      key={def.name}
                      fieldDef={def}
                      control={form.control}
                      disabled={isSubmitting}
                      onSelectValueChange={handleSelectValueChange}
                      onFileUpload={handleFileUpload}
                    />
                  );
                })}

              {/* Read-only fields */}
              {getProfileUserFields()
                .filter((def) => def.editableInProfile === false)
                .map((def) => {
                  const value = (user as Record<string, unknown>)[def.name];
                  if (value === undefined || value === null || value === "")
                    return null;
                  return (
                    <div key={def.name} className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        {def.label}
                      </span>
                      <span className="font-medium break-words">
                        {String(value)}
                      </span>
                    </div>
                  );
                })}

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-[120px]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-4 border-t bg-muted/50 p-6">
          <h3 className="font-semibold text-foreground">Account Actions</h3>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isSubmitting}
                    className="bg-destructive hover:bg-destructive/90">
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
