"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";

import { DateFormField, SelectFormField, TextareaFormField, TextFormField } from "@/components/forms/fields";
import { FormActions } from "@/components/forms/form-actions";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  DEMO_AGENCIES,
  DEMO_CATEGORIES,
  DEMO_FORM_PATHS,
  demoCoordinationFormSchema,
  demoFormDefaults,
  type DemoFormInput,
  type DemoFormOutput,
} from "@/lib/forms/demo-coordination-schema";
import { mapApiFailureToFormErrors } from "@/lib/forms/errors";
import type { ApiFailure } from "@infraos/shared-types";

/**
 * Synthetic form fixture (development only). Does not call the API.
 */
export function DemoCoordinationForm() {
  const [serverMessage, setServerMessage] = useState<string | undefined>();
  const [requestId, setRequestId] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState<DemoFormOutput | null>(null);
  const form = useForm<DemoFormInput, unknown, DemoFormOutput>({
    resolver: zodResolver(demoCoordinationFormSchema) as Resolver<
      DemoFormInput,
      unknown,
      DemoFormOutput
    >,
    defaultValues: demoFormDefaults,
    mode: "onBlur",
    reValidateMode: "onBlur",
    shouldFocusError: true,
  });

  return (
    <Form {...form}>
      <form
        className="grid max-w-xl gap-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setServerMessage(undefined);
          setRequestId(undefined);
          setSubmitted(values);
        })}
      >
        <FormErrorSummary message={serverMessage} requestId={requestId} />
        <TextFormField<DemoFormInput>
          name="title"
          label="Summary title"
          description="3 to 120 characters."
          required
          autoComplete="off"
        />
        <SelectFormField<DemoFormInput>
          name="agencyId"
          label="Agency"
          required
          placeholder="Select a synthetic agency"
          options={DEMO_AGENCIES.map((agency) => ({
            value: agency.id,
            label: agency.label,
          }))}
        />
        <SelectFormField<DemoFormInput>
          name="category"
          label="Work category"
          required
          placeholder="Select a category"
          options={DEMO_CATEGORIES.map((category) => ({
            value: category,
            label: category,
          }))}
        />
        <DateFormField<DemoFormInput>
          name="startDate"
          label="Start date"
          description="Calendar date only (YYYY-MM-DD)."
          required
        />
        <DateFormField<DemoFormInput>
          name="endDate"
          label="End date"
          description="Must be on or after the start date."
          required
        />
        <TextFormField<DemoFormInput>
          name="amountLkr"
          label="Estimated amount (LKR)"
          description="Optional. Stored as integer minor units after validation."
          optional
          inputMode="decimal"
          autoComplete="off"
        />
        <TextareaFormField<DemoFormInput>
          name="notes"
          label="Notes"
          optional
        />
        <FormActions
          submitLabel="Validate fixture"
          isSubmitting={form.formState.isSubmitting}
          onReset={() => {
            form.reset(demoFormDefaults);
            setSubmitted(null);
            setServerMessage(undefined);
            setRequestId(undefined);
          }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const failure: ApiFailure = {
                success: false,
                error: {
                  code: "VALIDATION_ERROR",
                  message: "Invalid",
                  details: {
                    fieldErrors: { title: "Server rejected this title." },
                  },
                },
                meta: { requestId: "demo-req" },
              };
              const mapped = mapApiFailureToFormErrors(failure, DEMO_FORM_PATHS);
              form.clearErrors();
              for (const field of mapped.fieldErrors) {
                form.setError(field.path as keyof DemoFormInput, {
                  type: "server",
                  message: field.message,
                });
              }
              setServerMessage(mapped.formMessage);
              setRequestId(mapped.requestId);
              setSubmitted(null);
            }}
          >
            Simulate server field error
          </Button>
        </FormActions>
        {submitted ? (
          <p className="type-caption text-text-secondary">
            Client validation passed. Amount minor units:{" "}
            {submitted.amountLkr ?? "none"}. No record was saved.
          </p>
        ) : null}
      </form>
    </Form>
  );
}
