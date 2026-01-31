"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { User } from "@/types/user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { updateAdminUserAction } from "@/app/actions/admin";
import { getAllRoles, getRolesForSelect, UserRole } from "@/types/roles";
import {
  getProfileUserFields,
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
import { Loader2 } from "lucide-react";

interface EditUserDialogProps {
  user: User | null;
  onOpenChange: (open: boolean) => void;
  allowedRoles?: UserRole[];
}

export function EditUserDialog({
  user,
  onOpenChange,
  allowedRoles,
}: EditUserDialogProps) {
  const permittedRoles =
    allowedRoles && allowedRoles.length
      ? allowedRoles
      : (getAllRoles() as UserRole[]);

  const createFormSchema = () => {
    const baseSchema = z.object({
      fullName: z.string().min(2, "Name must be at least 2 characters."),
      role: z.enum(permittedRoles as [UserRole, ...UserRole[]]),
    });

    const extraSchema = buildUserExtraZodShape();

    return baseSchema.extend(extraSchema);
  };

  const formSchema = createFormSchema();
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
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

  useEffect(() => {
    if (user) {
      const formValues: Record<string, unknown> = {
        fullName: user.fullName,
        role: user.role,
      };
      
      getProfileUserFields().forEach((field) => {
        const value = (user as unknown as Record<string, unknown>)[field.name];
        if (field.ui === "select") {
          formValues[field.name] = value || "none";
        } else {
          formValues[field.name] = value || "";
        }
      });
      
      form.reset(formValues);
    }
  }, [user, form]);

  async function onSubmit(values: FormData) {
    if (!user) return;
    
    // Prepare the data for the API
    const userData = {
      fullName: values.fullName as string,
      role: values.role as UserRole,
    };

    // Collect extra fields
    const extraFields: Record<string, unknown> = {};
    getProfileUserFields().forEach((field) => {
      let value = values[field.name as keyof typeof values];
      
      // Convert "none" to empty string for select fields
      if (field.ui === "select" && value === "none") {
        value = "";
      }
      
      if (value !== undefined && value !== "") {
        extraFields[field.name] = value;
      }
    });

    const result = await updateAdminUserAction(user.id, { ...userData, ...extraFields });
    if (result.success) {
      toast.success("User Updated", { description: result.message });
      onOpenChange(false);
    } else {
      toast.error("Update Failed", { description: result.message });
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User: {user?.fullName}</DialogTitle>
          <DialogDescription>
            Update the user&apos;s details below. Click save when you&apos;re
            done.
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
              <SelectField
                name="role"
                control={form.control}
                label="Role"
                options={getRolesForSelect()
                  .filter((r) => permittedRoles.includes(r.value))
                  .map((role) => ({ label: role.label, value: role.value }))}
                disabled={form.formState.isSubmitting}
              />
            </div>

            {/* Dynamic User Fields */}
            {getProfileUserFields()
              .filter((def) => def.editableInProfile !== false)
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
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
