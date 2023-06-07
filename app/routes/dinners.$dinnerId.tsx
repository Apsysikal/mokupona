import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { Footer } from "~/components/footer";
import { NavBar } from "~/components/navbar";
import { createEventResponse } from "~/models/event-response.server";
import type { Event } from "~/models/event.server";
import { getEventById } from "~/models/event.server";

export const loader = async ({ params }: LoaderArgs) => {
  const dinnerId = params.dinnerId;

  invariant(dinnerId, "dinnerId must be defined");

  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Event not found", { status: 404 });

  return json({
    event,
  });
};

export const action = async ({ params, request }: ActionArgs) => {
  const formData = await request.formData();
  const dinnerId = params.dinnerId;

  invariant(dinnerId, "dinnerId must be defined");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  const fieldErrors = {
    name: validateName(name),
    email: validateEmail(email),
  };

  const fields = {
    name,
    email,
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
    await createEventResponse({
      name,
      email,
      restriction_vegetarian: false,
      restriction_vegan: false,
      restriction_nuts: false,
      restriction_dairy: false,
      restriction_alcohol: false,
      restriction_other: null,
      comment: null,
      termsOfService: false,
      confirm_token: null,
      state: "waiting",
      signup_date: new Date().toISOString(),
      invite_date: null,
      event: dinnerId,
    });
  } catch (error) {
    return json(
      {
        fieldErrors,
        fields,
        formError:
          "Failed to sign you up. Maybe you already signed up using this email address.",
      },
      { status: 400 }
    );
  }

  return redirect("/dinners");
};

export default function DinnerRoute() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const eventResponses = event.attributes.event_responses;
  const maximumSlots = event.attributes.slots;
  const bookedSlots = getBookedSlots(eventResponses);
  const eventDate = new Date(event.attributes.date);
  const signupStartDate = new Date(event.attributes.signupDate);
  const signupHasStarted = Date.now() > signupStartDate.valueOf();
  const slotsAvailable = maximumSlots - bookedSlots;
  const slotsFilled = maximumSlots - slotsAvailable;

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

          <div className="flex items-center gap-1 text-xs">
            {`${slotsFilled}/${event.attributes.slots}`}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
          </div>
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
          <time dateTime={event.attributes.date}>
            {`${eventDate.toLocaleDateString()} - ${eventDate.toLocaleTimeString()}`}
          </time>
          <div>
            {!signupHasStarted && (
              <>
                Signup starts{" "}
                <time dateTime={event.attributes.signupDate}>
                  {`${signupStartDate.toLocaleDateString()} - ${signupStartDate.toLocaleTimeString()}`}
                </time>
              </>
            )}
          </div>
          <p>{`${event.attributes.address?.street} ${event.attributes.address?.number}`}</p>
          <p>{`${event.attributes.address?.zipcode} ${event.attributes.address?.city}`}</p>
        </div>
        <div className="font-semibold text-emerald-600">
          <p>{`Cost, ${event.attributes.price} CHF (Non-Profit)`}</p>
        </div>
        <div>
          <p className="whitespace-pre-line">{event.attributes.description}</p>
        </div>
        {signupHasStarted && (
          <Form method="post">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="name" className="font-semibold">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  defaultValue={actionData?.fields.name}
                  aria-invalid={actionData?.fieldErrors.name ? true : false}
                  aria-errormessage={
                    actionData?.fieldErrors.name ? "name-error" : undefined
                  }
                  className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                />
                {actionData?.fieldErrors?.name && (
                  <p
                    id="name-error"
                    role="alert"
                    className="text-sm text-red-500"
                  >
                    {actionData.fieldErrors.name}
                  </p>
                )}
              </div>
              <div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="email" className="font-semibold">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    defaultValue={actionData?.fields.email}
                    aria-invalid={actionData?.fieldErrors.email ? true : false}
                    aria-errormessage={
                      actionData?.fieldErrors.email ? "email-error" : undefined
                    }
                    className="rounded-md border-emerald-600 shadow-md focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                  />
                  {actionData?.fieldErrors?.email && (
                    <p
                      id="email-error"
                      role="alert"
                      className="text-sm text-red-500"
                    >
                      {actionData.fieldErrors.email}
                    </p>
                  )}
                </div>
              </div>
              {actionData?.formError && (
                <div>
                  <p className="text-sm text-red-500">{actionData.formError}</p>
                </div>
              )}
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
        )}
      </main>
      <footer>
        <Footer />
      </footer>
    </>
  );
}

function validateName(name: string | null) {
  if (!name) return "Name must be provided";
  if (name.trim().length === 0) return "Name cannot be empty";
}

function validateEmail(email: string | null) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) return "Email must be provided";
  if (!emailRegex.test(email)) return "Email must be valid";
}

function getBookedSlots(field: Event["event_responses"]) {
  if (!field) return 0;
  const { data: events } = field;
  return events.filter(({ attributes: event }) => {
    const { state } = event;
    if (state === "invite_confirmed") return true;
    if (state === "invite_sent") return true;
    return false;
  }).length;
}
