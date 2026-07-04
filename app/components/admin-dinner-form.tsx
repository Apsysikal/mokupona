import type { FieldMetadata } from "@conform-to/react";
import {
  getInputProps,
  getSelectProps,
  getTextareaProps,
} from "@conform-to/react";

import type { ListOfErrors } from "./forms";
import { Field, SelectField, TextareaField } from "./forms";
import { Button } from "./ui/button";

import type z from "zod";
import { EventSchema } from "~/utils/event-validation";

const EventFormSchema = EventSchema.partial({ cover: true });

type FieldsetOf<Schema extends z.ZodType> = {
  [K in keyof z.input<Schema>]-?: FieldMetadata<z.input<Schema>[K]>;
};

type UpdatedAdminDinnerFormProps = {
  fields: FieldsetOf<typeof EventFormSchema>;
  addressOptions: Array<{ label: string; value: string }>;
  validImageTypes: string[];
  coverErrors?: ListOfErrors;
  submitText: string;
};

// Shared by the dinner create and edit routes so the address label format
// can't drift between the two pages.
export function toAddressOptions(
  addresses: Array<{
    id: string;
    streetName: string;
    houseNumber: string;
    zip: string;
    city: string;
  }>,
) {
  return addresses.map((address) => ({
    label: `${address.streetName} ${address.houseNumber} - ${address.zip} ${address.city}`,
    value: address.id,
  }));
}

// Splits the dinner routes' two-shaped action data: an upload-handler failure
// becomes cover errors, anything else is Conform's last result.
export function splitUploadActionData<Result extends object>(
  actionData: Result | { uploadHandlerError: string } | undefined,
) {
  const hasUploadError =
    actionData !== undefined && "uploadHandlerError" in actionData;

  return {
    coverErrors: hasUploadError ? [actionData.uploadHandlerError] : undefined,
    lastResult: hasUploadError ? undefined : actionData,
  };
}

export function AdminDinnerForm({
  fields,
  addressOptions,
  validImageTypes,
  coverErrors,
  submitText,
}: UpdatedAdminDinnerFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <Field
        labelProps={{ children: "Title" }}
        inputProps={{ ...getInputProps(fields.title, { type: "text" }) }}
        errors={fields.title.errors}
      />

      <TextareaField
        labelProps={{ children: "Description" }}
        textareaProps={{
          ...getTextareaProps(fields.description),
          rows: 10,
        }}
        errors={fields.description.errors}
      />

      <TextareaField
        labelProps={{ children: "Menu" }}
        textareaProps={{
          ...getTextareaProps(fields.menuDescription),
          rows: 10,
        }}
        errors={fields.menuDescription.errors}
      />

      <TextareaField
        labelProps={{ children: "Donation" }}
        textareaProps={{
          ...getTextareaProps(fields.donationDescription),
          rows: 10,
        }}
        errors={fields.donationDescription.errors}
      />

      <Field
        labelProps={{ children: "Date" }}
        inputProps={{
          ...getInputProps(fields.date, { type: "datetime-local" }),
        }}
        errors={fields.date.errors}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <Field
          className="grow"
          labelProps={{ children: "Slots" }}
          inputProps={{
            ...getInputProps(fields.slots, { type: "number" }),
          }}
          errors={fields.slots.errors}
        />

        <Field
          className="grow"
          labelProps={{ children: "Price" }}
          inputProps={{
            ...getInputProps(fields.price, { type: "number" }),
          }}
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
      />

      <Field
        labelProps={{ children: "Cover" }}
        inputProps={{
          ...getInputProps(fields.cover, { type: "file" }),
          tabIndex: 0,
          accept: validImageTypes.join(","),
        }}
        errors={fields.cover.errors ?? coverErrors}
      />

      <SelectField
        labelProps={{ children: "Address" }}
        selectProps={{
          ...getSelectProps(fields.addressId),
          options: addressOptions,
        }}
        errors={fields.addressId.errors}
      />

      <Button type="submit">{submitText}</Button>
    </div>
  );
}
