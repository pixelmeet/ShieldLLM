"use client";

import { Control, FieldValues, FieldPath } from "react-hook-form";
import { UserFieldDef } from "@/types/user-schema";
import { TextField } from "./text-field";
import { TextareaField } from "./textarea-field";
import { DateField } from "./date-field";
import { UrlField } from "./url-field";
import { SelectField } from "./select-field";
import { FileField } from "./file-field";

interface FieldFactoryProps<T extends FieldValues> {
  fieldDef: UserFieldDef;
  control: Control<T>;
  disabled?: boolean;
  onSelectValueChange?: (value: string, fieldName: string) => void;
  onFileUpload?: (url: string, publicId: string) => void;
}

export function FieldFactory<T extends FieldValues>({
  fieldDef,
  control,
  disabled = false,
  onSelectValueChange,
  onFileUpload,
}: FieldFactoryProps<T>) {
  const { name, label, ui, placeholder, options, dependsOn } = fieldDef;

  let fieldOptions = options || [];
  if (dependsOn && ui === "select") {
    // Note: Dynamic options should be handled by the parent component
    // This is a simplified version for the factory pattern
    fieldOptions = options || [];
  }

  switch (ui) {
    case "text":
      return (
        <TextField
          name={name as FieldPath<T>}
          control={control}
          label={label}
          placeholder={placeholder}
          disabled={disabled}
        />
      );

    case "textarea":
      return (
        <TextareaField
          name={name as FieldPath<T>}
          control={control}
          label={label}
          placeholder={placeholder}
          disabled={disabled}
        />
      );

    case "date":
      return (
        <DateField
          name={name as FieldPath<T>}
          control={control}
          label={label}
          disabled={disabled}
        />
      );

    case "url":
      return (
        <UrlField
          name={name as FieldPath<T>}
          control={control}
          label={label}
          placeholder={placeholder}
          disabled={disabled}
        />
      );

    case "select":
      return (
        <SelectField
          name={name as FieldPath<T>}
          control={control}
          label={label}
          options={fieldOptions}
          disabled={disabled}
          onValueChange={onSelectValueChange}
        />
      );

    case "file":
      return (
        <FileField
          name={name as FieldPath<T>}
          control={control}
          label={label}
          disabled={disabled}
          onFileUpload={onFileUpload}
        />
      );

    default:
      return (
        <TextField
          name={name as FieldPath<T>}
          control={control}
          label={label}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
  }
}
