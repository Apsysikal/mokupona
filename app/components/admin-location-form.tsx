import { getInputProps, type FieldMetadata } from "@conform-to/react";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";
import type z from "zod";

import { Field } from "./forms";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

import type { AddressSchema } from "~/utils/address-validation";

type FieldsetOf<Schema extends z.ZodType> = {
  [K in keyof z.input<Schema>]-?: FieldMetadata<z.input<Schema>[K]>;
};

// Shared by the location create and edit routes so the two can't drift; mirrors
// AdminEventForm's header + card shell on the compact admin density.
export function AdminLocationForm({
  fields,
  submitText,
  pageTitle,
}: {
  fields: FieldsetOf<typeof AddressSchema>;
  submitText: string;
  pageTitle: string;
}) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div>
        <Link
          to="/admin/locations"
          prefetch="intent"
          className="text-foreground/50 hover:text-foreground mb-3 inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ChevronLeftIcon className="size-4" />
          Locations
        </Link>
        <h1 className="text-3xl font-light tracking-tight md:text-4xl">
          {pageTitle}
        </h1>
      </div>

      <Card className="flex max-w-2xl flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Field
            className="grow"
            labelProps={{ children: "Street name" }}
            inputProps={{
              ...getInputProps(fields.streetName, { type: "text" }),
            }}
            errors={fields.streetName.errors}
          />
          <Field
            className="sm:w-32"
            labelProps={{ children: "House number" }}
            inputProps={{
              ...getInputProps(fields.houseNumber, { type: "text" }),
            }}
            errors={fields.houseNumber.errors}
          />
        </div>

        <div className="flex flex-col gap-5 sm:flex-row">
          <Field
            className="sm:w-40"
            labelProps={{ children: "Zip code" }}
            inputProps={{ ...getInputProps(fields.zipCode, { type: "text" }) }}
            errors={fields.zipCode.errors}
          />
          <Field
            className="grow"
            labelProps={{ children: "City" }}
            inputProps={{ ...getInputProps(fields.city, { type: "text" }) }}
            errors={fields.city.errors}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" asChild>
            <Link to="/admin/locations">Cancel</Link>
          </Button>
          <Button type="submit">{submitText}</Button>
        </div>
      </Card>
    </div>
  );
}
