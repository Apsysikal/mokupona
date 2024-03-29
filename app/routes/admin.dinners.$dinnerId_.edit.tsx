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
import invariant from "tiny-invariant";
import { z } from "zod";

import { Field, SelectField, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { getAddresses } from "~/models/address.server";
import { getEventById, updateEvent } from "~/models/event.server";
import { requireUserWithRole } from "~/session.server";
import { getTimezoneOffset, offsetDate } from "~/utils";
import { EventSchema } from "~/utils/event-validation";

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const addresses = await getAddresses();
  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return json({
    validImageTypes,
    addresses,
    dinner: event,
  });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Admin - Dinner" }];

  const { dinner } = data;
  if (!dinner) return [{ title: "Admin - Dinner" }];

  return [{ title: `Admin - Dinner - ${dinner.title} - Edit` }];
};

/**
 * Make cover optional, to not force a reupload.
 * All other properties are still required, but
 * prefilled with the existing data.
 */
const schema = EventSchema.partial({ cover: true });

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const timeOffset = getTimezoneOffset(request);
  let maximumFileSizeExceeded = false;

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

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
      schema.superRefine((data, ctx) => {
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

  if (
    submission.intent !== "submit" &&
    submission.value &&
    submission.value.cover
  ) {
    // Remove the uploaded file from disk.
    // It will be sent again when submitting.
    await (submission.value.cover as NodeOnDiskFile).remove();
  }

  if (submission.intent !== "submit" || !submission.value) {
    return json(submission);
  }

  const { title, description, date, slots, price, cover, addressId } =
    submission.value;

  let eventImage;

  if (cover) {
    eventImage = await prisma.eventImage.create({
      data: {
        contentType: cover.type,
        blob: Buffer.from(await cover.arrayBuffer()),
      },
    });

    // Remove the file from disk.
    // It is in the database now.
    await (cover as NodeOnDiskFile).remove();
  }

  const event = await updateEvent(dinnerId, {
    title,
    description,
    // Subtract user time offset to make the date utc
    date: offsetDate(date, -timeOffset),
    slots,
    price,
    addressId,
    ...(eventImage && { imageId: eventImage.id }),
    creatorId: user.id,
  });

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage() {
  const { addresses, validImageTypes, dinner } = useLoaderData<typeof loader>();
  const lastSubmission = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastSubmission,
    shouldValidate: "onBlur",
    constraint: getFieldsetConstraint(schema),
    defaultValue: {
      title: dinner.title,
      description: dinner.description,
      date: dinner.date.substring(0, 16),
      slots: dinner.slots,
      price: dinner.price,
      addressId: dinner.addressId,
    },
    onValidate({ formData }) {
      return parse(formData, { schema });
    },
  });

  return (
    <>
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

        <Button type="submit">Update Dinner</Button>
      </Form>
    </>
  );
}
