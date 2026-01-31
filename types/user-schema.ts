import { z } from "zod";
import { getCountries } from "@/constants/locations/countries";
import { getStatesByCountry } from "@/constants/locations/states";
import { getCitiesByState } from "@/constants/locations/cities";

export type UserExtraFieldName =
  // | "addressLine1"
  // | "addressLine2"
  | "gender"
  // | "bio"
  | "profilePic"
  | "username"
  // | "postalCode"
  // | "dateOfBirth"
  // | "city"
  // | "state"
  // | "country";
  // "is_active";

export type UserFieldDef = {
  name: UserExtraFieldName;
  label: string;
  ui: "text" | "textarea" | "select" | "date" | "url" | "checkbox" | "file";
  options?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
  contexts?: ("signup" | "profile")[];
  editableInProfile?: boolean;
  dependsOn?: string;
};

export const USER_FIELD_DEFS: UserFieldDef[] = [
  // {
  //   name: "addressLine1",
  //   label: "Address Line 1",
  //   ui: "textarea",
  //   placeholder: "123 Main St",
  //   contexts: ["profile"],
  //   editableInProfile: true,
  // },
  // {
  //   name: "addressLine2",
  //   label: "Address Line 2",
  //   ui: "textarea",
  //   placeholder: "Apt, suite, etc.",
  //   contexts: ["profile"],
  //   editableInProfile: true,
  // },
  {
    name: "gender",
    label: "Gender",
    ui: "select",
    options: [
      { label: "Male", value: "Male" },
      { label: "Female", value: "Female" },
      { label: "Other", value: "Other" },
    ],
    contexts: ["signup", "profile"],
    editableInProfile: true,
  },
  // {
  //   name: "bio",
  //   label: "Bio",
  //   ui: "textarea",
  //   placeholder: "Tell us about yourself",
  //   contexts: ["profile"],
  //   editableInProfile: true,
  // },
  {
    name: "profilePic",
    label: "Profile Picture",
    ui: "file",
    contexts: ["profile"],
    editableInProfile: true,
  },
  {
    name: "username",
    label: "Username",
    ui: "text",
    required: true,
    contexts: ["signup", "profile"],
    editableInProfile: false,
  },
  // {
  //   name: "postalCode",
  //   label: "Postal Code",
  //   ui: "text",
  //   placeholder: "12345",
  //   contexts: ["profile"],
  //   editableInProfile: true,
  // },
  // {
  //   name: "dateOfBirth",
  //   label: "Date of Birth",
  //   ui: "date",
  //   contexts: ["profile"],
  //   editableInProfile: true
  // },
  // {
  //   name: "country",
  //   label: "Country",
  //   ui: "select",
  //   options: getCountries().map(c => ({ label: c.name, value: c.code })),
  //   contexts: ["profile"],
  //   editableInProfile: true
  // },
  // {
  //   name: "state",
  //   label: "State/Province",
  //   ui: "select",
  //   options: [], // Will be populated dynamically based on country
  //   contexts: ["profile"],
  //   editableInProfile: true,
  //   dependsOn: "country"
  // },
  // {
  //   name: "city",
  //   label: "City",
  //   ui: "select",
  //   options: [],
  //   contexts: ["profile"],
  //   editableInProfile: true,
  //   dependsOn: "state"
  // },
  // {
  //   name: "is_active",
  //   label: "Active",
  //   ui: "checkbox",
  //   contexts: ["profile"],
  //   editableInProfile: true,
  // },
];

export function getEnabledUserFields(): UserFieldDef[] {
  return USER_FIELD_DEFS;
}

export function getSignupUserFields(): UserFieldDef[] {
  return USER_FIELD_DEFS.filter(
    (f) => !f.contexts || f.contexts.includes("signup")
  );
}

export function getProfileUserFields(): UserFieldDef[] {
  return USER_FIELD_DEFS.filter(
    (f) => !f.contexts || f.contexts.includes("profile")
  );
}

export function getFieldOptions(
  fieldName: string,
  dependentValue?: string
): { label: string; value: string }[] {
  const field = USER_FIELD_DEFS.find((f) => f.name === fieldName);
  if (!field) return [];

  if (field.dependsOn && dependentValue) {
    if (fieldName === "state" && field.dependsOn === "country") {
      return getStatesByCountry(dependentValue).map((s) => ({
        label: s.name,
        value: s.code,
      }));
    }
    if (fieldName === "city" && field.dependsOn === "state") {
      return getCitiesByState(dependentValue).map((c) => ({
        label: c.name,
        value: c.code,
      }));
    }
  }

  return field.options || [];
}

export function buildUserExtraZodShape() {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of USER_FIELD_DEFS) {
    let schema: z.ZodTypeAny;
    switch (f.ui) {
      case "textarea":
      case "text":
        schema = z
          .string()
          .min(f.required ? 1 : 0)
          .optional();
        break;
      case "file":
        schema = z.any().optional();
        break;
      case "url":
        schema = z.string().url().optional();
        break;
      case "select":
        schema = z.string().optional();
        break;
      case "date":
        schema = z.string().optional();
        break;
      case "checkbox":
        schema = z.boolean().optional();
        break;
      default:
        schema = z.any().optional();
    }
    shape[f.name] = schema;
  }
  return shape;
}
