import type { FieldMetadata } from "@conform-to/react";
import {
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useFormMetadata,
} from "@conform-to/react";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";
import type z from "zod";

import { Field, SelectField, TextareaField } from "./forms";
import { SectionNav } from "./section-nav";
import { SignupFormBuilder } from "./signup-form-builder";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

import { cn } from "~/lib/utils";
import { EventSchema } from "~/utils/event-validation";

const EventFormSchema = EventSchema.partial({ cover: true });

type FieldsetOf<Schema extends z.ZodType> = {
  [K in keyof z.input<Schema>]-?: FieldMetadata<z.input<Schema>[K]>;
};

type UpdatedAdminDinnerFormProps = {
  fields: FieldsetOf<typeof EventFormSchema>;
  addressOptions: Array<{ label: string; value: string }>;
  validImageTypes: string[];
  submitText: string;
  pageTitle: string;
  cancelHref: string;
  // true once the event's form has submissions (edit screen only)
  lockFieldKeys?: boolean;
};

const SECTIONS = [
  { id: "section-basics", label: "Basics" },
  { id: "section-menu-donation", label: "Menu & donation" },
  { id: "section-schedule-pricing", label: "Schedule & pricing" },
  { id: "section-cover-location", label: "Cover & location" },
  { id: "section-signup-form", label: "Signup form" },
];

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

function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      id={id}
      // scroll-mt clears the sticky chip nav when jumping via anchor links
      className="scroll-mt-16 rounded-[14px] md:scroll-mt-8"
    >
      <CardHeader className="p-5.5 pb-4.5">
        <CardTitle className="text-base font-bold tracking-[-.01em]">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-fg-label text-[13px]">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6 p-5.5 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function SaveBar({
  submitText,
  cancelHref,
}: {
  submitText: string;
  cancelHref: string;
}) {
  const form = useFormMetadata();

  return (
    <div className="border-foreground/10 bg-background/90 sticky bottom-0 z-10 -mx-2 border-t px-4 py-3 backdrop-blur md:bottom-2.5 md:mx-0 md:rounded-xl md:border">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={cn(
            "text-fg-label order-last text-center text-[13px] sm:order-first sm:text-left",
            !form.dirty && "invisible",
          )}
        >
          Unsaved changes
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" asChild>
            <Link to={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit">{submitText}</Button>
        </div>
      </div>
    </div>
  );
}

export function AdminDinnerForm({
  fields,
  addressOptions,
  validImageTypes,
  submitText,
  pageTitle,
  cancelHref,
  lockFieldKeys,
}: UpdatedAdminDinnerFormProps) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div>
        <Link
          to="/admin/dinners"
          prefetch="intent"
          className="text-fg-label hover:text-foreground mb-3.5 inline-flex items-center gap-1.5 text-[13px] transition-colors"
        >
          <ChevronLeftIcon className="size-[15px]" />
          Dinners
        </Link>
        <h1 className="text-[26px] font-extrabold tracking-[-.02em] md:text-[32px]">
          {pageTitle}
        </h1>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-7">
        <SectionNav sections={SECTIONS} />

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <SectionCard
            id="section-basics"
            title="Basics"
            description="Title and description guests see on the dinner page."
          >
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
          </SectionCard>

          <SectionCard
            id="section-menu-donation"
            title="Menu & donation"
            description="What is served and how donations work."
          >
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
          </SectionCard>

          <SectionCard
            id="section-schedule-pricing"
            title="Schedule & pricing"
            description="When it happens, how many seats, and what it costs."
          >
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
          </SectionCard>

          <SectionCard
            id="section-cover-location"
            title="Cover & location"
            description="Cover image and the venue address."
          >
            <Field
              labelProps={{ children: "Cover" }}
              inputProps={{
                ...getInputProps(fields.cover, { type: "file" }),
                tabIndex: 0,
                accept: validImageTypes.join(","),
                // reads as a dropzone (design handoff §7)
                className:
                  "h-auto cursor-pointer rounded-[10px] border-dashed py-6 text-center file:font-semibold",
              }}
              errors={fields.cover.errors}
            />

            <SelectField
              labelProps={{ children: "Address" }}
              selectProps={{
                ...getSelectProps(fields.addressId),
                options: addressOptions,
              }}
              errors={fields.addressId.errors}
            />
          </SectionCard>

          <SectionCard
            id="section-signup-form"
            title="Signup form"
            description="The questions guests answer when signing up."
          >
            <SignupFormBuilder
              field={fields.signupForm}
              lockFieldKeys={lockFieldKeys}
            />
          </SectionCard>

          <SaveBar submitText={submitText} cancelHref={cancelHref} />
        </div>
      </div>
    </div>
  );
}
