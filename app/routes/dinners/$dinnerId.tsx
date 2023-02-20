import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { Footer } from "~/components/footer";
import { NavBar } from "~/components/navbar";
import { createEventResponse } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";
import type { ActionArgs, LoaderArgs } from "@remix-run/node";

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
  const restrictionVegetarian = formData.get("dr-vegetarian") as string;
  const restrictionVegan = formData.get("dr-vegan") as string;
  const restrictionNuts = formData.get("dr-nuts") as string;
  const restrictionDairy = formData.get("dr-dairy") as string;
  const restrictionAlcohol = formData.get("dr-alcohol") as string;
  const comment = formData.get("comment") as string;
  const termsOfService = formData.get("terms-of-service") as string;
  const newsletter = formData.get("newsletter-signup") as string;

  const fieldErrors = {
    name: validateName(name),
    email: validateEmail(email),
    termsOfService: validateTermsOfService(termsOfService),
  };

  const fields = {
    name,
    email,
    restrictionVegetarian,
    restrictionVegan,
    restrictionNuts,
    restrictionDairy,
    restrictionAlcohol,
    comment,
    termsOfService,
    newsletter,
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

  await createEventResponse({
    name,
    email,
    vegetarian: restrictionVegetarian ? true : false,
    vegan: restrictionVegan ? true : false,
    noNuts: restrictionNuts ? true : false,
    noDairy: restrictionDairy ? true : false,
    noAlcohol: restrictionAlcohol ? true : false,
    comment,
    termsOfService: termsOfService ? true : false,
    newsletter: newsletter ? true : false,
    eventId: dinnerId,
  });

  return redirect("/dinners");
};

export default function DinnerRoute() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const eventDate = new Date(event.date);
  const signupStartDate = new Date(event.signupDate);
  const signupHasStarted = Date.now() > signupStartDate.valueOf();
  const slotsAvailable = event.slots - event.EventResponse.length;
  const slotsFilled = event.slots - slotsAvailable;

  return (
    <>
      <header>
        <NavBar />
      </header>
      <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 pt-4 pb-8 text-gray-800">
        <div className="flex flex-col gap-2">
          <p className="text-xl text-emerald-600">{event.subtitle}</p>
          <h1 className="text-4xl font-bold text-gray-900">{event.title}</h1>
        </div>
        <div className="flex items-center justify-between">
          {event.tags.length > 0 && (
            <>
              <div>
                <div className="flex gap-1">
                  {event.tags.split(" ").map((tag) => {
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
            {`${slotsFilled}/${event.slots}`}
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
          src={event.imageUrl}
          alt=""
          width={1200}
          height={800}
          className="max-h-28 w-full rounded-xl object-cover shadow-xl"
        />
        <div className="font-semibold text-emerald-600">
          <time dateTime={event.date}>
            {`${eventDate.toLocaleDateString()} - ${eventDate.toLocaleTimeString()}`}
          </time>
          <div>
            {!signupHasStarted && (
              <>
                Signup starts{" "}
                <time dateTime={event.signupDate}>
                  {`${signupStartDate.toLocaleDateString()} - ${signupStartDate.toLocaleTimeString()}`}
                </time>
              </>
            )}
          </div>
          <p>{event.location.street}</p>
          <p>{`${event.location.zipCode} ${event.location.zipName}`}</p>
        </div>
        <div className="font-semibold text-emerald-600">
          <p>{`Cost, ${event.price} CHF (Non-Profit)`}</p>
        </div>
        <div>
          <p className="whitespace-pre-line">{event.description}</p>
        </div>
        {signupHasStarted && slotsAvailable > 0 && (
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
              <div>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">Dietary Restrictions</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="dr-vegetarian"
                      id="dr-vegetarian"
                      defaultChecked={
                        actionData?.fields.restrictionVegetarian ===
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
                        actionData?.fields.restrictionVegetarian === "dr-vegan"
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
                        actionData?.fields.restrictionVegetarian === "dr-nuts"
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
                        actionData?.fields.restrictionVegetarian === "dr-dairy"
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
                        actionData?.fields.restrictionVegetarian ===
                        "dr-alcohol"
                      }
                      value="dr-alcohol"
                      className="rounded-sm border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                    />
                    <label htmlFor="dr-alcohol">No Alcohol</label>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="comment" className="font-semibold">
                    Anything else?
                  </label>
                  <textarea
                    name="comment"
                    id="comment"
                    defaultValue={actionData?.fields.comment}
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
                        actionData?.fields.termsOfService === "terms-of-service"
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
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="newsletter-signup"
                      id="newsletter-signup"
                      defaultChecked={
                        actionData?.fields.termsOfService ===
                        "newsletter-signup"
                      }
                      value="newsletter-signup"
                      className="rounded-sm border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                    />
                    <label htmlFor="newsletter-signup">
                      Inform me about new events
                    </label>
                  </div>
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

function validateTermsOfService(value: string | null) {
  if (value !== "terms-of-service") {
    return "You must accept the terms of service";
  }
}
