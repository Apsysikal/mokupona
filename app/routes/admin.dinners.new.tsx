import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MaxPartSizeExceededError,
  json,
  unstable_composeUploadHandlers,
  unstable_createFileUploadHandler,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";

import { getAddresses } from "~/models/address.server";
import { requireUserId } from "~/session.server";

const validImageTypes = ["image/jpeg/", "image/png", "image/webp"];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const addresses = await getAddresses();

  return json({
    validImageTypes,
    addresses,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);

  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createFileUploadHandler({
      directory: process.env.IMAGE_UPLOAD_FOLDER,
    }),
    unstable_createMemoryUploadHandler(),
  );

  console.log(request.formData);

  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler,
  ).catch((error) => {
    if (error instanceof MaxPartSizeExceededError) return null;
    throw error;
  });

  if (!formData)
    return json(
      {
        fieldErrors: {
          title: null,
          description: null,
          date: null,
          slots: null,
          price: null,
          cover: "File must be smaller than 3MB",
          address: null,
        },
        fields: null,
        formError: null,
      },
      { status: 400 },
    );

  const { title, description, date, slots, price, cover, address } =
    Object.fromEntries(formData);

  const fieldErrors = {
    title: validateTitle(title),
    description: validateDescription(description),
    date: validateDate(date),
    slots: validateSlots(slots),
    price: validatePrice(price),
    cover: validateCover(cover),
    address: validateAddress(address),
  };

  const fields = {
    title: title as string,
    description: description as string,
    date: date as string,
    slots: slots as string,
    price: price as string,
    address: address as string,
  };

  console.log(title);
  console.log(description);
  console.log(date);
  console.log(slots);
  console.log(price);
  console.log(cover);
  console.log(address);

  if (Object.values(fieldErrors).some(Boolean)) {
    return json(
      {
        fieldErrors,
        fields,
        formError: null,
      },
      { status: 400 },
    );
  }
}

export default function DinnersPage() {
  const { addresses, validImageTypes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <>
      <div>Create a new dinner</div>
      <Form
        method="POST"
        encType="multipart/form-data"
        className="flex flex-col gap-2"
      >
        <div>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            defaultValue={actionData?.fields?.title}
          />
          {actionData?.fieldErrors?.title ? (
            <p>{actionData.fieldErrors.title}</p>
          ) : null}
        </div>

        <div className="flex flex-col">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            defaultValue={actionData?.fields?.description}
          />
          {actionData?.fieldErrors?.description ? (
            <p>{actionData.fieldErrors.description}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="date">Date</label>
          <input
            type="date"
            name="date"
            id="date"
            defaultValue={actionData?.fields?.date}
          />
          {actionData?.fieldErrors?.date ? (
            <p>{actionData.fieldErrors.date}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="slots">Slots</label>
          <input
            type="number"
            name="slots"
            id="slots"
            defaultValue={actionData?.fields?.slots}
          />
          {actionData?.fieldErrors?.slots ? (
            <p>{actionData.fieldErrors.slots}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="price">Price</label>
          <input
            type="number"
            name="price"
            id="price"
            defaultValue={actionData?.fields?.price}
          />
          {actionData?.fieldErrors?.price ? (
            <p>{actionData.fieldErrors.price}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="cover">Cover</label>
          <input
            type="file"
            accept={validImageTypes.join(",")}
            name="cover"
            id="cover"
          />
          {actionData?.fieldErrors?.cover ? (
            <p>{actionData.fieldErrors.cover}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="address">Address</label>
          <select
            name="address"
            id="address"
            defaultValue={actionData?.fields?.address}
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

        <button type="submit">Create Dinner</button>
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
  if (!cover) return "Cover must be provided";
  if (!(cover instanceof File)) return "Invalid type";
  if (cover.size <= 0) return "No file provided";
  if (!validImageTypes.includes(cover.type))
    return "Image must be of type png, jpg or webp";
}

function validateAddress(address: FormDataEntryValue | string | null) {
  if (!address) return "Address must be provided";
  if (String(address).trim().length === 0) return "Address cannot be empty";
}
