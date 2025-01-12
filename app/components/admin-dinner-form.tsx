import {
  getFormProps,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  SubmissionResult,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { Form } from "react-router";

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
  submitText: string;
  defaultValues?: Partial<{
    title: string;
    description: string;
    date: string;
    slots: number;
    price: number;
    addressId: string;
    cover: never;
  }>;
}

export function AdminDinnerForm({
  schema,
  validImageTypes,
  addresses,
  lastResult,
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

      <Field
        labelProps={{ children: "Cover" }}
        inputProps={{
          ...getInputProps(fields.cover, { type: "file" }),
          tabIndex: 0,
          accept: validImageTypes.join(","),
          className: "file:text-foreground",
        }}
        errors={fields.cover.errors}
        className="flex w-full flex-col gap-2"
      />

      <SelectField
        labelProps={{ children: "Address" }}
        selectProps={{
          ...getSelectProps(fields.addressId),
          children: addresses.map((address) => {
            const { id } = address;

            return (
              <option key={id} value={id}>
                {`${address.streetName} ${address.houseNumber} - ${address.zip} ${address.city}`}
              </option>
            );
          }),
          className:
            "flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        }}
        errors={fields.addressId.errors}
        className="flex w-full flex-col gap-2"
      />

      <Button type="submit">{submitText}</Button>
    </Form>
  );
}
