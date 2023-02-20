import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Footer } from "~/components/footer";
import { NavBar } from "~/components/navbar";
import { createEvent } from "~/models/event.server";
import { getLocations } from "~/models/location.server";
import { requireUser } from "~/session.server";
import { z } from "zod";
import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import invariant from "tiny-invariant";

const EventSchema = z.object({
  title: z.string().trim().min(1).max(50),
  subtitle: z.string().trim().min(1).max(50),
  tags: z.string().trim().optional().default(""),
  imageUrl: z.string().trim().startsWith("https://"),
  shortDescription: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1),
  price: z.coerce.number().min(0),
  slots: z.coerce.number().min(1),
  date: z.coerce.date().min(new Date()),
  signupDate: z.coerce.date().min(new Date()),
  locationId: z.string().min(1),
});

const formKeys = EventSchema.keyof();
type FormKeyEnum = z.infer<typeof formKeys>;

function getFormKeyValue(key: FormKeyEnum): string {
  return formKeys.Values[key];
}

export const loader = async ({ request }: LoaderArgs) => {
  await requireUser(request);
  const locations = await getLocations();

  return json({
    locations,
  });
};

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const result = EventSchema.safeParse(Object.fromEntries(formData));

  const fieldErrors = !result.success
    ? result.error.formErrors.fieldErrors
    : null;

  const fields: { [key in FormKeyEnum]: any } = {
    title: formData.get("title"),
    subtitle: formData.get("subtitle"),
    tags: formData.get("tags"),
    imageUrl: formData.get("imageUrl"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    price: formData.get("price"),
    slots: formData.get("slots"),
    date: formData.get("date"),
    signupDate: formData.get("signupDate"),
    locationId: formData.get("locationId"),
  };

  if (fieldErrors) {
    return json(
      {
        fieldErrors,
        fields,
        formError: null,
      },
      { status: 400 }
    );
  }

  invariant(result.success);

  const event = await createEvent(result.data);

  return redirect(`/dinners/${event.id}`);
};

export default function DinnersIndexRoute() {
  const { locations } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <>
      <header>
        <NavBar />
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
                name={getFormKeyValue("title")}
                id={getFormKeyValue("title")}
                defaultValue={actionData?.fields.title}
                aria-invalid={actionData?.fieldErrors?.title ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors?.title ? "title-error" : undefined
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
              <label
                htmlFor={getFormKeyValue("subtitle")}
                className="font-semibold"
              >
                Subtitle
              </label>
              <input
                type="text"
                name={getFormKeyValue("subtitle")}
                id={getFormKeyValue("subtitle")}
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
              <label
                htmlFor={getFormKeyValue("tags")}
                className="font-semibold"
              >
                Tags (separated by space)
              </label>
              <input
                type="text"
                name={getFormKeyValue("tags")}
                id={getFormKeyValue("tags")}
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
              <label
                htmlFor={getFormKeyValue("imageUrl")}
                className="font-semibold"
              >
                Image URL
              </label>
              <input
                type="url"
                name={getFormKeyValue("imageUrl")}
                id={getFormKeyValue("imageUrl")}
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
              <label
                htmlFor={getFormKeyValue("shortDescription")}
                className="font-semibold"
              >
                Short Description
              </label>
              <textarea
                name={getFormKeyValue("shortDescription")}
                id={getFormKeyValue("shortDescription")}
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
              <label
                htmlFor={getFormKeyValue("description")}
                className="font-semibold"
              >
                Long Description
              </label>
              <textarea
                name={getFormKeyValue("description")}
                id={getFormKeyValue("description")}
                defaultValue={actionData?.fields.description}
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.description && (
                <p
                  id="long-description-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.description}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor={getFormKeyValue("price")}
                className="font-semibold"
              >
                Price (CHF)
              </label>
              <input
                type="number"
                name={getFormKeyValue("price")}
                id={getFormKeyValue("price")}
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
              <label
                htmlFor={getFormKeyValue("slots")}
                className="font-semibold"
              >
                Number of Seats
              </label>
              <input
                type="number"
                name={getFormKeyValue("slots")}
                id={getFormKeyValue("slots")}
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
              <label
                htmlFor={getFormKeyValue("date")}
                className="font-semibold"
              >
                Date
              </label>
              <input
                type="datetime-local"
                name={getFormKeyValue("date")}
                id={getFormKeyValue("date")}
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
              <label
                htmlFor={getFormKeyValue("signupDate")}
                className="font-semibold"
              >
                Signup Start
              </label>
              <input
                type="datetime-local"
                name={getFormKeyValue("signupDate")}
                id={getFormKeyValue("signupDate")}
                defaultValue={actionData?.fields.signupDate}
                aria-invalid={actionData?.fieldErrors.signupDate ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.signupDate
                    ? "signup-start-error"
                    : undefined
                }
                className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
              />
              {actionData?.fieldErrors?.signupDate && (
                <p
                  id="signup-start-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.signupDate}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-semibold">Location</p>
              {locations.map((location) => {
                return (
                  <div key={location.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={getFormKeyValue("locationId")}
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
