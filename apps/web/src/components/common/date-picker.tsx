"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDateOnly,
  isDateOnlyString,
  parseDateOnly,
  type DateOnlyString,
} from "@/lib/design/date-only";
import { cn } from "cn";

export type DatePickerProps = {
  id?: string;
  label?: string;
  value?: DateOnlyString;
  onChange?: (value: DateOnlyString | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Accessible date picker for **date-only** values (`YYYY-MM-DD`).
 * Does not convert to UTC midnight; use separate fields for full timestamps.
 */
export function DatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  className,
  fromDate,
  toDate,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value && isDateOnlyString(value) ? parseDateOnly(value) : undefined;

  const display =
    selected != null
      ? selected.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : placeholder;

  return (
    <div className={cn("grid gap-2", className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "w-full justify-start text-left font-normal",
              !selected && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4" aria-hidden="true" />
            {display}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) {
                onChange?.(undefined);
                return;
              }
              onChange?.(formatDateOnly(date));
              setOpen(false);
            }}
            disabled={(date) => {
              if (fromDate && date < fromDate) return true;
              if (toDate && date > toDate) return true;
              return false;
            }}
          />
          {value ? (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange?.(undefined);
                  setOpen(false);
                }}
              >
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
