"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormContext, type FieldPath, type FieldValues } from "react-hook-form";

import { DatePicker } from "@/components/common/date-picker";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FieldShellProps = {
  label: string;
  description?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
};

function FieldShell({
  label,
  description,
  required,
  optional,
  children,
}: FieldShellProps) {
  return (
    <FormItem>
      <FormLabel required={required} optional={optional}>
        {label}
      </FormLabel>
      {children}
      {description ? <FormDescription>{description}</FormDescription> : null}
      <FormMessage />
    </FormItem>
  );
}

export function TextFormField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  optional,
  ...inputProps
}: {
  name: FieldPath<T>;
  label: string;
  description?: string;
  required?: boolean;
  optional?: boolean;
} & Omit<ComponentProps<typeof Input>, "name">) {
  const form = useFormContext<T>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FieldShell
          label={label}
          description={description}
          required={required}
          optional={optional}
        >
          <FormControl>
            <Input {...inputProps} {...field} value={field.value ?? ""} />
          </FormControl>
        </FieldShell>
      )}
    />
  );
}

export function TextareaFormField<T extends FieldValues>({
  name,
  label,
  description,
  optional,
  ...textareaProps
}: {
  name: FieldPath<T>;
  label: string;
  description?: string;
  optional?: boolean;
} & Omit<ComponentProps<typeof Textarea>, "name">) {
  const form = useFormContext<T>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FieldShell label={label} description={description} optional={optional}>
          <FormControl>
            <Textarea {...textareaProps} {...field} value={field.value ?? ""} />
          </FormControl>
        </FieldShell>
      )}
    />
  );
}

export function SelectFormField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  placeholder,
  options,
}: {
  name: FieldPath<T>;
  label: string;
  description?: string;
  required?: boolean;
  placeholder: string;
  options: readonly { value: string; label: string }[];
}) {
  const form = useFormContext<T>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FieldShell label={label} description={description} required={required}>
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full" onBlur={field.onBlur}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      )}
    />
  );
}

function DateControl({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string | undefined) => void;
  id?: string;
}) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <DatePicker
      id={id ?? formItemId}
      value={value || undefined}
      onChange={(next) => onChange(next ?? "")}
      aria-invalid={Boolean(error)}
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
    />
  );
}

export function DateFormField<T extends FieldValues>({
  name,
  label,
  description,
  required,
}: {
  name: FieldPath<T>;
  label: string;
  description?: string;
  required?: boolean;
}) {
  const form = useFormContext<T>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FieldShell label={label} description={description} required={required}>
          <DateControl
            value={field.value ?? ""}
            onChange={field.onChange}
          />
        </FieldShell>
      )}
    />
  );
}
