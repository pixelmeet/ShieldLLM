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
import {
  getAllRoles,
  UserRole,
  canAccessRole,
} from "@/types/roles";
import { getSignupUserFields, buildUserExtraZodShape } from "@/types/user-schema";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
// import { Checkbox } from "@/components/ui/checkbox";

const passwordValidation = new RegExp(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
);

const extraShape = buildUserExtraZodShape();

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

    role: z.enum(getAllRoles() as [UserRole, ...UserRole[]]).optional(),
  })
  .extend(extraShape)
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // const extraFields = (typeof window !== "undefined" ? [] : []) as any;
  const dynamicFields = getSignupUserFields().filter((f) => f.ui !== "checkbox");
  const twoPanel = dynamicFields.length > 0;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      ...Object.fromEntries(
        getSignupUserFields().map((f) => [
          f.name,
          f.ui === "checkbox" ? false : "",
        ])
      ),
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const payload = {
        ...values,
        role: values.role || "user",
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
        className={`w-full ${twoPanel ? "max-w-5xl" : "max-w-md"}`}>
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
                className={`grid grid-cols-1 ${twoPanel ? "md:grid-cols-2" : "md:grid-cols-1"} gap-4`}>
                <div className="space-y-4">
                  <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          ref={field.ref}
                          value={(field.value as string) ?? ""}
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
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          ref={field.ref}
                          value={(field.value as string) ?? ""}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                  />
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
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            ref={field.ref}
                            value={(field.value as string) ?? ""}
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
                            name={field.name}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            ref={field.ref}
                            value={(field.value as string) ?? ""}
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

                {twoPanel && (
                  <div className="space-y-4">
                    {dynamicFields.map((def) => (
                    <FormField
                      key={def.name}
                      control={form.control}
                      name={def.name as keyof z.infer<typeof formSchema>}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{def.label}</FormLabel>
                          <FormControl>
                            {def.ui === "textarea" ? (
                              <Textarea
                                placeholder={def.placeholder || def.label}
                                name={field.name}
                                onBlur={field.onBlur}
                                onChange={field.onChange}
                                ref={field.ref}
                                value={(field.value as string) ?? ""}
                                disabled={isLoading}
                              />
                            ) : def.ui === "select" ? (
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value as string | undefined}>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={def.placeholder || `Select ${def.label.toLowerCase()}`}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {(def.options || []).map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : def.ui === "checkbox" ? (
                              null
                            ) : (
                              <Input
                                type={
                                  def.ui === "date"
                                    ? "date"
                                    : def.ui === "url"
                                    ? "url"
                                    : "text"
                                }
                                placeholder={def.placeholder || def.label}
                                name={field.name}
                                onBlur={field.onBlur}
                                onChange={field.onChange}
                                ref={field.ref}
                                value={(field.value as string) ?? ""}
                                disabled={isLoading}
                              />
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  </div>
                )}

                <div className={`${twoPanel ? "md:col-span-2" : "md:col-span-1"} flex items-center justify-center pt-2`}>
                  <Button
                    type="submit"
                    className="min-w-40 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Sign Up"
                    )}
                  </Button>
                </div>
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
