import {
  getFormProps,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { parseFormData, type FileUpload } from "@mjackson/form-data-parser";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  redirect,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

import { Field, SelectField, TextareaField } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { getAddresses } from "~/models/address.server";
import { createEvent } from "~/models/event.server";
import {
  fileStorage,
  getStorageKey,
} from "~/utils/dinner-image-storage.server";
import { ClientEventSchema } from "~/utils/event-validation";
import { ServerEventSchema } from "~/utils/event-validation.server";
import { getTimezoneOffset, offsetDate } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const addresses = await getAddresses();

  return {
    validImageTypes,
    addresses,
  };
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Create Dinner" }];
};

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const timeOffset = getTimezoneOffset(request);
  let maximumFileSizeExceeded = false;

  const uploadHandler = async (fileUpload: FileUpload) => {
    let storageKey = getStorageKey("temporary-key");
    await fileStorage.set(storageKey, fileUpload);
    return fileStorage.get(storageKey);
  };

  const formData = await parseFormData(request, uploadHandler);

  const submission = parseWithZod(formData, {
    schema: (intent) =>
      ServerEventSchema.superRefine((data) => {
        if (intent !== null) return { ...data };
      }),
  });

  console.log(submission.payload);

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
    imageId: eventImage.id,
    creatorId: user.id,
  });

  // Remove the file from disk.
  // It is in the database now.
  await fileStorage.remove(getStorageKey("temporary-key"));

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage() {
  const { addresses, validImageTypes } = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(ClientEventSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ClientEventSchema });
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

        <Button type="submit">Create Dinner</Button>
      </Form>
    </>
  );
}
