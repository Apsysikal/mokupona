import type { SubmissionResult } from "@conform-to/react";
import {
  getFormProps,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form } from "react-router";

import type { ListOfErrors } from "./forms";
import { Field, SelectField, TextareaField } from "./forms";
import { Button } from "./ui/button";

import { EventSchema } from "~/utils/event-validation";

const test = EventSchema.partial({ cover: true });

export interface AdminDinnerFormProps {
  schema: typeof EventSchema | typeof test;
  validImageTypes: string[];
  addresses: {
    id: string;
    streetName: string;
    houseNumber: string;
    zip: string;
    city: string;
  }[];
  lastResult?: SubmissionResult<string[]>;
  coverErrors?: ListOfErrors;
  submitText: string;
  defaultValues?: Partial<{
    title: string;
    description: string;
    menuDescription: string;
    donationDescription: string;
    date: string;
    slots: number;
    price: number;
    discounts: string;
    addressId: string;
    cover: never;
  }>;
}

export function AdminDinnerForm({
  schema,
  validImageTypes,
  addresses,
  lastResult,
  coverErrors,
  submitText,
  defaultValues,
}: AdminDinnerFormProps) {
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: defaultValues,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  const options = addresses.map((address) => {
    const label = `${address.streetName} ${address.houseNumber} - ${address.zip} ${address.city}`;
    const value = address.id;

    return { label, value };
  });

  return (
    <Form
      method="POST"
      encType="multipart/form-data"
      replace
      className="flex flex-col gap-6"
      {...getFormProps(form)}
    >
      <Field
        labelProps={{ children: "Title" }}
        inputProps={{ ...getInputProps(fields.title, { type: "text" }) }}
        errors={fields.title.errors}
        className="flex w-full flex-col gap-2"
      />

      <TextareaField
        labelProps={{ children: "Description" }}
        textareaProps={{
          ...getTextareaProps(fields.description),
          rows: 10,
        }}
        errors={fields.description.errors}
        className="flex w-full flex-col gap-2"
      />

      <TextareaField
        labelProps={{ children: "Menu" }}
        textareaProps={{
          ...getTextareaProps(fields.menuDescription),
          rows: 10,
        }}
        errors={fields.menuDescription.errors}
        className="flex w-full flex-col gap-2"
      />

      <TextareaField
        labelProps={{ children: "Donation" }}
        textareaProps={{
          ...getTextareaProps(fields.donationDescription),
          rows: 10,
        }}
        errors={fields.donationDescription.errors}
        className="flex w-full flex-col gap-2"
      />

      <Field
        labelProps={{ children: "Date" }}
        inputProps={{
          ...getInputProps(fields.date, { type: "datetime-local" }),
        }}
        errors={fields.date.errors}
        className="flex w-full flex-col gap-2"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <Field
          className="flex grow flex-col gap-2"
          labelProps={{ children: "Slots" }}
          inputProps={{ ...getInputProps(fields.slots, { type: "number" }) }}
          errors={fields.slots.errors}
        />

        <Field
          className="flex grow flex-col gap-2"
          labelProps={{ children: "Price" }}
          inputProps={{ ...getInputProps(fields.price, { type: "number" }) }}
          errors={fields.price.errors}
        />
      </div>

      <TextareaField
        labelProps={{ children: "Discounts" }}
        textareaProps={{
          ...getTextareaProps(fields.discounts),
          rows: 3,
        }}
        errors={fields.discounts.errors}
        className="flex w-full flex-col gap-2"
      />

      <Field
        labelProps={{ children: "Cover" }}
        inputProps={{
          ...getInputProps(fields.cover, { type: "file" }),
          tabIndex: 0,
          accept: validImageTypes.join(","),
          className: "file:text-foreground",
        }}
        errors={fields.cover.errors ?? coverErrors}
        className="flex w-full flex-col gap-2"
      />

      <SelectField
        labelProps={{ children: "Address" }}
        selectProps={{
          ...getSelectProps(fields.addressId),
          options,
        }}
        errors={fields.addressId.errors}
        className="flex w-full flex-col gap-2"
      />

      <Button type="submit">{submitText}</Button>
    </Form>
  );
}
