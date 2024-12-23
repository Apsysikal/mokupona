import {
  getFormProps,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { FileUpload, parseFormData } from "@mjackson/form-data-parser";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  redirect,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { Field, SelectField, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { getAddresses } from "~/models/address.server";
import { getEventById, updateEvent } from "~/models/event.server";
import {
  fileStorage,
  getStorageKey,
} from "~/utils/dinner-image-storage.server";
import { EventSchema } from "~/utils/event-validation";
import { getTimezoneOffset, offsetDate } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const addresses = await getAddresses();
  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return {
    validImageTypes,
    addresses,
    dinner: event,
  };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Admin - Dinner" }];

  const { dinner } = data;
  if (!dinner) return [{ title: "Admin - Dinner" }];

  return [{ title: `Admin - Dinner - ${dinner.title} - Edit` }];
};

export async function action({ request, params }: ActionFunctionArgs) {
  const schema = EventSchema.partial({ cover: true });
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const timeOffset = getTimezoneOffset(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const uploadHandler = async (fileUpload: FileUpload) => {
    let storageKey = getStorageKey("temporary-key");
    await fileStorage.set(storageKey, fileUpload);
    return fileStorage.get(storageKey);
  };

  const formData = await parseFormData(request, uploadHandler);

  const submission = parseWithZod(formData, {
    schema: (intent) =>
      schema.superRefine((data) => {
        if (intent !== null) return { ...data };
      }),
  });

  if (
    submission.status !== "success" &&
    submission.payload &&
    submission.payload.cover
  ) {
    // Remove the uploaded file from disk.
    // It will be sent again when submitting.
    await fileStorage.remove(getStorageKey("temporary-key"));
  }

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
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
    await fileStorage.remove(getStorageKey("temporary-key"));
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
  const schema = EventSchema.partial({ cover: true });
  const { addresses, validImageTypes, dinner } = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: {
      title: dinner.title,
      description: dinner.description,
      date: dinner.date.toISOString().substring(0, 16),
      slots: dinner.slots,
      price: dinner.price,
      addressId: dinner.addressId,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  return (
    <>
      <Form
        method="POST"
        encType="multipart/form-data"
        replace
        className="flex flex-col gap-2"
        {...getFormProps(form)}
      >
        <Field
          labelProps={{ children: "Title" }}
          inputProps={{ ...getInputProps(fields.title, { type: "text" }) }}
          errors={fields.title.errors}
        />

        <TextareaField
          labelProps={{ children: "Description" }}
          textareaProps={{ ...getTextareaProps(fields.description) }}
          errors={fields.description.errors}
        />

        <Field
          labelProps={{ children: "Date" }}
          inputProps={{
            ...getInputProps(fields.date, { type: "datetime-local" }),
          }}
          errors={fields.date.errors}
        />

        <div className="sm:flex sm:justify-between sm:gap-2">
          <Field
            className="grow"
            labelProps={{ children: "Slots" }}
            inputProps={{ ...getInputProps(fields.slots, { type: "number" }) }}
            errors={fields.slots.errors}
          />

          <Field
            className="grow"
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
        />

        <Button type="submit">Update Dinner</Button>
      </Form>
    </>
  );
}
