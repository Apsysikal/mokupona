import { conform, useForm } from "@conform-to/react";
import { getFieldsetConstraint, parse } from "@conform-to/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MaxPartSizeExceededError,
  MetaFunction,
  NodeOnDiskFile,
  json,
  redirect,
  unstable_composeUploadHandlers,
  unstable_createFileUploadHandler,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { z } from "zod";

import { Field, SelectField, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";
import { requireUserWithRole } from "~/session.server";
import { getTimezoneOffset, offsetDate } from "~/utils";
import { EventSchema } from "~/utils/event-validation";

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const addresses = await getAddresses();

  return json({
    validImageTypes,
    addresses,
  });
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Create Dinner" }];
};

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const timeOffset = getTimezoneOffset(request);
  let maximumFileSizeExceeded = false;

  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createFileUploadHandler({
      directory: process.env.IMAGE_UPLOAD_FOLDER,
    }),
    unstable_createMemoryUploadHandler(),
  );

  const formData = await unstable_parseMultipartFormData(
    request,
    async (part) => {
      try {
        const result = await uploadHandler(part);
        return result;
      } catch (error) {
        if (error instanceof MaxPartSizeExceededError) {
          maximumFileSizeExceeded = true;
          return new File([], "cover");
        }
        throw error;
      }
    },
  );

  const submission = parse(formData, {
    schema: (intent) =>
      EventSchema.superRefine((data, ctx) => {
        if (intent !== "submit") return { ...data };
        if (maximumFileSizeExceeded) {
          ctx.addIssue({
            path: ["cover"],
            code: z.ZodIssueCode.custom,
            message: "File cannot be greater than 3MB",
          });
          return;
        }
      }),
  });

  if (submission.intent !== "submit" && submission.value) {
    // Remove the uploaded file from disk.
    // It will be sent again when submitting.
    await (submission.value.cover as NodeOnDiskFile).remove();
  }

  if (submission.intent !== "submit" || !submission.value) {
    return json(submission);
  }

  const { title, description, date, slots, price, cover, addressId } =
    submission.value;

  const eventImage = await prisma.eventImage.create({
    data: {
      contentType: cover.type,
      blob: Buffer.from(await cover.arrayBuffer()),
    },
  });

  const event = await createEvent({
    title,
    description,
    // Subtract user time offset to make the date utc
    date: offsetDate(date, -timeOffset),
    slots,
    price,
    addressId: addressId,
    cover: String(`/file/${(cover as NodeOnDiskFile).name}`),
    imageId: eventImage.id,
    creatorId: user.id,
  });

  // Remove the file from disk.
  // It is in the database now.
  await (cover as NodeOnDiskFile).remove();

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage() {
  const { addresses, validImageTypes } = useLoaderData<typeof loader>();
  const lastSubmission = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastSubmission,
    shouldValidate: "onBlur",
    constraint: getFieldsetConstraint(EventSchema),
    onValidate({ formData }) {
      return parse(formData, { schema: EventSchema });
    },
  });

  return (
    <>
      <div>Create a new dinner</div>
      <Form
        method="POST"
        encType="multipart/form-data"
        replace
        className="flex flex-col gap-2"
        {...form.props}
      >
        <Field
          labelProps={{ children: "Title" }}
          inputProps={{ ...conform.input(fields.title, { type: "text" }) }}
          errors={fields.title.errors}
        />

        <TextareaField
          labelProps={{ children: "Description" }}
          textareaProps={{ ...conform.textarea(fields.description) }}
          errors={fields.description.errors}
        />

        <Field
          labelProps={{ children: "Date" }}
          inputProps={{
            ...conform.input(fields.date, { type: "datetime-local" }),
          }}
          errors={fields.date.errors}
        />

        <Field
          labelProps={{ children: "Slots" }}
          inputProps={{ ...conform.input(fields.slots, { type: "number" }) }}
          errors={fields.slots.errors}
        />

        <Field
          labelProps={{ children: "Price" }}
          inputProps={{ ...conform.input(fields.price, { type: "number" }) }}
          errors={fields.price.errors}
        />

        <Field
          labelProps={{ children: "Cover" }}
          inputProps={{
            ...conform.input(fields.cover, { type: "file" }),
            tabIndex: 0,
            accept: validImageTypes.join(","),
            className: "file:text-foreground",
          }}
          errors={fields.cover.errors}
        />

        <SelectField
          labelProps={{ children: "Address" }}
          selectProps={{
            ...conform.select(fields.addressId),
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
        />

        <Button type="submit">Create Dinner</Button>
      </Form>
    </>
  );
}
