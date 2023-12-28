import { Prisma } from "@prisma/client";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { createEventResponse } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { dinnerId } = params;
  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return json({ event });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { dinnerId } = params;
  const formData = await request.formData();
  const { name, email } = Object.fromEntries(formData);

  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const fieldErrors = {
    name: validateName(name),
    email: validateEmail(email),
  };

  const fields = {
    name: name as string,
    email: email as string,
  };

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

  try {
    await createEventResponse(dinnerId, name as string, email as string);
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const { code } = error;

      if (code === "P2002") {
        return json(
          {
            fieldErrors,
            fields,
            formError:
              "Failed to sign you up. Maybe you already signed up with this email",
          },
          {
            status: 400,
          },
        );
      }
    }

    return json(
      {
        fieldErrors,
        fields,
        formError:
          "Failed to sign you up. If this error persists, please contact us",
      },
      {
        status: 500,
      },
    );
  }

  return redirect("/dinners");
}

export default function DinnerPage() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <>
      <div className="flex flex-col gap-4">
        <img src={event.cover} alt="" />
        <span>{event.title}</span>
        <p className="whitespace-pre-line">{event.description}</p>
        <span>{new Date(event.date).toLocaleString()}</span>
        <span>{event.slots}</span>
        <span>{`${event.price} CHF`}</span>
      </div>
      <Form method="POST" className="flex flex-col gap-2">
        <div>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={actionData?.fields.name}
          />
          {actionData?.fieldErrors.name ? (
            <p>{actionData.fieldErrors.name}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={actionData?.fields.email}
          />
          {actionData?.fieldErrors.email ? (
            <p>{actionData.fieldErrors.email}</p>
          ) : null}
        </div>
        <div>
          <button type="submit">Join</button>
        </div>
        {actionData?.formError ? <p>{actionData.formError}</p> : null}
      </Form>
    </>
  );
}

function validateName(name: FormDataEntryValue | string | null) {
  if (!name) return "Name must be provided";
  if (String(name).trim().length === 0) return "Name cannot be empty";
}

function validateEmail(email: FormDataEntryValue | string | null) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) return "Email must be provided";
  if (!emailRegex.test(String(email))) return "Email must be valid";
}
