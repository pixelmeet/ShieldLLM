"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { canAccessRole } from "@/types/roles";
import {
  getSignupUserFields,
  buildUserExtraZodShape,
  getFieldOptions,
} from "@/types/user-schema";
import { FieldFactory, SelectField } from "@/components/user/fields";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const passwordValidation = new RegExp(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
);

const extraShape = buildUserExtraZodShape();

// Fix #2: Removed the `role` field from the signup form schema entirely.
// Role is always "user" for public signups; only admins can assign roles.
const formSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters."),
    email: z.string().email("Please enter a valid email address."),
    password: z
      .string()
      .regex(
        passwordValidation,
        "Password must be 8+ chars, with 1 uppercase, 1 lowercase, 1 number, and 1 special symbol."
      ),
    confirmPassword: z.string(),
  })
  .extend(extraShape)
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof formSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const dynamicFields = getSignupUserFields().filter((f) => f.ui !== "checkbox");

  const getDefaultValues = () => {
    const defaults: Record<string, unknown> = {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    };
    getSignupUserFields().forEach((field) => {
      if (field.ui === "select") {
        defaults[field.name] = "none";
      } else {
        defaults[field.name] = "";
      }
    });
    return defaults;
  };

  const form = useForm<SignupFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
  });

  const handleSelectValueChange = (value: string, fieldName: string) => {
    // Clear dependent fields when parent changes
    if (fieldName === "country") {
      form.setValue("state" as keyof SignupFormData, "none");
      form.setValue("city" as keyof SignupFormData, "none");
    } else if (fieldName === "state") {
      form.setValue("city" as keyof SignupFormData, "none");
    }
  };

  async function onSubmit(values: SignupFormData) {
    setIsLoading(true);
    try {
      // Collect extra fields, converting "none" to empty string for selects
      const extraFields: Record<string, unknown> = {};
      getSignupUserFields().forEach((field) => {
        let value = values[field.name as keyof typeof values];
        if (field.ui === "select" && value === "none") {
          value = "";
        }
        if (value !== undefined && value !== "") {
          extraFields[field.name] = value;
        }
      });

      const payload = {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        // No role field — server always assigns "user"
        ...extraFields,
      };

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Signup failed");
      }

      toast.success("Account created successfully!");

      if (canAccessRole(data.role, "admin")) {
        router.push("/admin");
      } else if (canAccessRole(data.role, "moderator")) {
        router.push("/moderator");
      } else {
        router.push("/user");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Signup failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full ${dynamicFields.length > 0 ? "max-w-3xl" : "max-w-md"}`}>
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 left-4"
              onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl font-bold text-center pt-6">
              Create an Account
            </CardTitle>
            <CardDescription className="text-center">
              Enter your details below to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4">
                {/* Core fields — Full Name & Email in a row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            {...field}
                            value={field.value as string}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="john@example.com"
                            type="email"
                            {...field}
                            value={field.value as string}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Password fields in a row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              {...field}
                              value={field.value as string}
                              disabled={isLoading}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0"
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={isLoading}>
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="••••••••"
                              {...field}
                              value={field.value as string}
                              disabled={isLoading}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              disabled={isLoading}>
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fix #3: Dynamic fields now use FieldFactory / SelectField,
                    matching the admin create-user-dialog rendering approach */}
                {dynamicFields.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dynamicFields.map((def) => {
                      if (def.ui === "select") {
                        let options = def.options || [];
                        if (def.dependsOn) {
                          const dependentValue = form.getValues(
                            def.dependsOn as keyof SignupFormData
                          ) as string;
                          options = getFieldOptions(def.name, dependentValue);
                        }

                        return (
                          <SelectField
                            key={def.name}
                            name={def.name as keyof SignupFormData}
                            control={form.control}
                            label={def.label}
                            options={options}
                            disabled={isLoading}
                            onValueChange={handleSelectValueChange}
                          />
                        );
                      }

                      return (
                        <FieldFactory
                          key={def.name}
                          fieldDef={def}
                          control={form.control}
                          disabled={isLoading}
                          onSelectValueChange={handleSelectValueChange}
                        />
                      );
                    })}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </form>
            </Form>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="underline text-primary">
                Log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
