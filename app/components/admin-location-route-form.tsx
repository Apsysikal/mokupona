import {
  getFormProps,
  useForm,
  type DefaultValue,
  type SubmissionResult,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form } from "react-router";
import type { z } from "zod";

import { AdminLocationForm } from "./admin-location-form";

import { AddressSchema } from "~/utils/address-validation";

export function AdminLocationRouteForm({
  lastResult,
  defaultValue,
  submitText,
  pageTitle,
}: {
  lastResult?: SubmissionResult;
  defaultValue?: DefaultValue<z.input<typeof AddressSchema>>;
  submitText: string;
  pageTitle: string;
}) {
  const [form, fields] = useForm<
    z.input<typeof AddressSchema>,
    z.output<typeof AddressSchema>
  >({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(AddressSchema),
    defaultValue,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: AddressSchema });
    },
  });

  return (
    <Form method="POST" replace {...getFormProps(form)}>
      <AdminLocationForm
        fields={fields}
        submitText={submitText}
        pageTitle={pageTitle}
      />
    </Form>
  );
}
