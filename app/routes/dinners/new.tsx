import { ActionArgs, json, LoaderArgs, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Footer } from "~/components/footer";
import { NavBar } from "~/components/navbar";
import { createEvent } from "~/models/event.server";
import { getLocations } from "~/models/location.server";
import { requireUser } from "~/session.server";

export const loader = async ({ request }: LoaderArgs) => {
  const user = await requireUser(request);
  const locations = await getLocations();

  return json({
    locations,
  });
};

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();

  const title = formData.get("title") as string;
  const subtitle = formData.get("subtitle") as string;
  const tags = formData.get("tags") as string;
  const imageUrl = formData.get("image-url") as string;
  const shortDescription = formData.get("short-description") as string;
  const longDescription = formData.get("long-description") as string;
  const price = formData.get("price") as string;
  const slots = formData.get("slots") as string;
  const date = formData.get("date") as string;
  const signupStart = formData.get("signup-start") as string;
  const locationId = formData.get("location") as string;
  console.log(locationId);

  const fieldErrors = {
    title: validateTitle(title),
    subtitle: validateSubtitle(subtitle),
    tags: validateTags(tags),
    imageUrl: validateImageUrl(imageUrl),
    shortDescription: validateShortDescription(shortDescription),
    longDescription: validateLongDescription(longDescription),
    price: validatePrice(price),
    slots: validateSlots(slots),
    date: validateDate(date),
    signupStart: validateDate(signupStart),
    locationId: validateLocation(locationId),
  };

  const fields = {
    title,
    subtitle,
    tags,
    imageUrl,
    shortDescription,
    longDescription,
    price,
    slots,
    date,
    signupStart,
    locationId,
  };

  if (Object.values(fieldErrors).some(Boolean)) {
    return json(
      {
        fieldErrors,
        fields,
        formError: null,
      },
      { status: 400 }
    );
  }

  const event = await createEvent({
    title,
    subtitle,
    tags,
    imageUrl,
    shortDescription,
    description: longDescription,
    price: Number(price),
    slots: Number(slots),
    date: new Date(date),
    signupDate: new Date(signupStart),
    locationId,
  });

  return redirect(`/dinners/${event.id}`);
};

export default function DinnersIndexRoute() {
  const { locations } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <>
      <header>
        <NavBar className="bg-emerald-800 text-white" />
      </header>
      <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 py-4 text-gray-800">
        <Form method="post">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="title" className="font-semibold">
                Title
              </label>
              <input
                type="text"
                name="title"
                id="title"
                defaultValue={actionData?.fields.title}
                aria-invalid={actionData?.fieldErrors.title ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.title ? "title-error" : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.title && (
                <p
                  id="title-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.title}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="subtitle" className="font-semibold">
                Subtitle
              </label>
              <input
                type="text"
                name="subtitle"
                id="subtitle"
                defaultValue={actionData?.fields.subtitle}
                aria-invalid={actionData?.fieldErrors.subtitle ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.subtitle
                    ? "subtitle-error"
                    : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.subtitle && (
                <p
                  id="subtitle-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.subtitle}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="tags" className="font-semibold">
                Tags (separated by space)
              </label>
              <input
                type="text"
                name="tags"
                id="tags"
                defaultValue={actionData?.fields.tags}
                aria-invalid={actionData?.fieldErrors.tags ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.tags ? "tags-error" : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.tags && (
                <p
                  id="tags-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.tags}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="image-url" className="font-semibold">
                Image URL
              </label>
              <input
                type="url"
                name="image-url"
                id="image-url"
                defaultValue={actionData?.fields.imageUrl}
                aria-invalid={actionData?.fieldErrors.imageUrl ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.imageUrl
                    ? "image-url-error"
                    : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.imageUrl && (
                <p
                  id="image-url-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.imageUrl}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="short-description" className="font-semibold">
                Short Description
              </label>
              <textarea
                name="short-description"
                id="short-description"
                defaultValue={actionData?.fields.shortDescription}
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.shortDescription && (
                <p
                  id="short-description-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.shortDescription}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="long-description" className="font-semibold">
                Long Description
              </label>
              <textarea
                name="long-description"
                id="long-description"
                defaultValue={actionData?.fields.longDescription}
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.longDescription && (
                <p
                  id="long-description-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.longDescription}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="price" className="font-semibold">
                Price (CHF)
              </label>
              <input
                type="number"
                name="price"
                id="price"
                defaultValue={actionData?.fields.price}
                aria-invalid={actionData?.fieldErrors.price ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.price ? "price-error" : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.price && (
                <p
                  id="price-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.price}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="slots" className="font-semibold">
                Number of Seats
              </label>
              <input
                type="number"
                name="slots"
                id="slots"
                defaultValue={actionData?.fields.slots}
                aria-invalid={actionData?.fieldErrors.slots ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.slots ? "slots-error" : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.slots && (
                <p
                  id="slots-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.slots}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="date" className="font-semibold">
                Date
              </label>
              <input
                type="datetime-local"
                name="date"
                id="date"
                defaultValue={actionData?.fields.date}
                aria-invalid={actionData?.fieldErrors.date ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.date ? "date-error" : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.date && (
                <p
                  id="date-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.date}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="date" className="font-semibold">
                Signup Start
              </label>
              <input
                type="datetime-local"
                name="signup-start"
                id="signup-start"
                defaultValue={actionData?.fields.signupStart}
                aria-invalid={
                  actionData?.fieldErrors.signupStart ? true : false
                }
                aria-errormessage={
                  actionData?.fieldErrors.signupStart
                    ? "signup-start-error"
                    : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.signupStart && (
                <p
                  id="signup-start-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.signupStart}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-semibold">Location</p>
              {locations.map((location) => {
                return (
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="location"
                      id={`location-${location.id}`}
                      defaultChecked={
                        actionData?.fields.locationId === location.id
                      }
                      value={location.id}
                      className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                    />
                    <label
                      htmlFor={`location-${location.id}`}
                    >{`${location.street}, ${location.zipCode} ${location.zipName}`}</label>
                  </div>
                );
              })}
            </div>
            <div>
              <button
                type="submit"
                className="rounded-md bg-emerald-800 px-4 py-2 uppercase text-white shadow-md hover:bg-emerald-700 active:bg-emerald-900 max-sm:w-full"
              >
                Create
              </button>
            </div>
          </div>
        </Form>
      </main>
      <footer>
        <Footer />
      </footer>
    </>
  );
}

function validateTitle(title: string | null) {
  if (!title) return "Title must be provided";
  if (title.trim().length === 0) return "Title cannot be empty";
}

function validateSubtitle(subtitle: string | null) {
  if (!subtitle) return "Subtitle must be provided";
  if (subtitle.trim().length === 0) return "Subtitle cannot be empty";
}

function validateTags(tags: string | null) {
  if (!tags) return "Tags must be provided";
  if (tags.trim().length === 0) return "Tags cannot be empty";
}

function validateImageUrl(url: string | null) {
  if (!url) return "Image url must be provided";
  if (url.trim().length === 0) return "Image url cannot be empty";
}

function validateShortDescription(shortDescription: string | null) {
  if (!shortDescription) return "Short description must be provided";
  if (shortDescription.trim().length === 0)
    return "Short description cannot be empty";
}

function validateLongDescription(longDescription: string | null) {
  if (!longDescription) return "Long description must be provided";
  if (longDescription.trim().length === 0)
    return "Long description cannot be empty";
}

function validatePrice(price: string | null) {
  if (!price) return "Price must be provided";
  if (price.trim().length === 0) return "Price cannot be empty";
}

function validateSlots(slots: string | null) {
  if (!slots) return "Slots must be provided";
  if (slots.trim().length === 0) return "Slots cannot be empty";
}

function validateDate(date: string | null) {
  if (!date) return "Date must be provided";
  if (date.trim().length === 0) return "Date cannot be empty";
}

function validateLocation(location: string | null) {
  if (!location) return "Location must be provided";
  if (location.trim().length === 0) return "Location cannot be empty";
}
