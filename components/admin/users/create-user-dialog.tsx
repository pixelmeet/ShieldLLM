"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { createAdminUserAction } from "@/app/actions/admin";
import { getAllRoles, getRolesForSelect, UserRole } from "@/types/roles";
import {
  getSignupUserFields,
  buildUserExtraZodShape,
  getFieldOptions,
} from "@/types/user-schema";
import { FieldFactory, SelectField } from "@/components/user/fields";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export function CreateUserDialog({
  open,
  onOpenChange,
  allowedRoles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedRoles?: UserRole[];
}) {
  const permittedRoles = (
    allowedRoles && allowedRoles.length ? allowedRoles : getAllRoles()
  ) as UserRole[];

  const createFormSchema = () => {
    const baseSchema = z.object({
      fullName: z.string().min(2, "Name must be at least 2 characters."),
      email: z.string().email("Please enter a valid email address."),
      role: z.enum(permittedRoles as [UserRole, ...UserRole[]]),
      password: z.string().optional(),
    });

    const extraSchema = buildUserExtraZodShape();

    return baseSchema.extend(extraSchema);
  };

  const formSchema = createFormSchema();
  type FormData = z.infer<typeof formSchema>;

  // Create default values for all fields
  const getDefaultValues = () => {
    const defaults: Record<string, unknown> = { 
      role: (permittedRoles[0] as UserRole) ?? "user" 
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
  });

  const handleSelectValueChange = (value: string, fieldName: string) => {
    // Clear dependent fields when parent changes
    if (fieldName === "country") {
      form.setValue("state" as keyof FormData, "none");
      form.setValue("city" as keyof FormData, "none");
    } else if (fieldName === "state") {
      form.setValue("city" as keyof FormData, "none");
    }
  };

  async function onSubmit(values: FormData) {
    // Prepare the data for the API
    const userData = {
      fullName: values.fullName as string,
      email: values.email as string,
      role: values.role as UserRole,
      password: values.password as string | undefined,
    };

    // Collect extra fields
    const extraFields: Record<string, unknown> = {};
    getSignupUserFields().forEach((field) => {
      let value = values[field.name as keyof typeof values];
      
      // Convert "none" to empty string for select fields
      if (field.ui === "select" && value === "none") {
        value = "";
      }
      
      if (value !== undefined && value !== "") {
        extraFields[field.name] = value;
      }
    });

    const result = await createAdminUserAction({ ...userData, ...extraFields });
    if (result.success) {
      toast.success("User Created", { description: result.message });
      onOpenChange(false);
      form.reset(getDefaultValues());
    } else {
      toast.error("Creation Failed", { description: result.message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            A secure, random password will be generated if you leave the
            password field blank.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter full name" 
                        {...field}
                        value={field.value as string}
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
                        type="email" 
                        placeholder="Enter email address" 
                        {...field}
                        value={field.value as string}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Role Field */}
            <SelectField
              name="role"
              control={form.control}
              label="Role"
              options={getRolesForSelect()
                .filter((r) => permittedRoles.includes(r.value))
                .map((role) => ({ label: role.label, value: role.value }))}
              disabled={form.formState.isSubmitting}
            />

            {/* Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Leave blank for auto-generated password" 
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dynamic User Fields */}
            {getSignupUserFields().map((def) => {
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
                    disabled={form.formState.isSubmitting}
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
                  disabled={form.formState.isSubmitting}
                  onSelectValueChange={handleSelectValueChange}
                />
              );
            })}

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create User"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
