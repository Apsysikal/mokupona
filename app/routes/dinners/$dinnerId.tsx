import { ActionArgs, json, LoaderArgs, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { NavBar } from "~/components/navbar";
import { hasErrors } from "~/utilities/forms.server";
import { prisma } from "~/utilities/prisma.server";
import { badRequest } from "~/utilities/request.server";

export const loader = async ({ params }: LoaderArgs) => {
  const dinnerId = params.dinnerId;

  invariant(dinnerId, "dinnerId must be defined");

  const event = await prisma.event.findUnique({
    where: { id: dinnerId },
    select: {
      title: true,
      subtitle: true,
      date: true,
      tags: true,
      imageUrl: true,
      location: true,
      price: true,
      description: true,
    },
  });

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
  const phoneNumber = formData.get("phone-number") as string;
  const messenger = formData.get("preferred-messenger") as string;
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
    phoneNumber: validatePhoneNumber(phoneNumber),
    messenger: validateMessenger(messenger),
    termsOfService: validateTermsOfService(termsOfService),
  };

  const fields = {
    name,
    phoneNumber,
    messenger,
    restrictionVegetarian,
    restrictionVegan,
    restrictionNuts,
    restrictionDairy,
    restrictionAlcohol,
    comment,
    termsOfService,
    newsletter,
  };

  if (hasErrors(fieldErrors)) {
    return badRequest({
      fieldErrors,
      fields,
      formError: null,
    });
  }

  await prisma.eventResponse.create({
    data: {
      name,
      phoneNumber,
      messenger,
      vegetarian: restrictionVegetarian ? true : false,
      vegan: restrictionVegan ? true : false,
      noNuts: restrictionNuts ? true : false,
      noDairy: restrictionDairy ? true : false,
      noAlcohol: restrictionAlcohol ? true : false,
      comment,
      termsOfService: termsOfService ? true : false,
      newsletter: newsletter ? true : false,
      eventId: dinnerId,
    },
  });

  return redirect("/dinners");
};

export default function DinnerRoute() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const parsedDate = new Date(Date.parse(event.date));

  return (
    <>
      <header>
        <NavBar className="text-white bg-emerald-800" />
      </header>
      <main className="flex flex-col max-w-3xl gap-5 grow mx-auto text-gray-800 px-2 py-4">
        <div className="flex flex-col gap-2">
          <p className="text-xl text-emerald-600">{event.subtitle}</p>
          <h1 className="text-4xl font-bold text-gray-900">{event.title}</h1>
        </div>
        {event.tags.length > 0 ? (
          <>
            <div>
              <div className="flex gap-1">
                {event.tags.map((tag) => {
                  return (
                    <span className="rounded-full bg-emerald-200/50 px-2 py-1 text-xs uppercase text-emerald-800">
                      {tag}
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
        <img
          src={event.imageUrl}
          alt=""
          width={1200}
          height={800}
          className="max-h-28 w-full object-cover rounded-xl shadow-xl"
        />
        <div className="font-semibold text-emerald-600">
          <time>
            {`${parsedDate.toLocaleDateString()} - ${parsedDate.toLocaleTimeString()}`}
          </time>
          <p>{event.location.street}</p>
          <p>{`${event.location.zipCode} ${event.location.zipName}`}</p>
        </div>
        <div className="font-semibold text-emerald-600">
          <p>{`Cost, ${event.price} CHF (Non-Profit)`}</p>
        </div>
        <div>
          <p className="whitespace-pre-line">{event.description}</p>
        </div>
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
                className="border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 rounded-md shadow-md"
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
                <label htmlFor="phone-number" className="font-semibold">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone-number"
                  id="phone-number"
                  defaultValue={actionData?.fields.phoneNumber}
                  aria-invalid={
                    actionData?.fieldErrors.phoneNumber ? true : false
                  }
                  aria-errormessage={
                    actionData?.fieldErrors.phoneNumber
                      ? "phone-number-error"
                      : undefined
                  }
                  className="border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 rounded-md shadow-md"
                />
                {actionData?.fieldErrors?.phoneNumber && (
                  <p
                    id="phone-number-error"
                    role="alert"
                    className="text-sm text-red-500"
                  >
                    {actionData.fieldErrors.phoneNumber}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Preferred Messenger</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name="preferred-messenger"
                    id="preferred-messenger-signal"
                    defaultChecked={actionData?.fields.messenger === "signal"}
                    value="signal"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="preferred-messenger-signal">Signal</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name="preferred-messenger"
                    id="preferred-messenger-whatsapp"
                    defaultChecked={actionData?.fields.messenger === "whatsapp"}
                    value="whatsapp"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="preferred-messenger-whatsapp">WhatsApp</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name="preferred-messenger"
                    id="preferred-messenger-telegram"
                    defaultChecked={actionData?.fields.messenger === "telegram"}
                    value="telegram"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="preferred-messenger-telegram">Telegram</label>
                </div>
                {actionData?.fieldErrors?.messenger && (
                  <p
                    id="messenger-error"
                    role="alert"
                    className="text-sm text-red-500"
                  >
                    {actionData.fieldErrors.messenger}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Dietary Restrictions</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dr-vegetarian"
                    id="dr-vegetarian"
                    defaultChecked={
                      actionData?.fields.restrictionVegetarian ===
                      "dr-vegetarian"
                    }
                    value="dr-vegetarian"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dr-vegetarian">Vegetarian</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dr-vegan"
                    id="dr-vegan"
                    defaultChecked={
                      actionData?.fields.restrictionVegetarian === "dr-vegan"
                    }
                    value="dr-vegan"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dr-vegan">Vegan</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dr-nuts"
                    id="dr-nuts"
                    defaultChecked={
                      actionData?.fields.restrictionVegetarian === "dr-nuts"
                    }
                    value="dr-nuts"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dr-nuts">Nuts Allergy</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dr-dairy"
                    id="dr-dairy"
                    defaultChecked={
                      actionData?.fields.restrictionVegetarian === "dr-dairy"
                    }
                    value="dr-dairy"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dr-dairy">Dairy Intolerance</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dr-alcohol"
                    id="dr-alcohol"
                    defaultChecked={
                      actionData?.fields.restrictionVegetarian === "dr-alcohol"
                    }
                    value="dr-alcohol"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
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
                  className="border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 rounded-md shadow-md"
                />
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="terms-of-service"
                    id="terms-of-service"
                    defaultChecked={
                      actionData?.fields.termsOfService === "terms-of-service"
                    }
                    value="terms-of-service"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
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
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="newsletter-signup"
                    id="newsletter-signup"
                    defaultChecked={
                      actionData?.fields.termsOfService === "newsletter-signup"
                    }
                    value="newsletter-signup"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
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
                className="max-sm:w-full px-4 py-2 rounded-md shadow-md bg-emerald-800 text-white uppercase hover:bg-emerald-700 active:bg-emerald-900"
              >
                Join
              </button>
            </div>
          </div>
        </Form>
      </main>
    </>
  );
}

function validateName(name: string | null) {
  if (!name) return "Name must be provided";
  if (name.trim().length === 0) return "Name cannot be empty";
}

function validatePhoneNumber(phoneNumber: string | null) {
  if (!phoneNumber) return "Phone number must be provided";
  if (phoneNumber.length <= 6) return "Phone number must be valid";
}

function validateMessenger(messenger: string | null) {
  const validMessengers = ["signal", "whatsapp", "telegram"];

  if (!messenger) return "You must select a messenger";
  if (!validMessengers.find((valid) => valid === messenger)) {
    return "You must provide a valid messenger";
  }
}

function validateTermsOfService(value: string | null) {
  if (value !== "terms-of-service") {
    return "You must accept the terms of service";
  }
}
