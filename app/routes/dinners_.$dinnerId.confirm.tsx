import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { Footer } from "~/components/footer";
import { NavBar } from "~/components/navbar";
import {
  getEventResponseById,
  updateEventResponse,
} from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";

export const loader = async ({ params, request }: LoaderArgs) => {
  const dinnerId = params.dinnerId;
  const url = new URL(request.url);
  const responseId = url.searchParams.get("id");
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");
  const preferredLocale =
    request.headers.get("accept-language")?.split(",")[0] || "de-DE";

  console.log(preferredLocale);

  invariant(dinnerId, "dinnerId must be defined");
  invariant(responseId, "responseId must be defined");
  invariant(email, "email must be defined");
  invariant(token, "token must be defined");

  const event = await getEventById(dinnerId);
  const response = await getEventResponseById(responseId);

  if (
    response.attributes.confirm_token !== token ||
    response.attributes.email !== email
  ) {
    throw new Response("Forbidden", { status: 403 });
  }
  if (!event) throw new Response("Event not found", { status: 404 });

  return json({
    preferredLocale,
    event,
  });
};

export const action = async ({ params, request }: ActionArgs) => {
  const formData = await request.formData();
  const dinnerId = params.dinnerId;
  const url = new URL(request.url);
  const responseId = url.searchParams.get("id");
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");

  invariant(dinnerId, "dinnerId must be defined");
  invariant(responseId, "responseId must be defined");
  invariant(email, "email must be defined");
  invariant(token, "token must be defined");

  const response = await getEventResponseById(responseId);

  if (
    response.attributes.confirm_token !== token ||
    response.attributes.email !== email
  ) {
    return json(
      {
        fieldErrors: null,
        fields: null,
        formError:
          "Failed to create the event. Maybe you already signed up using this email address.",
      },
      { status: 400 }
    );
  }

  const restrictionVegetarian = formData.get("dr-vegetarian") as string;
  const restrictionVegan = formData.get("dr-vegan") as string;
  const restrictionNuts = formData.get("dr-nuts") as string;
  const restrictionDairy = formData.get("dr-dairy") as string;
  const restrictionAlcohol = formData.get("dr-alcohol") as string;
  const restrictionOther = formData.get("dr-other") as string;
  const comment = formData.get("comment") as string;
  const termsOfService = formData.get("terms-of-service") as string;

  const fieldErrors = {
    termsOfService: validateTermsOfService(termsOfService),
  };

  const fields = {
    restrictionVegetarian,
    restrictionVegan,
    restrictionNuts,
    restrictionDairy,
    restrictionAlcohol,
    restrictionOther,
    comment,
    termsOfService,
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

  try {
    await updateEventResponse(String(response.id), {
      restriction_vegetarian: restrictionVegetarian ? true : false,
      restriction_vegan: restrictionVegan ? true : false,
      restriction_nuts: restrictionNuts ? true : false,
      restriction_dairy: restrictionDairy ? true : false,
      restriction_alcohol: restrictionAlcohol ? true : false,
      restriction_other: restrictionOther,
      comment,
      termsOfService: termsOfService ? true : false,
      state: "invite_confirmed",
    });
  } catch (error) {
    return json(
      {
        fieldErrors,
        fields,
        formError:
          "Failed to create the event. Maybe you already signed up using this email address.",
      },
      { status: 400 }
    );
  }

  return redirect("/dinners");
};

export default function DinnerRoute() {
  const { event, preferredLocale } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const eventDate = new Date(event.attributes.date);

  console.log(preferredLocale);

  return (
    <>
      <header>
        <NavBar />
      </header>
      <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 pt-4 pb-8 text-gray-800">
        <div className="flex flex-col gap-2">
          <p className="text-xl text-emerald-600">
            {event.attributes.subtitle}
          </p>
          <h1 className="text-4xl font-bold text-gray-900">
            {event.attributes.title}
          </h1>
        </div>
        <div className="flex items-center justify-between">
          {event.attributes.tags && event.attributes.tags.length > 0 && (
            <>
              <div>
                <div className="flex gap-1">
                  {event.attributes.tags.split(" ").map((tag) => {
                    return (
                      <span
                        key={tag}
                        className="rounded-full bg-emerald-200/50 px-2 py-1 text-xs uppercase text-emerald-800"
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        <img
          // @ts-expect-error
          src={event.attributes.cover.data.attributes.url}
          alt=""
          width={1200}
          height={800}
          className="max-h-28 w-full rounded-xl object-cover shadow-xl"
        />
        <div className="font-semibold text-emerald-600">
          <time dateTime={event.attributes.date} suppressHydrationWarning>
            {`${eventDate.toLocaleDateString(
              preferredLocale
            )} - ${eventDate.toLocaleTimeString(preferredLocale)}`}
          </time>
          <p>{`${event.attributes.address?.street} ${event.attributes.address?.number}`}</p>
          <p>{`${event.attributes.address?.zipcode} ${event.attributes.address?.city}`}</p>
        </div>
        <div className="font-semibold text-emerald-600">
          <p>{`Cost, ${event.attributes.price} CHF (Non-Profit)`}</p>
        </div>
        <div>
          <p className="whitespace-pre-line">
            Thank you for signing up for the {event.attributes.title} event. To
            confirm your participation fill out the form below. We've listed the
            most common dietary restrictions but please let us know about any
            others (in the others field).
          </p>
          <p className="whitespace-pre-line">
            If any of your restrictions conflict with our menu we'll contact you
            to see how to approach this. Don't worry about now being able to
            participate, we've made exceptions before.
          </p>
        </div>
        <Form method="post">
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Dietary Restrictions</p>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="dr-vegetarian"
                    id="dr-vegetarian"
                    defaultChecked={
                      actionData?.fields?.restrictionVegetarian ===
                      "dr-vegetarian"
                    }
                    value="dr-vegetarian"
                    className="rounded-sm border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="dr-vegetarian">Vegetarian</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="dr-vegan"
                    id="dr-vegan"
                    defaultChecked={
                      actionData?.fields?.restrictionVegetarian === "dr-vegan"
                    }
                    value="dr-vegan"
                    className="rounded-sm border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="dr-vegan">Vegan</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="dr-nuts"
                    id="dr-nuts"
                    defaultChecked={
                      actionData?.fields?.restrictionVegetarian === "dr-nuts"
                    }
                    value="dr-nuts"
                    className="rounded-sm border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="dr-nuts">Nuts Allergy</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="dr-dairy"
                    id="dr-dairy"
                    defaultChecked={
                      actionData?.fields?.restrictionVegetarian === "dr-dairy"
                    }
                    value="dr-dairy"
                    className="rounded-sm border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="dr-dairy">Dairy Intolerance</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="dr-alcohol"
                    id="dr-alcohol"
                    defaultChecked={
                      actionData?.fields?.restrictionVegetarian === "dr-alcohol"
                    }
                    value="dr-alcohol"
                    className="rounded-sm border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="dr-alcohol">No Alcohol</label>
                </div>
                {actionData?.formError && (
                  <div>
                    <p className="text-sm text-red-500">
                      {actionData.formError}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <label htmlFor="dr-other" className="font-semibold">
                  Any other restrictions?
                </label>
                <textarea
                  name="dr-other"
                  id="dr-other"
                  defaultValue={actionData?.fields?.restrictionOther}
                  className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                />
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <label htmlFor="comment" className="font-semibold">
                  Anything else you want to tell us?
                </label>
                <textarea
                  name="comment"
                  id="comment"
                  defaultValue={actionData?.fields?.comment}
                  className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                />
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="terms-of-service"
                    id="terms-of-service"
                    defaultChecked={
                      actionData?.fields?.termsOfService === "terms-of-service"
                    }
                    value="terms-of-service"
                    className="rounded-sm border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="terms-of-service">
                    I agree to the{" "}
                    <Link to="/toc" className="underline">
                      Terms of Service
                    </Link>
                  </label>
                </div>
                {actionData?.fieldErrors?.termsOfService && (
                  <p
                    id="messenger-error"
                    role="alert"
                    className="text-sm text-red-500"
                  >
                    {actionData.fieldErrors.termsOfService}
                  </p>
                )}
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="rounded-md bg-emerald-800 px-4 py-2 uppercase text-white shadow-md hover:bg-emerald-700 active:bg-emerald-900 max-sm:w-full"
              >
                Join
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

function validateTermsOfService(value: string | null) {
  if (value !== "terms-of-service") {
    return "You must accept the terms of service";
  }
}