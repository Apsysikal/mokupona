import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MaxPartSizeExceededError,
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

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { getAddresses } from "~/models/address.server";
import { getEventById, updateEvent } from "~/models/event.server";
import { requireUserWithRole } from "~/session.server";
import { getTimezoneOffset, offsetDate } from "~/utils";

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

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUserWithRole(request, ["moderator", "admin"]);
  const timeOffset = getTimezoneOffset(request);

  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createFileUploadHandler({
      directory: process.env.IMAGE_UPLOAD_FOLDER,
    }),
    unstable_createMemoryUploadHandler(),
  );

  const fieldErrors: Record<string, string | undefined> = {
    title: undefined,
    description: undefined,
    date: undefined,
    slots: undefined,
    price: undefined,
    cover: undefined,
    address: undefined,
  } as const;

  const formData = await unstable_parseMultipartFormData(
    request,
    async (part) => {
      try {
        const result = await uploadHandler(part);
        return result;
      } catch (error) {
        if (error instanceof MaxPartSizeExceededError) {
          // Catch the size error and handle it instead of the parser crashing
          fieldErrors.cover = "File size must be less than 3MB";
          return null;
        }
        throw error;
      }
    },
  );

  const { title, description, date, slots, price, cover, address } =
    Object.fromEntries(formData);

  const imageUpdated =
    fieldErrors.cover || (cover as NodeOnDiskFile).size > 0 ? true : false;

  fieldErrors.title = validateTitle(title);
  fieldErrors.description = validateDescription(description);
  fieldErrors.date = validateDate(date);
  fieldErrors.slots = validateSlots(slots);
  fieldErrors.price = validatePrice(price);
  // If we already have an error (size error) we don't want to validate again
  fieldErrors.cover = fieldErrors.cover
    ? fieldErrors.cover
    : imageUpdated
    ? validateCover(cover)
    : undefined;
  fieldErrors.address = validateAddress(address);

  const fields = {
    title: title as string,
    description: description as string,
    date: date as string,
    slots: slots as string,
    price: price as string,
    address: address as string,
  };

  if (Object.values(fieldErrors).some(Boolean)) {
    if (!fieldErrors.cover && (cover as Blob).size > 0) {
      // Delete the image from the disk as it will be uploaded again in the next submission
      invariant(cover instanceof NodeOnDiskFile);
      await cover.remove();
    }

    return json(
      {
        fieldErrors,
        fields,
        formError: null,
      },
      { status: 400 },
    );
  }

  const event = await updateEvent(dinnerId, {
    title: String(title),
    description: String(description),
    // Subtract user time offset to make the date utc
    date: offsetDate(new Date(String(date)), -timeOffset),
    slots: Number(slots),
    price: Number(price),
    addressId: String(address),
    ...(imageUpdated && {
      cover: String(`/file/${(cover as NodeOnDiskFile).name}`),
    }),
    creatorId: user.id,
  });

  return redirect(`/admin/dinners/${event.id}`);
}

export default function DinnersPage() {
  const { addresses, validImageTypes, dinner } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <>
      <Form
        method="POST"
        encType="multipart/form-data"
        replace
        className="flex flex-col gap-2"
      >
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            type="text"
            defaultValue={actionData?.fields?.title || dinner.title}
          />
          {actionData?.fieldErrors?.title ? (
            <p>{actionData.fieldErrors.title}</p>
          ) : null}
        </div>

        <div className="flex flex-col">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={actionData?.fields?.description || dinner.description}
          />
          {actionData?.fieldErrors?.description ? (
            <p>{actionData.fieldErrors.description}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            type="datetime-local"
            name="date"
            id="date"
            defaultValue={
              actionData?.fields?.date || dinner.date.substring(0, 16)
            }
          />
          {actionData?.fieldErrors?.date ? (
            <p>{actionData.fieldErrors.date}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="slots">Slots</Label>
          <Input
            type="number"
            name="slots"
            id="slots"
            defaultValue={actionData?.fields?.slots || dinner.slots}
          />
          {actionData?.fieldErrors?.slots ? (
            <p>{actionData.fieldErrors.slots}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="price">Price</Label>
          <Input
            type="number"
            name="price"
            id="price"
            defaultValue={actionData?.fields?.price || dinner.price}
          />
          {actionData?.fieldErrors?.price ? (
            <p>{actionData.fieldErrors.price}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="cover">Cover</Label>
          <Input
            type="file"
            accept={validImageTypes.join(",")}
            name="cover"
            id="cover"
            tabIndex={0}
            className="file:text-foreground"
          />
          {actionData?.fieldErrors?.cover ? (
            <p>{actionData.fieldErrors.cover}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <select
            name="address"
            id="address"
            className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addresses.map((address) => {
              const { id } = address;

              return (
                <option key={id} value={id}>
                  {`${address.streetName} ${address.houseNumber} - ${address.zip} ${address.city}`}
                </option>
              );
            })}
          </select>
          {actionData?.fieldErrors?.address ? (
            <p>{actionData.fieldErrors.address}</p>
          ) : null}
        </div>

        <Button type="submit">Update Dinner</Button>
      </Form>
    </>
  );
}

function validateTitle(title: FormDataEntryValue | string | null) {
  if (!title) return "Title must be provided";
  if (title instanceof File) return "Invalid type";
  if (title.trim().length === 0) return "Title cannot be empty";
}

function validateDescription(description: FormDataEntryValue | string | null) {
  if (!description) return "Description must be provided";
  if (description instanceof File) return "Invalid type";
  if (description.trim().length === 0) return "Description cannot be empty";
}

function validateDate(date: FormDataEntryValue | string | null) {
  if (!date) return "Date must be provided";
  if (date instanceof File) return "Invalid type";
  if (new Date(date).getTime() <= new Date().getTime())
    return "Date must be in the future";
}

function validateSlots(slots: FormDataEntryValue | string | null) {
  if (!slots) return "Slots must be provided";
  if (slots instanceof File) return "Invalid type";
  if (Number(slots) <= 0) return "Slots cannot be zero";
}

function validatePrice(price: FormDataEntryValue | string | null) {
  if (!price) return "Price must be provided";
  if (price instanceof File) return "Invalid type";
  if (Number(price) <= 0) return "Price cannot be zero";
}

function validateCover(cover: FormDataEntryValue | string | null) {
  if (!(cover instanceof NodeOnDiskFile)) return "Invalid type";
  if (cover.size <= 0) return "No file provided";
  if (!validImageTypes.includes(cover.type))
    return "Image must be of type png, jpg or webp";
}

function validateAddress(address: FormDataEntryValue | string | null) {
  if (!address) return "Address must be provided";
  if (String(address).trim().length === 0) return "Address cannot be empty";
}